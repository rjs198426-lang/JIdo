import { test, expect, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import { sameStopPlace } from '../src/stop-identity'
import { openTrips } from './navigation'
const uuid = '55555555-5555-4555-8555-555555555555'
function tripFixture(): Trip {
  return tripSchema.parse({
    id: 'photo-planning',
    title: '교토와 도쿄 자유여행',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 1,
    destinations: [
      { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
      { id: 'tokyo', name: '도쿄', country: '일본', guideCityId: 'tokyo' },
    ],
    dayDestinationIds: ['kyoto', 'tokyo'],
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:00',
          note: '내 예약 메모',
          status: 'done',
          durationMinutes: 90,
        },
      ],
      [
        {
          id: 'tokyo-stop',
          placeId: 'tokyo-sensoji',
          time: '11:00',
          note: '별도 입장권',
        },
      ],
    ],
    attachments: [],
  })
}
async function seed(page: Page, trip = tripFixture()) {
  await page.goto('/')
  await page.evaluate(
    (trip) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [trip],
        }),
      ),
    trip,
  )
  await page.reload()
}
async function openTemple(page: Page) {
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
}
test('여행을 만들기 전에도 개인 장소·도시 사진을 지정하고 오프라인 목록·일정·홈에서 유지', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await seed(page)
  await openTemple(page)
  await page
    .getByLabel('기요미즈데라 개인 사진 파일', { exact: true })
    .setInputFiles('public/images/place-gion.jpg')
  await expect(
    page.getByRole('button', { name: '내 사진 바꾸기', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.place-detail-photo img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-personal-photos-v1')!)[
        'place:kiyomizu'
      ].id,
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    '교토 여행 가이드',
  )
  await page
    .getByLabel('교토 개인 사진 파일', { exact: true })
    .setInputFiles('public/images/place-gion.jpg')
  await expect(page.locator('.city-detail-hero img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.home-journey-photo')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await page.reload()
  await context.setOffline(true)
  await expect(page.locator('.home-journey-photo')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await openTrips(page)
  await expect(page.locator('.stop-place img').first()).toHaveAttribute(
    'src',
    /^blob:/,
  )
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(stored.days).toEqual(tripFixture().days)
  expect(stored.attachments).toEqual([])
  expect(JSON.stringify(stored)).not.toContain(id)
  await page.locator('.stop-place button').first().click()
  await page.getByRole('button', { name: '기본 사진', exact: true }).click()
  await expect(page.locator('.place-detail-photo img')).toHaveAttribute(
    'src',
    '/images/place-kiyomizu.jpg',
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.locator('.stop-place img').first()).toHaveAttribute(
    'src',
    '/images/place-kiyomizu.jpg',
  )
})
test('깨진 사진·저장 실패는 기존 사진과 여행 기록을 지우지 않음', async ({
  page,
}) => {
  await seed(page)
  await openTemple(page)
  const input = page.getByLabel('기요미즈데라 개인 사진 파일', { exact: true })
  await input.setInputFiles('public/images/place-gion.jpg')
  await expect(
    page.getByRole('button', { name: '내 사진 바꾸기', exact: true }),
  ).toBeVisible()
  const original = await page.evaluate(() =>
    localStorage.getItem('jido-personal-photos-v1'),
  )
  await input.setInputFiles({
    name: 'broken.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('not an image'),
  })
  await expect(page.getByRole('alert')).toContainText('사진을 열 수 없어요')
  expect(
    await page.evaluate(() => localStorage.getItem('jido-personal-photos-v1')),
  ).toBe(original)
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jido-personal-photos-v1')
        throw new DOMException('full', 'QuotaExceededError')
      return set.call(this, key, value)
    }
  })
  await input.setInputFiles('public/images/place-nishiki.jpg')
  await expect(page.getByRole('alert')).toContainText(
    '사진 정보를 저장하지 못했어요',
  )
  expect(
    await page.evaluate(() => localStorage.getItem('jido-personal-photos-v1')),
  ).toBe(original)
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('jido-attachments-v1', 1)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('files')
          const count = tx.objectStore('files').count()
          tx.oncomplete = () => {
            resolve(count.result)
            db.close()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )
  expect(count).toBe(1)
})
test('Android 사진 선택 브리지는 이미지 한 장만 요청하고 개인 사진에 연결', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.personalCalls = []
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'Attachments',
          methods: ['pickFiles', 'getUri', 'deleteFile'].map((name) => ({
            name,
            rtype: 'promise',
          })),
        },
      ],
      nativePromise: (plugin: string, method: string, options: any) => {
        w.personalCalls.push({ method, options })
        if (method === 'pickFiles')
          return Promise.resolve({
            files: [
              {
                id: '55555555-5555-4555-8555-555555555555',
                name: '내사진.jpg',
                mimeType: 'image/jpeg',
                size: 100,
                createdAt: '2026-10-16T00:00:00.000Z',
                storage: 'android',
              },
            ],
            errors: [],
          })
        if (method === 'getUri')
          return Promise.resolve({
            uri: location.origin + '/images/place-gion.jpg',
          })
        return Promise.resolve({})
      },
    }
  })
  await page.goto('/')
  await openTemple(page)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  await page.getByRole('button', { name: '내 사진 넣기', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '내 사진 바꾸기', exact: true }),
  ).toBeVisible()
  const calls = await page.evaluate(() => (window as any).personalCalls)
  expect(
    calls.find((call: any) => call.method === 'pickFiles').options,
  ).toEqual({ limit: 1, imagesOnly: true })
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-personal-photos-v1')!)[
          'place:kiyomizu'
        ].id,
    ),
  ).toBe(uuid)
})
test('전체 일정 검색은 다른 날짜의 메모·도시를 찾고 선택한 날로 이동', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await seed(page)
  await openTrips(page)
  await page.locator('.trip-overview > summary').click()
  await expect(page.locator('.trip-overview-days > button')).toHaveCount(2)
  await page.getByLabel('여행 전체 일정 검색').fill('별도 입장권')
  await expect(page.locator('.trip-overview-days > button')).toHaveCount(1)
  await page
    .getByRole('button', { name: 'DAY 2 도쿄 일정 열기', exact: true })
    .click()
  await expect(page.getByLabel('센소지 방문 시간')).toHaveValue('11:00')
  const fits = await page
    .locator('.trip-overview')
    .evaluate((node) => node.scrollWidth <= node.clientWidth + 1)
  expect(fits).toBe(true)
  await page.getByLabel('여행 전체 일정 검색').fill('없는 장소')
  await expect(page.locator('.trip-overview')).toContainText(
    '일치하는 일정이 없어요',
  )
})
test('같은 도시의 날짜에만 장소를 담고 기기 등록 장소도 중복으로 추가하지 않음', async ({
  page,
}) => {
  const trip = tripFixture()
  trip.days[1] = []
  await seed(page, trip)
  await page.getByLabel('도시 또는 나라 검색').fill('도쿄')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await page
    .getByRole('button', { name: '도쿄 여행지 자세히 보기', exact: true })
    .click()
  await page
    .getByRole('button', { name: '센소지 자세히 보기', exact: true })
    .click()
  await page
    .getByRole('button', { name: '내 일정에 추가', exact: true })
    .click()
  const days = page.getByLabel('어느 날에 갈까요?')
  await expect(days.locator('option')).toHaveCount(1)
  await expect(days).toHaveValue('1')
  await page.getByRole('button', { name: '일정에 추가', exact: true }).click()
  await expect(page.locator('.stop-place')).toContainText('센소지')
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(stored.days[0]).toEqual(trip.days[0])
  expect(stored.days[1]).toHaveLength(1)
})
test('등록 방식이 다른 동일 장소를 비교하고 서로 다른 수동 장소는 구분', () => {
  const base = { id: 'a', placeId: 'kiyomizu', time: '09:00', note: '' }
  const custom = {
    ...base,
    id: 'b',
    placeId: 'custom-b',
    custom: {
      name: '기요미즈데라',
      kind: '관광' as const,
      address: '교토',
      link: '',
      destinationId: 'kyoto',
      catalogPlaceId: 'kiyomizu',
    },
  }
  expect(sameStopPlace(base, custom)).toBe(true)
  expect(sameStopPlace(custom, { ...base, placeId: 'nishiki' })).toBe(false)
  expect(
    sameStopPlace(
      {
        ...custom,
        custom: {
          ...custom.custom,
          catalogPlaceId: undefined,
          googlePlaceId: 'google-1',
        },
      },
      {
        ...custom,
        id: 'c',
        placeId: 'other',
        custom: {
          ...custom.custom,
          catalogPlaceId: undefined,
          googlePlaceId: 'google-1',
        },
      },
    ),
  ).toBe(true)
  expect(
    sameStopPlace(
      { ...base, placeId: 'custom-1' },
      { ...base, placeId: 'custom-2' },
    ),
  ).toBe(false)
})

test('하루 200곳 한도를 넘겨 추가하지 않고 날짜 미지정 도시는 여행 설정으로 연결', async ({
  page,
}) => {
  const trip = tripFixture()
  trip.days[1] = Array.from({ length: 200 }, (_, index) => ({
    id: `full-${index}`,
    placeId: `custom-${index}`,
    time: '11:00',
    note: '',
    custom: {
      name: `직접 장소 ${index}`,
      kind: '관광' as const,
      address: '',
      link: '',
      destinationId: 'tokyo',
    },
  }))
  async function chooseTokyo() {
    await page.getByLabel('도시 또는 나라 검색').fill('도쿄')
    await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
    await page
      .getByRole('button', { name: '도쿄 여행지 자세히 보기', exact: true })
      .click()
    await page
      .getByRole('button', { name: '센소지 자세히 보기', exact: true })
      .click()
    await page
      .getByRole('button', { name: '내 일정에 추가', exact: true })
      .click()
  }
  await seed(page, trip)
  await chooseTokyo()
  await page.getByRole('button', { name: '일정에 추가', exact: true }).click()
  await expect(
    page.getByText('하루 일정은 최대 200곳까지 담을 수 있어요.', {
      exact: true,
    }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[1]
          .length,
    ),
  ).toBe(200)
  trip.days[1] = []
  trip.dayDestinationIds = ['kyoto', 'kyoto']
  await seed(page, trip)
  await chooseTokyo()
  await expect(
    page.getByRole('button', { name: '일정에 추가', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: '여행에서 체류 날짜 지정', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('이날의 체류 도시')).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[1],
    ),
  ).toEqual([])
})
