import { test, expect, type Page } from '@playwright/test'
import { placeSignature } from '../src/transfer-planning'
import { googleMapsFixture } from './google-maps-fixture'
import { openTrips, openWorkspace } from './navigation'
async function seed(page: Page, missing = false, fixture = true) {
  if (fixture) await googleMapsFixture(page)
  else await page.route('https://**', (route) => route.abort())
  await page.goto('/')
  await page.evaluate(
    (missing) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [
            {
              id: 'google-route-trip',
              title: '내 교토 여행',
              cityId: 'kyoto',
              startDate: '2026-11-01',
              endDate: '2026-11-02',
              travelers: 2,
              days: [
                [
                  {
                    id: 'temple',
                    placeId: 'kiyomizu',
                    time: '10:00',
                    durationMinutes: 60,
                    note: '개인 메모',
                  },
                  ...(missing
                    ? [
                        {
                          id: 'missing',
                          placeId: 'custom-missing',
                          time: '11:00',
                          note: '숙소 메모',
                          custom: {
                            name: '위치 없는 숙소',
                            address: '',
                            kind: '숙소',
                            link: '',
                            destinationId: 'kyoto',
                          },
                        },
                      ]
                    : []),
                  {
                    id: 'market',
                    placeId: 'nishiki',
                    time: '12:00',
                    note: '점심 메모',
                  },
                ],
                [
                  {
                    id: 'inari',
                    placeId: 'fushimi',
                    time: '12:00',
                    note: '다른 날',
                  },
                ],
              ],
              checklist: [{ id: 'passport', title: '여권 확인', done: false }],
              attachments: [],
            },
          ],
        }),
      ),
    missing,
  )
  await page.reload()
  await openTrips(page)
}
const minutes = (page: Page) =>
  page.getByLabel('기요미즈데라에서 니시키 시장 이동시간', { exact: true })
const mode = (page: Page) =>
  page.getByLabel('기요미즈데라에서 니시키 시장 이동수단', { exact: true })
const state = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )

test('Google 이동시간 자동 입력·경로 표시·귀속과 여행 원본 보존', async ({
  page,
}) => {
  await seed(page)
  const before = await state(page)
  expect(await page.evaluate(() => (window as any).googleCalls.length)).toBe(0)
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveText('13분')
  await expect(page.locator('.google-maps-attribution')).toContainText(
    'Google Maps',
  )
  await expect(page.locator('.transfer-result')).toHaveCount(0)
  await page.getByText('경로 안내', { exact: true }).click()
  await expect(page.locator('.google-route-warning')).toContainText(
    '보행 경로를 확인하세요.',
  )
  expect(await state(page)).toEqual(before)
  const calls = await page.evaluate(() => (window as any).googleCalls)
  expect(calls).toHaveLength(1)
  expect(calls[0].travelMode).toBe('WALKING')
  expect(JSON.stringify(calls)).not.toContain('개인 메모')
  expect(JSON.stringify(calls)).not.toContain('여권')
  await openWorkspace(page, '동선')
  await expect(page.locator('.google-route-fixture')).toHaveCount(1)
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(2)
  expect(await page.evaluate(() => (window as any).googleCalls.length)).toBe(1)
})

test('이동수단 변경은 해당 Google 경로·시간을 갱신하고 차량은 교통 반영 요청', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveText('13분')
  await mode(page).selectOption('transit')
  await expect(minutes(page)).toHaveText('22분')
  await mode(page).selectOption('driving')
  await expect(minutes(page)).toHaveText('9분')
  const calls = await page.evaluate(() => (window as any).googleCalls)
  expect(calls.map((c: any) => c.travelMode)).toEqual([
    'WALKING',
    'TRANSIT',
    'DRIVING',
  ])
  expect(calls[2].routingPreference).toBe('TRAFFIC_AWARE_OPTIMAL')
  expect((await state(page)).days[0][1].transfer).toBeUndefined()
})

test('기존 수동 시간은 보존하면서 선택한 수단의 자동 계산 값을 표시', async ({
  page,
}) => {
  await seed(page)
  const original = await state(page)
  await page.evaluate(
    (transfer) => {
      const saved = JSON.parse(localStorage.getItem('jido-travel-v1')!)
      saved.trips[0].days[0][1].transfer = transfer
      localStorage.setItem('jido-travel-v1', JSON.stringify(saved))
    },
    {
      fromStopId: 'temple',
      fromPlace: placeSignature(original.days[0][0]),
      toPlace: placeSignature(original.days[0][1]),
      minutes: 7,
    },
  )
  await page.reload()
  await openTrips(page)
  const before = await state(page)
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveText('13분')
  await mode(page).selectOption('transit')
  await expect(minutes(page)).toHaveText('22분')
  await mode(page).selectOption('driving')
  await expect(minutes(page)).toHaveText('9분')
  expect(await state(page)).toEqual(before)
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveText('13분')
  expect(await state(page)).toEqual(before)
})

test('늦은 이전 이동수단 응답은 현재 선택을 덮어쓰지 않음', async ({
  page,
}) => {
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).googleDelay = true
  })
  await openWorkspace(page, '이동시간')
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).googleRequestsPending.length),
    )
    .toBe(1)
  await mode(page).selectOption('transit')
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).googleRequestsPending.length),
    )
    .toBe(2)
  await page.evaluate(() => (window as any).googleRequestsPending.shift()())
  await expect(minutes(page)).not.toHaveText(/^[0-9]+분$/)
  await page.evaluate(() => (window as any).googleRequestsPending.shift()())
  await expect(minutes(page)).toHaveText('22분')
})

test('경로 실패·누락 응답은 추정값으로 채우지 않고 재시도 유지', async ({
  page,
}) => {
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).googleRouteFailure = true
  })
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveText('계산 실패')
  await expect(minutes(page)).not.toHaveText(/^[0-9]+분$/)
  await page.evaluate(() => {
    ;(window as any).googleRouteFailure = false
  })
  await page.getByRole('button', { name: '다시 계산', exact: true }).click()
  await expect(minutes(page)).toHaveText('13분')
})

test('위치 없는 구간은 건너뛰어 연결하거나 이동시간을 만들지 않음', async ({
  page,
}) => {
  await seed(page, true)
  await openWorkspace(page, '이동시간')
  await expect(
    page.getByText('위치 필요', {
      exact: true,
    }),
  ).toHaveCount(2)
  expect(await page.evaluate(() => (window as any).googleCalls.length)).toBe(0)
  await openWorkspace(page, '동선')
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(2)
  await expect(page.locator('.google-route-fixture')).toHaveCount(0)
  expect(await page.locator('.itinerary-map-pin').allTextContents()).toEqual([
    '1',
    '3',
  ])
})

test('늦은 응답·날짜 변경은 새 메모·다른 날짜·준비물을 보존', async ({
  page,
}) => {
  await seed(page)
  const before = await state(page)
  await page.evaluate(() => {
    ;(window as any).googleDelay = true
  })
  await openWorkspace(page, '이동시간')
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).googleRequestsPending.length),
    )
    .toBe(1)
  await openWorkspace(page, '일정')
  await page
    .locator('[data-stop-id="temple"] .stop-edit-details > summary')
    .click()
  await page
    .getByLabel('기요미즈데라 메모', { exact: true })
    .fill('늦은 계산 중 바꾼 메모')
  await page
    .getByRole('tablist', { name: '여행 날짜' })
    .getByRole('tab')
    .nth(1)
    .click()
  await page.evaluate(() => (window as any).googleRequestsPending.shift()())
  const after = await state(page)
  expect(after.days[0][0].note).toBe('늦은 계산 중 바꾼 메모')
  expect(after.days[0][1].transfer).toBeUndefined()
  expect(after.days[1]).toEqual(before.days[1])
  expect(after.checklist).toEqual(before.checklist)
})

test('20초 지연 뒤 실패를 표시하며 늦은 결과는 시간을 저장하지 않음', async ({
  page,
}) => {
  await page.clock.install()
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).googleDelay = true
  })
  await openWorkspace(page, '이동시간')
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).googleRequestsPending.length),
    )
    .toBe(1)
  await page.clock.runFor(20001)
  await expect(minutes(page)).toHaveText('계산 지연')
  await expect(minutes(page)).not.toHaveText(/^[0-9]+분$/)
  await page.evaluate(() => (window as any).googleRequestsPending.shift()())
  expect((await state(page)).days[0][1].transfer).toBeUndefined()
})

test('키 누락·인증 실패는 지도 위에 표시하고 잘못된 Google 지도로 성공 처리하지 않음', async ({
  page,
}) => {
  await seed(page, false, false)
  // Register after the catch-all abort route so this SDK response takes precedence.
  await page.route('https://maps.googleapis.com/maps/api/js?**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `
    window.google = {maps:{importLibrary: async () => ({Map:class {
      constructor() {setTimeout(() => window.gm_authFailure(), 0)}
      fitBounds() {} setCenter() {} setZoom() {} panTo() {} unbindAll() {}
    }})}};
    window.__jdoMapsReady();
  `,
    }),
  )
  await openWorkspace(page, '동선')
  await expect(page.locator('.google-map-status')).toContainText(
    /Google 지도 (인증 설정을 확인해야 합니다|연결이 아직 설정되지 않았습니다)/,
  )
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(0)
})

test('SDK 라이브러리 자체가 응답하지 않아도 20초 후 지연 상태로 종료', async ({
  page,
}) => {
  await page.clock.install()
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).google.maps.importLibrary = () => new Promise(() => {})
  })
  await openWorkspace(page, '동선')
  await page.clock.runFor(20001)
  await expect(page.locator('.google-map-status')).toContainText(
    'Google 지도 연결이 지연됩니다.',
  )
  await expect(page.locator('.itinerary-map-pin')).toHaveCount(0)
})

test('320px에서도 이동수단과 계산 값만 간결하게 표시', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveText('13분')
  const panel = page.getByRole('region', { name: '이동시간 확인' })
  await expect(panel.locator('input')).toHaveCount(0)
  await expect(panel).not.toContainText(
    /직선|조회 시점|자동 계산|도착|체류|직접 입력/,
  )
  await expect(mode(page).locator('option')).toHaveText([
    '도보',
    '대중교통',
    '자동차',
  ])
  expect(
    await mode(page).evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
