import { openTrips, openWorkspace } from './navigation'
import { test, expect, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import { japanGuideById } from '../src/japan-guides'
import { tripSchema } from '../src/travel-model'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4jIAAAAASUVORK5CYII=',
  'base64',
)
async function seed(page: Page) {
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: [],
        trips: [
          {
            id: 'photos-trip',
            title: '내 교토 여행',
            cityId: 'kyoto',
            startDate: '2026-11-01',
            endDate: '2026-11-02',
            travelers: 1,
            days: [
              [
                { id: 'temple', placeId: 'kiyomizu', time: '10:00', note: '' },
                { id: 'market', placeId: 'nishiki', time: '12:00', note: '' },
              ],
              [],
            ],
          },
        ],
      }),
    ),
  )
  await page.reload()
  await openTrips(page)
}
async function tab(page: Page, name: string) {
  await openWorkspace(page, name)
}
async function photos(page: Page, index = 0) {
  const detail = page.locator('.stop-card .stop-photos').nth(index)
  await detail.locator('summary').click()
  return detail
}
async function addPhoto(panel: ReturnType<Page['locator']>, name: string) {
  await panel
    .locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'image/png', buffer: png })
}

test('장소별 실제 사진을 기기에 저장하고 대표 사진 선택·재실행·오프라인 열기', async ({
  page,
  context,
}) => {
  await seed(page)
  const panel = await photos(page)
  await addPhoto(panel, '내가 찍은 절.png')
  await expect(
    panel.getByRole('button', { name: '내가 찍은 절.png 자료 열기' }),
  ).toBeVisible()
  await expect(page.locator('.stop-place img[src^="blob:"]')).toHaveCount(1)
  await expect
    .poll(() =>
      page
        .locator('.stop-place img')
        .first()
        .evaluate((img: any) => img.naturalWidth),
    )
    .toBeGreaterThan(0)
  const first = await page
    .locator('.stop-place img')
    .first()
    .getAttribute('src')
  await addPhoto(panel, '절의 다른 사진.png')
  await panel
    .getByRole('button', { name: '절의 다른 사진.png 대표 사진으로 사용' })
    .click()
  await expect(
    panel.getByRole('button', {
      name: '절의 다른 사진.png 대표 사진으로 사용',
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.stop-place img').first()).not.toHaveAttribute(
    'src',
    first!,
  )
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(saved.attachments).toHaveLength(2)
  expect(
    saved.attachments.every(
      (file: any) => file.stopId === 'temple' && file.storage === 'browser',
    ),
  ).toBe(true)
  expect(saved.days[0][0].photoId).toBe(saved.attachments[1].id)
  expect(saved.days[0][1].photoId).toBeUndefined()
  await page.reload()
  await openTrips(page)
  await context.setOffline(true)
  await expect
    .poll(() =>
      page
        .locator('.stop-place img')
        .first()
        .evaluate((img: any) => img.naturalWidth),
    )
    .toBeGreaterThan(0)
  await tab(page, '여행 중')
  await page
    .getByRole('region', { name: '여행 중 빠른 실행' })
    .locator('.stop-photos summary')
    .click()
  await expect
    .poll(() =>
      page
        .locator('.field-place-photo')
        .evaluate((img: any) => img.naturalWidth),
    )
    .toBeGreaterThan(0)

  await expect(
    page.getByRole('button', { name: '절의 다른 사진.png 대표 사진으로 사용' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await context.setOffline(false)
})

test('대표 사진 삭제·문서 오선택이 다른 장소의 사진과 기록을 지우지 않음', async ({
  page,
}) => {
  await seed(page)
  const one = await photos(page, 0)
  await addPhoto(one, '절 사진.png')
  await one
    .getByRole('button', { name: '절 사진.png 대표 사진으로 사용' })
    .click()
  const two = await photos(page, 1)
  await addPhoto(two, '시장 사진.png')
  await one.locator('input[type=file]').setInputFiles({
    name: '문서.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('문서'),
  })
  await expect(one.getByRole('alert')).toContainText('사진 파일')
  await one.getByRole('button', { name: '절 사진.png 첨부 삭제' }).click()
  await one.getByRole('button', { name: '첨부 삭제', exact: true }).click()
  await expect(
    one.getByRole('button', { name: '절 사진.png 자료 열기' }),
  ).toHaveCount(0)
  await expect(page.locator('.stop-place img')).toHaveCount(2)
  await expect(page.locator('.stop-place img').first()).toHaveAttribute(
    'src',
    '/images/place-kiyomizu.jpg',
  )
  await expect(page.locator('.stop-place img').nth(1)).toHaveAttribute(
    'src',
    /^blob:/,
  )
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(saved.days[0][0].photoId).toBeUndefined()
  expect(saved.attachments).toHaveLength(1)
  expect(saved.attachments[0].stopId).toBe('market')
  expect(saved.days[0][1].placeId).toBe('nishiki')
})

test('사진 파일과 대표 사진 참조는 일정 JSON 백업·동행자 파일에 포함하지 않음', async ({
  page,
}) => {
  await seed(page)
  const panel = await photos(page)
  await addPhoto(panel, '개인사진.png')
  await panel
    .getByRole('button', { name: '개인사진.png 대표 사진으로 사용' })
    .click()
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.locator('.legacy-backup > summary').click()
  await page.getByRole('button', { name: '전체 여행 백업 복사' }).click()
  const text = await page.getByLabel('내보낸 여행 내용').inputValue()
  const backup = JSON.parse(text)
  expect(text).not.toContain('photoId')
  expect(text).not.toContain('attachments')
  expect(text).not.toContain('개인사진')
  expect(tripSchema.safeParse(backup.trips[0]).success).toBe(true)
})

test('긴 하단 바·Android 제스처 여백·작은 높이에서도 마지막 저장 버튼을 가리지 않음', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await page.addStyleTag({
    content:
      ':root {--safe-area-inset-bottom:40px;} .bottom-nav {padding-top:25px;} ',
  })
  await tab(page, '여행 준비')
  await page
    .locator('.travel-info')
    .getByRole('button', { name: '추가', exact: true })
    .click()
  await page
    .getByLabel('여행 메모', { exact: true })
    .fill('하단 저장 버튼 확인')
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  )
  const save = page.getByRole('button', {
    name: '연락처·메모 저장',
    exact: true,
  })
  await expect
    .poll(async () => {
      const button = await save.boundingBox()
      const bar = await page.locator('.bottom-nav').boundingBox()
      return !!button && !!bar && button.y + button.height <= bar.y
    })
    .toBe(true)
  await save.click()
  await expect(
    page.getByText('하단 저장 버튼 확인', { exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 320, height: 470 })
  await page
    .locator('.travel-info')
    .getByRole('button', { name: '편집', exact: true })
    .click()
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  )
  await expect
    .poll(async () => {
      const button = await save.boundingBox()
      const bar = await page.locator('.bottom-nav').boundingBox()
      return !!button && !!bar && button.y + button.height <= bar.y
    })
    .toBe(true)
  await page.screenshot({
    path: `artifacts/bottom-inset-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('일본 주요 10개 도시·500개 이상 장소의 기본 가이드와 일본어 검색·일정 추가를 오프라인 제공', async ({
  page,
  context,
}) => {
  const japan = cities.filter((city) => city.region === '일본')
  expect(japan).toHaveLength(10)
  expect(
    places.filter((place) => japan.some((city) => city.id === place.cityId))
      .length,
  ).toBeGreaterThanOrEqual(500)
  for (const city of japan) expect(japanGuideById.has(city.id)).toBe(true)
  await page.goto('/')
  await page.getByLabel('도시 또는 나라 검색').fill('東京')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await expect(page.locator('.city-card')).toHaveCount(1)
  await page.getByRole('button', { name: '도쿄 여행지 자세히 보기' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('하네다·나리타공항')
  await expect(
    dialog.getByRole('tablist', { name: '실전 가이드', exact: true }),
  ).toBeVisible()
  await expect(dialog).not.toContainText('상세 안내·기존 자료')
  await expect(dialog).toContainText('센소지')
  await expect(
    dialog.getByRole('link', { name: '일본정부관광국 공식 안내' }),
  ).toHaveAttribute(
    'href',
    'https://www.japan.travel/en/destinations/kanto/tokyo/',
  )
  await dialog
    .getByRole('button', { name: '도쿄 여행 만들기', exact: true })
    .click()
  await page.getByLabel('첫날에 추천 장소 3곳 넣어두기').check()
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.timeline-item')).toHaveCount(3)
  await page.reload()
  await openTrips(page)
  await context.setOffline(true)
  await page.getByLabel('센소지 방문 시간').fill('09:30')
  await expect(page.locator('.timeline')).toContainText('센소지')
  await expect(page.getByLabel('센소지 방문 시간')).toHaveValue('09:30')
  await context.setOffline(false)
})

test('70개 장소의 사진 파일이 열리고 장소별로 구분되며 촬영자·이용 조건을 연결', async ({
  page,
}) => {
  const photographed = places.filter((place) => place.photoCredit)
  expect(photographed).toHaveLength(70)
  expect(new Set(photographed.map((place) => place.image)).size).toBe(70)
  for (const place of photographed) {
    expect(place.photoCredit?.file).toBe(place.image)
    expect(place.photoCredit?.sourceUrl).toMatch(
      /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
    )
    expect(place.photoCredit?.licenseUrl).toMatch(/^https:\/\//)
    expect(place.photoCredit?.author).toBeTruthy()
  }
  await page.goto('/')
  const loaded = await page.evaluate(
    async (paths: string[]) =>
      Promise.all(
        paths.map(
          (src) =>
            new Promise<boolean>((resolve) => {
              const image = new Image()
              image.onload = () =>
                resolve(image.naturalWidth >= 480 && image.naturalHeight > 0)
              image.onerror = () => resolve(false)
              image.src = src
            }),
        ),
      ),
    photographed.map((place) => place.image),
  )
  expect(loaded).toEqual(Array(70).fill(true))
  await page.getByLabel('도시 또는 나라 검색').fill('교토')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await page.getByRole('button', { name: '교토 여행지 자세히 보기' }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.locator('.detail-place-list img[src="/images/kyoto.jpg"]'),
  ).toHaveCount(0)
  await dialog
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('img', { name: '기요미즈데라', exact: true }),
  ).toHaveAttribute('src', '/images/place-kiyomizu.jpg')
  await expect(dialog.locator('.photo-credit')).toHaveCount(0)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '사진 출처', exact: true }).click()
  await page.getByLabel('사진 출처 검색').fill('기요미즈데라')
  const credit = page.locator('.photo-credit-entry')
  await expect(credit).toHaveCount(1)
  await expect(credit.getByRole('link', { name: '사진 원본' })).toHaveAttribute(
    'href',
    places.find((place) => place.id === 'kiyomizu')!.photoCredit!.sourceUrl,
  )
  await expect(
    credit.getByRole('link', { name: 'CC BY-SA 3.0' }),
  ).toHaveAttribute(
    'href',
    places.find((place) => place.id === 'kiyomizu')!.photoCredit!.licenseUrl,
  )
  await expect(
    dialog.getByText('사진은 도시의 대표 풍경', { exact: false }),
  ).toHaveCount(0)
})

test('Google SDK 모형: 기기 내 동명 장소가 있어도 Google 공식 이름·위치로 등록', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.mapsCalls = []
    localStorage.setItem('jido-place-search-service', 'google')
    w.google = {
      maps: {
        importLibrary: async () => ({
          Place: {
            searchByText: async (request: any) => {
              w.mapsCalls.push(request)
              return {
                places: [
                  {
                    id: 'google-kiyomizu',
                    displayName: 'Kiyomizu-dera',
                    formattedAddress: '1-294 Kiyomizu, Kyoto, Japan',
                    location: { lat: () => 34.9948, lng: () => 135.785 },
                    types: ['tourist_attraction'],
                  },
                ],
              }
            },
          },
        }),
      },
    }
  })
  await seed(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByRole('button', { name: '새 장소 추가', exact: true }).click()
  await page.getByLabel('장소 또는 일정 이름').fill('기요미즈데라')
  await page.getByRole('button', { name: '찾기', exact: true }).click()
  await page
    .getByRole('button', { name: '구글 지도에서 찾기', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Kiyomizu-dera 선택', exact: true })
    .click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  const custom = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[0].at(
        -1,
      ).custom,
  )
  expect(custom.name).toBe('Kiyomizu-dera')
  expect(custom.googlePlaceId).toBe('google-kiyomizu')
  expect(custom.coordinates).toEqual({ lat: 34.9948, lng: 135.785 })
  expect(custom.catalogPlaceId).toBeUndefined()
  expect(await page.evaluate(() => (window as any).mapsCalls.length)).toBe(1)
})

test('Android 사진 선택 브리지 모형은 이미지 형식을 요청하고 장소에 연결', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.photoCalls = []
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'Attachments',
          methods: ['pickFiles', 'getUri', 'openFile', 'deleteFile'].map(
            (name) => ({ name, rtype: 'promise' }),
          ),
        },
      ],
      nativePromise: (plugin: string, method: string, options: any) => {
        w.photoCalls.push({ plugin, method, options })
        if (method === 'pickFiles')
          return Promise.resolve({
            files: [
              {
                id: '22222222-2222-4222-8222-222222222222',
                name: '기기 사진.jpg',
                mimeType: 'image/jpeg',
                size: 300,
                createdAt: '2026-10-14T00:00:00.000Z',
                storage: 'android',
              },
            ],
            errors: [],
          })
        if (method === 'getUri')
          return Promise.resolve({ uri: 'file:///private/photo.jpg' })
        return Promise.resolve({})
      },
    }
  })
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  const panel = await photos(page)
  await panel.getByRole('button', { name: '사진 추가', exact: true }).click()
  await expect(
    panel.getByRole('button', { name: '기기 사진.jpg 자료 열기' }),
  ).toBeVisible()
  const calls = await page.evaluate(() => (window as any).photoCalls)
  expect(
    calls.find((call: any) => call.method === 'pickFiles').options.imagesOnly,
  ).toBe(true)
  const file = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0]
        .attachments[0],
  )
  expect(file.stopId).toBe('temple')
  expect(file.storage).toBe('android')
})

test('이전 서버 가이드 캐시가 비어 있어도 앱에 포함된 일본 가이드를 숨기지 않음', async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      'jdo-guide-catalog-v1',
      JSON.stringify({ usingServer: true, available: [], retained: [] }),
    ),
  )
  await page.goto('/')
  await page.getByLabel('도시 또는 나라 검색').fill('일본')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await expect(page.locator('.city-card')).toHaveCount(10)
  await expect(
    page.getByRole('button', { name: '삿포로 여행지 자세히 보기' }),
  ).toBeVisible()
})

test('이전 교토 가이드의 반복 사진은 갱신하면서 사용자가 쓴 가이드와 일정 보존', async ({
  page,
}) => {
  const city = {
    ...cities.find((city) => city.id === 'kyoto')!,
    image: '/images/kyoto.jpg',
    description: '내가 정리한 교토',
  }
  delete city.photoCredit
  const legacyPlaces = places
    .filter((place) => place.cityId === 'kyoto')
    .map((place) => {
      const copy = { ...place, image: '/images/kyoto.jpg' }
      delete copy.photoCredit
      return copy
    })
  const guide = {
    id: 'kyoto',
    scope: 'city',
    city,
    places: legacyPlaces,
    sections: [{ id: 'my-notes', title: '내 정보', body: '숙소 주변 걷기' }],
    sources: [],
    status: 'published',
    requestId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
  }
  await page.addInitScript(
    (guide) =>
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({
          usingServer: true,
          available: [guide],
          retained: [guide],
        }),
      ),
    guide,
  )
  await seed(page)
  await expect(page.locator('.stop-place img').first()).toHaveAttribute(
    'src',
    '/images/place-kiyomizu.jpg',
  )
  await expect(page.locator('.stop-place img').nth(1)).toHaveAttribute(
    'src',
    '/images/place-nishiki.jpg',
  )
  await page.locator('.stop-place button').first().click()
  await expect(
    page
      .getByRole('dialog')
      .getByRole('img', { name: '기요미즈데라', exact: true }),
  ).toHaveAttribute('src', '/images/place-kiyomizu.jpg')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('내가 정리한 교토')
  await expect(page.getByRole('dialog')).toContainText('숙소 주변 걷기')
})
