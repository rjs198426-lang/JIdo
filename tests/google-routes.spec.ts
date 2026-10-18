import { test, expect, type Page } from '@playwright/test'
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
  await expect(minutes(page)).toHaveValue('13')
  await expect(page.locator('.google-maps-attribution')).toContainText(
    'Google Maps · 도보 · 자동 계산',
  )
  await expect(page.locator('.transfer-result')).toContainText(
    'Google 계산 기준 도착 11:13',
  )
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
  await expect(minutes(page)).toHaveValue('13')
  await mode(page).selectOption('transit')
  await expect(minutes(page)).toHaveValue('22')
  await mode(page).selectOption('driving')
  await expect(minutes(page)).toHaveValue('9')
  const calls = await page.evaluate(() => (window as any).googleCalls)
  expect(calls.map((c: any) => c.travelMode)).toEqual([
    'WALKING',
    'TRANSIT',
    'DRIVING',
  ])
  expect(calls[2].routingPreference).toBe('TRAFFIC_AWARE_OPTIMAL')
  expect((await state(page)).days[0][1].transfer).toBeUndefined()
})

test('직접 입력 시간은 자동 응답·재계산·재시작으로 덮어쓰지 않음', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveValue('13')
  await minutes(page).fill('7')
  await mode(page).selectOption('transit')
  await expect
    .poll(() => page.evaluate(() => (window as any).googleCalls.length))
    .toBe(2)
  await expect(minutes(page)).toHaveValue('7')
  await page
    .getByRole('button', { name: '이동시간 다시 계산', exact: true })
    .click()
  await expect
    .poll(() => page.evaluate(() => (window as any).googleCalls.length))
    .toBe(3)
  await expect(minutes(page)).toHaveValue('7')
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '이동시간')
  await expect(minutes(page)).toHaveValue('7')
  expect((await state(page)).days[0][0].note).toBe('개인 메모')
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
  await expect(minutes(page)).toHaveValue('')
  await page.evaluate(() => (window as any).googleRequestsPending.shift()())
  await expect(minutes(page)).toHaveValue('22')
})

test('경로 실패·누락 응답은 추정값으로 채우지 않고 직접 입력과 재시도 유지', async ({
  page,
}) => {
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).googleRouteFailure = true
  })
  await openWorkspace(page, '이동시간')
  await expect(
    page.getByText(/Google 이동시간을 가져오지 못했어요/),
  ).toBeVisible()
  await expect(minutes(page)).toHaveValue('')
  await page.evaluate(() => {
    ;(window as any).googleRouteFailure = false
  })
  await page
    .getByRole('button', { name: '이동시간 다시 계산', exact: true })
    .click()
  await expect(minutes(page)).toHaveValue('13')
})

test('위치 없는 구간은 건너뛰어 연결하거나 이동시간을 만들지 않음', async ({
  page,
}) => {
  await seed(page, true)
  await openWorkspace(page, '이동시간')
  await expect(
    page.getByText('두 장소의 위치를 추가하면 자동 계산할 수 있어요.', {
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
  await expect(
    page.getByText(/Google 이동시간 계산이 지연됩니다/),
  ).toBeVisible()
  await expect(minutes(page)).toHaveValue('')
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
