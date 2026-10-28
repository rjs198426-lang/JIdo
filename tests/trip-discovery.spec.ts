import { test, expect, type Page } from '@playwright/test'
const makeTrip = (
  id: string,
  title: string,
  cityId = 'kyoto',
  date = '2026-12-01',
) => ({
  id,
  title,
  cityId,
  startDate: date,
  endDate: date.slice(0, 8) + '02',
  travelers: 1,
  days: [
    [
      {
        id: id + '-keep',
        placeId: cityId === 'kyoto' ? 'kiyomizu' : 'tokyo-shibuya',
        time: '',
        note: '보존할 메모',
      },
    ],
    [],
  ],
})
const a = makeTrip('a', '겨울 교토'),
  b = makeTrip('b', '봄 도쿄', 'tokyo'),
  c = makeTrip('c', '지난 교토', 'kyoto', '2025-12-01')
async function boot(page: Page, trips: any[] = [a, b, c]) {
  await page.addInitScript((trips) => {
    if (!sessionStorage.getItem('discovery-seeded')) {
      sessionStorage.setItem('discovery-seeded', 'yes')
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({ version: 1, savedCities: [], savedPlaces: [], trips }),
      )
      localStorage.setItem('jdo-active-trip-v1', 'a')
      localStorage.setItem(
        'jido-view-a',
        JSON.stringify({ day: 1, workspace: 'schedule' }),
      )
    }
    localStorage.setItem('jdo-content-auto-v1', 'false')
  }, trips)
  await page.goto('/')
  await expect(page.locator('.travel-home')).toBeVisible()
}
async function nav(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}
const raw = (page: Page) =>
  page.evaluate(() => localStorage.getItem('jido-travel-v1'))
const current = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('jido-travel-v1')!))
const photon = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [135.76, 35.01] },
      properties: {
        osm_type: 'N',
        osm_id: 73001,
        name: 'Discovery Cafe',
        'name:ko': '작은 골목 카페',
        city: 'Kyoto',
        country: 'Japan',
        street: 'Test Street',
        osm_key: 'amenity',
        osm_value: 'cafe',
      },
    },
  ],
}
async function picker(page: Page) {
  await nav(page, '내 여행')
  if (await page.locator('.trip-library').isVisible())
    await page
      .getByRole('button', { name: '겨울 교토 열기', exact: true })
      .click()
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  return page.getByRole('dialog')
}
test('여러 여행은 목록에서 골라 열고 날짜·메모를 보존하며 목록으로 돌아온다', async ({
  page,
}) => {
  await boot(page)
  const before = await raw(page)
  await nav(page, '내 여행')
  await expect(page.locator('.trip-library')).toBeVisible()
  await expect(page.locator('.itinerary')).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: '다가오는 여행' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '지난 교토 열기', exact: true }),
  ).not.toBeVisible()
  await page.getByLabel('내 여행 검색').fill('도쿄')
  await expect(page.locator('.trip-library-card')).toHaveCount(1)
  await page.getByLabel('내 여행 검색').fill('')
  await page
    .getByRole('button', { name: '겨울 교토 열기', exact: true })
    .click()
  await expect(page.locator('.itinerary')).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-view-a')!).day,
    ),
  ).toBe(1)
  await page
    .getByRole('button', { name: '모든 여행 보기', exact: true })
    .click()
  await page.getByRole('button', { name: '봄 도쿄 열기', exact: true }).click()
  await expect(page.locator('.itinerary')).toContainText('봄 도쿄')
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(page.locator('.trip-library')).toBeVisible()
  expect(await raw(page)).toBe(before)
})
test('여행 하나는 목록을 거치지 않고 바로 일정으로 연다', async ({ page }) => {
  await boot(page, [a])
  await nav(page, '내 여행')
  await expect(page.locator('.itinerary')).toBeVisible()
  await expect(page.locator('.trip-library')).toHaveCount(0)
})
test('장소 목록의 더하기는 상세를 거치지 않고 여행·날짜 확인 후 담는다', async ({
  page,
}) => {
  await boot(page, [a, makeTrip('other', '다른 교토')])
  await nav(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await expect(page.getByLabel('가볼 만한 곳의 도시')).toHaveValue('kyoto')
  await page.getByLabel('여행지와 장소 검색').fill('기온 시라카와')
  await page
    .getByRole('button', {
      name: '기온 시라카와 산책 일정에 추가',
      exact: true,
    })
    .click()
  const d = page.getByRole('dialog')
  await expect(d).toHaveAccessibleName('내 일정에 장소 담기')
  await expect(d.getByLabel('추가할 여행')).toHaveValue('a')
  await expect(d.getByLabel('어느 날에 갈까요?')).toHaveValue('1')
  await d.getByLabel('추가할 여행').selectOption('other')
  await d.getByRole('button', { name: '일정에 추가', exact: true }).click()
  const saved = await current(page)
  expect(saved.trips[0].days[1]).toHaveLength(0)
  expect(saved.trips[1].days[0]).toHaveLength(2)
  expect(saved.trips[1].days[0][1].time).toBe('')
})
test('가이드 장소에서도 바로 담고 상세 창 이력을 만들지 않는다', async ({
  page,
}) => {
  await boot(page, [a])
  await nav(page, '여행지')
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .click()
  const d = page.getByRole('dialog')
  await d.getByRole('tab', { name: '관광', exact: true }).click()
  await d
    .getByRole('button', { name: /일정에 추가$/ })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName(
    '내 일정에 장소 담기',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('일정 검색은 입력 중 요청하지 않고 지도 검색 결과를 바로 추가한다', async ({
  page,
}) => {
  const calls: string[] = []
  await page.route('https://photon.komoot.io/api/**', (r) => {
    calls.push(r.request().url())
    return r.fulfill({ json: photon })
  })
  await boot(page, [a])
  const d = await picker(page)
  await d.getByLabel('일정에 추가할 장소 검색').fill('Discovery Cafe')
  expect(calls).toHaveLength(0)
  await d.getByRole('button', { name: '지도 검색', exact: true }).click()
  await d
    .getByRole('button', { name: '작은 골목 카페 일정에 추가', exact: true })
    .click()
  await expect(
    d.getByRole('button', { name: '작은 골목 카페 추가됨', exact: true }),
  ).toBeDisabled()
  expect(calls).toHaveLength(1)
  const saved = await current(page)
  const stop = saved.trips[0].days[1][0]
  expect(stop.time).toBe('')
  expect(stop.note).toBe('')
  expect(stop.custom.osmPlaceId).toBe('node/73001')
  expect(stop.custom.coordinates).toEqual({ lat: 35.01, lng: 135.76 })
  expect(saved.trips[0].days[0][0].note).toBe('보존할 메모')
})
test('검색 결과 저장 실패는 추가됨으로 표시하지 않고 재시도 한 번만 저장한다', async ({
  page,
}) => {
  await page.route('https://photon.komoot.io/api/**', (r) =>
    r.fulfill({ json: photon }),
  )
  await boot(page, [a])
  const d = await picker(page)
  await d.getByLabel('일정에 추가할 장소 검색').fill('Discovery Cafe')
  await d.getByRole('button', { name: '지도 검색', exact: true }).click()
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as any).blockSave = true
    Storage.prototype.setItem = function (k, v) {
      if (k === 'jido-travel-v1' && (window as any).blockSave)
        throw new DOMException('quota', 'QuotaExceededError')
      original.call(this, k, v)
    }
  })
  const before = await raw(page)
  await d
    .getByRole('button', { name: '작은 골목 카페 일정에 추가', exact: true })
    .click()
  await expect(d.getByRole('alert')).toBeVisible()
  expect(await raw(page)).toBe(before)
  await expect(
    d.getByRole('button', { name: '작은 골목 카페 일정에 추가', exact: true }),
  ).toBeEnabled()
  await page.evaluate(() => ((window as any).blockSave = false))
  await d
    .getByRole('button', { name: '작은 골목 카페 일정에 추가', exact: true })
    .click()
  expect((await current(page)).trips[0].days[1]).toHaveLength(1)
})
test('여행지 지도 검색도 같은 창에서 찾아 여행·날짜를 확인하고 저장한다', async ({
  page,
}) => {
  await page.route('https://photon.komoot.io/api/**', (r) =>
    r.fulfill({ json: photon }),
  )
  await boot(page, [a, b])
  const before = await raw(page)
  await nav(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page.getByLabel('여행지와 장소 검색').fill('Discovery Cafe')
  await page.getByRole('button', { name: '지도 검색', exact: true }).click()
  await page
    .getByRole('button', { name: '작은 골목 카페 일정에 추가', exact: true })
    .click()
  expect(await raw(page)).toBe(before)
  const d = page.getByRole('dialog')
  await d.getByLabel('어느 날에 갈까요?').selectOption('1')
  await d.getByRole('button', { name: '일정에 추가', exact: true }).click()
  expect((await current(page)).trips[0].days[1][0].custom.osmPlaceId).toBe(
    'node/73001',
  )
  expect((await current(page)).trips[1].days[1]).toHaveLength(0)
})
test('검색어를 바꾸면 늦게 온 이전 지도 검색 결과를 무시한다', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('https://photon.komoot.io/api/**', async (r) => {
    await gate
    await r.fulfill({ json: photon })
  })
  await boot(page, [a])
  const d = await picker(page)
  await d.getByLabel('일정에 추가할 장소 검색').fill('Discovery Cafe')
  await d.getByRole('button', { name: '지도 검색', exact: true }).click()
  await d.getByLabel('일정에 추가할 장소 검색').fill('다른 이름')
  release()
  await expect(
    d.getByRole('button', { name: '작은 골목 카페 일정에 추가', exact: true }),
  ).toHaveCount(0)
  expect((await current(page)).trips[0].days[1]).toHaveLength(0)
})
test('320px 긴 여행명과 장소 카드의 버튼이 넘치거나 세로로 꺾이지 않는다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await boot(page, [
    {
      ...a,
      title: '아주아주 긴 이름으로 계획해 두었던 소중한 겨울 교토 가족 여행',
    },
    b,
  ])
  await nav(page, '내 여행')
  await expect(page.locator('.trip-library')).toBeVisible()
  expect(
    await page
      .locator('.trip-library')
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy()
  await nav(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  expect(
    await page
      .locator('.place-grid')
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy()
})

test('다른 화면으로 이동하면 늦게 도착한 전체 장소 검색 결과를 표시하지 않는다', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('https://photon.komoot.io/api/**', async (r) => {
    await gate
    await r.fulfill({ json: photon })
  })
  await boot(page, [a])
  await nav(page, '여행지')
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page.getByLabel('여행지와 장소 검색').fill('Discovery Cafe')
  await page.getByRole('button', { name: '지도 검색', exact: true }).click()
  await nav(page, '설정')
  const response = page.waitForResponse('https://photon.komoot.io/api/**')
  release()
  await (await response).finished()
  await nav(page, '여행지')
  await expect(
    page.getByRole('button', {
      name: '작은 골목 카페 일정에 추가',
      exact: true,
    }),
  ).toHaveCount(0)
  expect((await current(page)).trips[0].days[1]).toHaveLength(0)
})
