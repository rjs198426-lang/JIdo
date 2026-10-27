import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import { openTrips } from './navigation'

const BASE =
  'https://raw.githubusercontent.com/rjs198426-lang/JIdo/main/content/'
const KEY = 'jdo-public-content-v1'
const bundled = JSON.parse(readFileSync('content/manifest.json', 'utf8'))
const city = cities.find((c) => c.id === 'kyoto')!
const spot = {
  ...places.find((p) => p.id === 'kiyomizu')!,
  id: 'ota-spot',
  name: '새로 받은 산책 장소',
}
const catalog = { schemaVersion: 1, cities: [city], places: [spot] }
function release(data: unknown = catalog, sequence = bundled.sequence + 1) {
  const body = JSON.stringify(data)
  const revision = createHash('sha256').update(body).digest('hex')
  return {
    body,
    manifest: {
      ...bundled,
      sequence,
      revision,
      file: `catalog-${revision}.json`,
      bytes: Buffer.byteLength(body),
    },
  }
}
type Release = ReturnType<typeof release>
async function boot(page: Page, cache?: unknown, tripPlace = 'kiyomizu') {
  await page.addInitScript(
    ({ cache, key, tripPlace }) => {
      if (sessionStorage.getItem('seeded')) return
      sessionStorage.setItem('seeded', 'true')
      localStorage.setItem('jdo-content-auto-v1', 'false')
      if (cache !== undefined)
        localStorage.setItem(
          key,
          typeof cache === 'string' ? cache : JSON.stringify(cache),
        )
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: ['kyoto'],
          savedPlaces: ['kiyomizu'],
          trips: [
            {
              id: 'private-trip',
              title: '내 여행 비공개',
              cityId: 'kyoto',
              startDate: '2026-11-01',
              endDate: '2026-11-02',
              travelers: 2,
              days: [
                [
                  {
                    id: 'stop-private',
                    placeId: tripPlace,
                    time: '10:30',
                    note: '개인 메모 1234',
                  },
                ],
                [],
              ],
            },
          ],
        }),
      )
      localStorage.setItem(
        'private-preservation-marker',
        '개인 사진·경비를 보내지 않음',
      )
    },
    { cache, key: KEY, tripPlace },
  )
  await page.goto('/')
  await expect(page.locator('.travel-home')).toBeVisible()
}
async function panel(page: Page) {
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '설정', exact: true })
    .click()
  return page.getByRole('region', { name: '여행 정보 업데이트', exact: true })
}
async function update(page: Page) {
  const info = await panel(page)
  await info.getByRole('button', { name: '새 정보 확인', exact: true }).click()
  await expect(info.getByRole('status')).toBeVisible()
  return info.getByRole('status')
}
async function serve(
  page: Page,
  getRelease: () => Release,
  requests: string[] = [],
) {
  await page.route(BASE + '**', async (route) => {
    const request = route.request()
    expect(request.method()).toBe('GET')
    expect(request.postData()).toBeNull()
    expect(new URL(request.url()).search).toBe('')
    expect(request.headers()['referer']).toBeUndefined()
    requests.push(request.url())
    const current = getRelease()
    const body = request.url().endsWith('manifest.json')
      ? JSON.stringify(current.manifest)
      : current.body
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
}
async function saved(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), KEY)
}

test('검증된 정보 적용·재실행·오프라인 사용과 개인 기록 보존', async ({
  page,
  context,
}) => {
  const current = release()
  const requests: string[] = []
  await serve(page, () => current, requests)
  await boot(page)
  const personal = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  await expect(await update(page)).toContainText('새 여행 정보를 저장했어요')
  expect(requests).toEqual([
    BASE + 'manifest.json',
    BASE + current.manifest.file,
  ])
  expect(JSON.parse((await saved(page))!).catalog.places[0].name).toBe(
    spot.name,
  )
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(personal)
  await page.keyboard.press('Escape')
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await openTrips(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page
    .getByRole('button', { name: `${spot.name} 일정에 추가`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  await expect(page.locator('.timeline-item').last()).toContainText(spot.name)
  await page.reload()
  await context.setOffline(true)
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await openTrips(page)
  await expect(
    page.locator('.timeline-item').filter({ hasText: spot.name }),
  ).toHaveCount(1)
  expect(
    await page.evaluate(() =>
      localStorage.getItem('private-preservation-marker'),
    ),
  ).toContain('개인 사진')
  await expect(await update(page)).toContainText('최신 상태')
  expect(requests.length).toBe(3) // unchanged manifest does not download the catalog again
})

test('삭제된 원격 장소도 기존 일정과 재실행에서 보존', async ({ page }) => {
  let current = release()
  await serve(page, () => current)
  await boot(page)
  await expect(await update(page)).toContainText('저장했어요')
  await page.keyboard.press('Escape')
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await openTrips(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page
    .getByRole('button', { name: `${spot.name} 일정에 추가`, exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .click()
  current = release({ ...catalog, places: [] }, bundled.sequence + 2)
  await expect(await update(page)).toContainText('저장했어요')
  expect(JSON.parse((await saved(page))!).retainedPlaces[0].id).toBe(spot.id)
  await page.reload()
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await openTrips(page)
  await expect(
    page.locator('.timeline-item').filter({ hasText: spot.name }),
  ).toHaveCount(1)
})

for (const failure of [
  'hash',
  'bytes',
  'schema',
  'duplicate',
  'foreign-city',
  'min-build',
  'same-sequence',
  'quota',
  'network',
] as const) {
  test(`${failure}: 잘못된 업데이트는 이전 정보와 개인 기록을 유지`, async ({
    page,
  }) => {
    const old = release()
    const oldCache = {
      manifest: old.manifest,
      catalog,
      retainedCities: [],
      retainedPlaces: [],
    }
    let current = release(
      { ...catalog, places: [{ ...spot, name: '적용되면 안 되는 장소' }] },
      bundled.sequence + 2,
    )
    if (failure === 'hash')
      current.body = current.body.replace('적용되면', '위조되면')
    if (failure === 'bytes') current.manifest.bytes += 1
    if (failure === 'schema')
      current = release(
        { ...catalog, cities: [{ ...city, image: 'javascript:alert(1)' }] },
        bundled.sequence + 2,
      )
    if (failure === 'duplicate')
      current = release(
        { ...catalog, places: [spot, spot] },
        bundled.sequence + 2,
      )
    if (failure === 'foreign-city')
      current = release(
        { ...catalog, places: [{ ...spot, cityId: 'absent' }] },
        bundled.sequence + 2,
      )
    if (failure === 'min-build') current.manifest.minBuild = 99999
    if (failure === 'same-sequence')
      current.manifest.sequence = old.manifest.sequence
    await serve(page, () => current)
    if (failure === 'network')
      await page.route(BASE + '**', (route) => route.abort())
    await boot(page, oldCache, spot.id)
    if (failure === 'quota')
      await page.evaluate((key) => {
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (name, value) {
          if (name === key) throw new DOMException('Full', 'QuotaExceededError')
          original.call(this, name, value)
        }
      }, KEY)
    const oldSaved = await saved(page)
    const personal = await page.evaluate(() =>
      localStorage.getItem('jido-travel-v1'),
    )
    await expect(await update(page)).not.toContainText('저장했어요')
    expect(await saved(page)).toBe(oldSaved)
    expect(
      await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
    ).toBe(personal)
    await page.keyboard.press('Escape')
    await page
      .locator('.desktop-nav:visible,.bottom-nav:visible')
      .getByRole('button', { name: '홈', exact: true })
      .click()
    await openTrips(page)
    await expect(page.locator('.timeline-item')).toContainText(spot.name)
    await expect(page.locator('.timeline-item')).not.toContainText(
      '적용되면 안 되는',
    )
  })
}

test('새 APK가 오래된 공개 정보를 대체해도 과거 장소 참조 유지', async ({
  page,
}) => {
  const old = release(catalog, bundled.sequence)
  await boot(
    page,
    { manifest: old.manifest, catalog, retainedCities: [], retainedPlaces: [] },
    spot.id,
  )
  // The embedded set of 21 cities remains available, rather than the old one-city catalog.
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '괌 여행지 자세히 보기', exact: true }),
  ).toBeVisible()
  await page.reload()
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await openTrips(page)
  await expect(page.locator('.timeline-item')).toContainText(spot.name)
})

test('깨진 캐시 복구 및 자동 확인 끄기·하루 한 번 제한', async ({ page }) => {
  const requests: string[] = []
  await serve(page, () => ({ body: '', manifest: bundled }), requests)
  await boot(page, '{broken')
  await page.clock.install()
  await page.clock.fastForward(9000)
  expect(requests).toHaveLength(0)
  const info = await panel(page)
  await info.getByRole('checkbox', { name: '하루 한 번 자동 확인' }).check()
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(info.getByRole('status')).toContainText('최신 상태')
  expect(requests).toHaveLength(1)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.clock.fastForward(10000)
  expect(requests).toHaveLength(1)
  await info.getByRole('checkbox', { name: '하루 한 번 자동 확인' }).uncheck()
  await page.clock.fastForward(86400001)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  expect(requests).toHaveLength(1)
  await page.reload()
  await expect(
    (await panel(page)).getByRole('checkbox', { name: '하루 한 번 자동 확인' }),
  ).not.toBeChecked()
})

test('공개 업데이트가 개인 가이드 설명·장소·사진을 덮어쓰지 않음', async ({
  page,
}) => {
  await page.route('https://personal.invalid/my-photo.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="teal"/></svg>',
    }),
  )
  await serve(page, () => release(catalog, bundled.sequence + 2))
  await boot(
    page,
    {
      manifest: release().manifest,
      catalog,
      retainedCities: [],
      retainedPlaces: [],
    },
    spot.id,
  )
  const guide = {
    id: city.id,
    scope: 'city',
    status: 'published',
    requestId: null,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    publishedAt: '2026-10-20T00:00:00.000Z',
    city: {
      ...city,
      tagline: '내가 작성한 소개',
      image: '/images/guide-placeholder.svg',
    },
    places: [
      {
        ...spot,
        name: '개인 가이드의 장소',
        description: '내가 작성한 장소 설명',
        image: 'https://personal.invalid/my-photo.svg',
      },
    ],
    sections: [],
    sources: [],
  }
  await page.evaluate(
    (guide) =>
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({
          available: [guide],
          retained: [guide],
          usingServer: true,
        }),
      ),
    guide,
  )
  await page.reload()
  const before = await page.evaluate(() =>
    localStorage.getItem('jdo-guide-catalog-v1'),
  )
  await expect(await update(page)).toContainText('저장했어요')
  expect(
    await page.evaluate(() => localStorage.getItem('jdo-guide-catalog-v1')),
  ).toBe(before)
  await page.keyboard.press('Escape')
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '홈', exact: true })
    .click()
  await openTrips(page)
  await expect(page.locator('.timeline-item')).toContainText(
    '개인 가이드의 장소',
  )
  await expect(page.locator('.stop-place img').first()).toHaveAttribute(
    'src',
    'https://personal.invalid/my-photo.svg',
  )
})

for (const custom of [false, true]) {
  test(`공개 정보의 ${custom ? '개인 지정 사진 보존' : '빈 사진을 새 내장 사진으로 보완'}·재실행`, async ({
    page,
  }) => {
    const fresh = places.find((p) => p.id === 'kyoto-review-3ad4fafd578f')!
    const remote = {
      ...fresh,
      image: custom
        ? '/images/blog-kyoto-143.jpg'
        : '/images/place-placeholder.svg',
      photoCredit: undefined,
    }
    const data = { schemaVersion: 1, cities: [city], places: [remote] }
    const current = release(data)
    await boot(
      page,
      {
        manifest: current.manifest,
        catalog: data,
        retainedCities: [],
        retainedPlaces: [],
      },
      fresh.id,
    )
    for (let pass = 0; pass < 2; pass++) {
      await page
        .locator('.desktop-nav:visible,.bottom-nav:visible')
        .getByRole('button', { name: '설정', exact: true })
        .click()
      await page.getByRole('button', { name: '사진 출처', exact: true }).click()
      const entry = page
        .locator('.photo-credit-entry')
        .filter({ hasText: fresh.name })
      if (custom) await expect(entry).toHaveCount(0)
      else {
        await expect(entry).toHaveCount(1)
        await expect(entry.locator('a').first()).toHaveAttribute(
          'href',
          fresh.photoCredit!.sourceUrl,
        )
      }
      if (pass === 0) await page.reload()
    }
  })
}
