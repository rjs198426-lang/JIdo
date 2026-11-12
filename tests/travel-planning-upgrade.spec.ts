import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { tripSchema, type Trip } from '../src/travel-model'
import { localClock } from '../src/destination-time'
import { stopMatchesCustom } from '../src/registered-places'
import { fullManifest } from '../src/full-backup'
import { canonicalSnapshot, emptySyncSnapshot } from '../src/sync-model'
import { performance } from 'node:perf_hooks'
const fixture = (): Trip =>
  tripSchema.parse({
    id: 'planner-user',
    title: '겨울 괌 여행',
    cityId: 'guam',
    startDate: '2026-12-22',
    endDate: '2026-12-24',
    travelers: 1,
    days: [
      [
        {
          id: 'beach',
          placeId: 'guam-tumon-beach',
          time: '',
          note: '원래 메모',
        },
      ],
      [],
      [],
    ],
    reservations: [
      {
        id: 'flight',
        title: '인천에서 괌',
        kind: '항공',
        date: '2026-12-22',
        time: '20:00',
        reference: 'EXAMPLE123',
        address: '',
        note: '',
        link: '',
        status: 'confirmed',
        flight: {
          airline: '테스트 항공',
          number: 'JD123',
          departureAirport: 'ICN',
          arrivalAirport: 'GUM',
          arrivalDate: '2026-12-23',
          arrivalTime: '02:00',
          departureTimeZone: 'Asia/Seoul',
          arrivalTimeZone: 'Pacific/Guam',
        },
      },
      {
        id: 'hotel',
        title: '괌 해변 호텔',
        kind: '숙소',
        date: '2026-12-23',
        endDate: '2026-12-24',
        time: '',
        reference: 'HOTEL456',
        address: '예시 주소',
        link: '',
        note: '조식 포함',
        status: 'pending',
        stay: { contact: '예시 연락처', guestName: '예시 투숙자' },
      },
    ],
    expenses: [],
    checklist: [],
    attachments: [],
  })
const store = (trips = [fixture()], placeLibrary?: any) => ({
  version: 1,
  savedCities: [],
  savedPlaces: [],
  trips,
  ...(placeLibrary ? { placeLibrary } : {}),
})
async function boot(page: Page, data = store()) {
  const outside: string[] = []
  await page.clock.setFixedTime(new Date('2026-11-12T03:00:00Z'))
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('planning-upgrade-seeded')) {
      localStorage.setItem('jido-travel-v1', JSON.stringify(data))
      localStorage.setItem('jdo-active-trip-v1', data.trips[0]?.id || '')
      sessionStorage.setItem('planning-upgrade-seeded', 'yes')
    }
  }, data)
  await page.route('**/*', (r) => {
    if (r.request().url().startsWith('http://127.0.0.1:')) return r.continue()
    outside.push(r.request().url())
    return r.abort()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'J★Do 홈' }).waitFor()
  return outside
}
const current = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('jido-travel-v1')!))
const nav = (page: Page, name: string) =>
  page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
async function openLibrary(page: Page) {
  await nav(page, '내 여행')
  const card = page.locator('.trip-library [data-trip-id="planner-user"]')
  if (await card.isVisible()) await card.click()
  await page.getByRole('button', { name: '장소 보관함', exact: true }).click()
  return page.getByRole('dialog')
}
async function savePlace(page: Page, name = '아직 날짜를 정하지 않은 카페') {
  const d = await openLibrary(page)
  await d.getByRole('button', { name: '장소 보관하기', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('장소 이름', { exact: true })
    .fill(name)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('장소 보관함')
  return page.getByRole('dialog')
}
test('collect a place before choosing a visit day; adding it later preserves the original schedule and leaves the time empty', async ({
  page,
}) => {
  const outside = await boot(page),
    before = await current(page)
  const d = await savePlace(page)
  let data = await current(page)
  expect(data.trips).toEqual(before.trips)
  expect(data.placeLibrary.entries).toHaveLength(1)
  await d.getByLabel('보관한 장소를 넣을 날짜').selectOption('1')
  await d
    .getByRole('button', {
      name: '아직 날짜를 정하지 않은 카페 선택한 날짜에 추가',
      exact: true,
    })
    .click()
  await expect(
    d.getByRole('button', {
      name: '아직 날짜를 정하지 않은 카페 추가됨',
      exact: true,
    }),
  ).toBeDisabled()
  data = await current(page)
  expect(data.trips[0].days[0]).toEqual(before.trips[0].days[0])
  expect(data.trips[0].days[1]).toHaveLength(1)
  expect(data.trips[0].days[1][0]).toMatchObject({ time: '', note: '' })
  expect(data.trips[0].days[1][0].custom.coordinates).toBeUndefined()
  await d
    .getByRole('button', { name: '선택한 날짜의 일정 보기', exact: true })
    .click()
  await expect(page.getByRole('tab', { name: /DAY 2 ·/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.reload()
  expect((await current(page)).placeLibrary.entries).toHaveLength(1)
  expect(outside).toEqual([])
})
test('editing or deleting a saved place never rewrites the schedule already made from it', async ({
  page,
}) => {
  await boot(page)
  let d = await savePlace(page, '처음 보관한 장소')
  await d
    .getByRole('button', {
      name: '처음 보관한 장소 선택한 날짜에 추가',
      exact: true,
    })
    .click()
  const planned = (await current(page)).trips
  await d
    .getByRole('button', {
      name: '처음 보관한 장소 보관 정보 수정',
      exact: true,
    })
    .click()
  d = page.getByRole('dialog')
  await d.getByLabel('장소 이름', { exact: true }).fill('수정한 보관 이름')
  await d.getByRole('button', { name: '장소 수정 저장', exact: true }).click()
  d = page.getByRole('dialog')
  expect((await current(page)).trips).toEqual(planned)
  await d
    .getByRole('button', {
      name: '수정한 보관 이름 보관함에서 삭제',
      exact: true,
    })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '취소', exact: true })
    .click()
  expect((await current(page)).placeLibrary.entries).toHaveLength(1)
  await page
    .getByRole('dialog')
    .getByRole('button', {
      name: '수정한 보관 이름 보관함에서 삭제',
      exact: true,
    })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '목록에서 삭제', exact: true })
    .click()
  expect((await current(page)).placeLibrary.entries).toHaveLength(0)
  expect((await current(page)).trips).toEqual(planned)
})
test('saved-place quota failure keeps input and retry stores exactly once', async ({
  page,
}) => {
  await boot(page)
  const d = await openLibrary(page)
  await d.getByRole('button', { name: '장소 보관하기', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('장소 이름', { exact: true })
    .fill('공간이 부족해도 지킬 장소')
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    ;(window as any).restorePlanningStorage = () => {
      Storage.prototype.setItem = original
    }
    Storage.prototype.setItem = function (key, value) {
      if (key === 'jido-travel-v1')
        throw new DOMException('full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  await expect(
    page.getByRole('dialog').getByLabel('장소 이름', { exact: true }),
  ).toHaveValue('공간이 부족해도 지킬 장소')
  expect((await current(page)).placeLibrary?.entries || []).toHaveLength(0)
  await page.evaluate(() => (window as any).restorePlanningStorage())
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '장소 목록에 저장', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveAccessibleName('장소 보관함')
  expect((await current(page)).placeLibrary.entries).toHaveLength(1)
})
test('old catalog-origin places cannot be duplicated on the same day when reused', async ({
  page,
}) => {
  await boot(page)
  const d = await openLibrary(page)
  await d.getByText(/이전 일정의 장소 다시 쓰기/).click()
  await expect(
    d.getByRole('button', { name: '투몬 비치 추가됨', exact: true }),
  ).toBeDisabled()
  expect(
    stopMatchesCustom(fixture().days[0][0], {
      name: '투몬 비치',
      kind: '관광',
      destinationId: 'guam',
      address: '',
      link: '',
      catalogPlaceId: 'guam-tumon-beach',
    }),
  ).toBe(true)
  await d.getByLabel('보관한 장소를 넣을 날짜').selectOption('2')
  await d
    .getByRole('button', { name: '투몬 비치 선택한 날짜에 추가', exact: true })
    .click()
  const data = await current(page)
  expect(data.trips[0].days[0]).toHaveLength(1)
  expect(data.trips[0].days[2]).toHaveLength(1)
  expect(data.trips[0].days[2][0].note).toBe('')
  expect(data.trips[0].days[2][0].time).toBe('')
})
test('direct reservation and expense pages omit repeated trip menus, survive restart, and lead back to planning', async ({
  page,
}, info) => {
  await boot(page)
  const before = await current(page)
  await nav(page, '예약')
  await expect(
    page.getByRole('tablist', { name: '여행 관리', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('group', { name: '준비 관리', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '호텔 예약 추가', exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: info.outputPath('after-reservations.png') })
  await page.reload()
  await expect(
    page.getByRole('tablist', { name: '여행 관리', exact: true }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '일정으로 돌아가기', exact: true }),
  ).toBeVisible()
  await nav(page, '경비')
  await expect(
    page.getByRole('tab', { name: '정산', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('tablist', { name: '여행 관리', exact: true }),
  ).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('after-expenses.png') })
  await nav(page, '내 여행')
  await expect(
    page.getByRole('tab', { name: '일정', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  expect(await current(page)).toEqual(before)
})
test('reservation search finds combined flight details and booking references locally without changing records', async ({
  page,
}) => {
  const outside = await boot(page)
  const before = await current(page)
  await nav(page, '예약')
  const search = page.getByLabel('예약 검색', { exact: true })
  await search.fill('테스트 JD123')
  await expect(page.locator('.reservation-list > article')).toHaveCount(1)
  await expect(page.locator('[data-reservation-id="flight"]')).toBeVisible()
  await search.fill('HOTEL456')
  await expect(page.locator('.reservation-list > article')).toHaveCount(1)
  await expect(page.locator('[data-reservation-id="hotel"]')).toBeVisible()
  await search.fill('존재하지 않는 예약')
  await expect(page.locator('.reservation-list > article')).toHaveCount(0)
  await expect(
    page.getByRole('status').filter({ hasText: '일치하는 예약이 없어요' }),
  ).toBeVisible()
  await search.fill('HOTEL456')
  await page.getByLabel('예약 상태 필터').selectOption('확정')
  await expect(page.locator('.reservation-list > article')).toHaveCount(0)
  await expect(
    page.getByRole('status').filter({ hasText: '일치하는 예약이 없어요' }),
  ).toBeVisible()
  await page.getByLabel('예약 상태 필터').selectOption('전체')
  await search.fill('')
  await expect(page.locator('.reservation-list > article')).toHaveCount(2)
  expect(await current(page)).toEqual(before)
  expect(outside).toEqual([])
})
test('overview is discoverable above the days, shows untimed places and bookings separately, and opens an empty day', async ({
  page,
}, info) => {
  await boot(page)
  await nav(page, '내 여행')
  const overview = page.locator('.trip-overview')
  await expect(page.locator('.trip-more .trip-overview')).toHaveCount(0)
  const overviewBox = await overview.boundingBox()
  const dateBox = await page.locator('.day-navigation').boundingBox()
  expect(overviewBox!.y + overviewBox!.height).toBeLessThanOrEqual(
    dateBox!.y + 1,
  )
  await expect(overview.getByRole('button')).toHaveCount(0)
  await overview.locator('summary').click()
  await expect(overview).toContainText('시간 미정 1곳')
  await expect(overview).toContainText('예약 2건')
  await page.screenshot({ path: info.outputPath('after-overview.png') })
  await overview
    .getByRole('button', { name: 'DAY 3 괌 일정 열기', exact: true })
    .click()
  await expect(page.getByRole('tab', { name: /DAY 3 ·/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect((await current(page)).trips[0].days[2]).toEqual([])
})
test('common time zones use readable city choices and changing an automatic country does not keep stale metadata', async ({
  page,
}) => {
  await boot(page, store([]))
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const d = page.getByRole('dialog')
  await d.getByLabel('여행 도시', { exact: true }).fill('괌')
  await expect(d.getByLabel('국가', { exact: true })).toHaveValue('미국령 괌')
  await d.getByLabel('여행 도시', { exact: true }).fill('내가 정한 도시')
  await expect(d.getByLabel('국가', { exact: true })).toHaveValue('')
  await d.getByLabel('국가', { exact: true }).fill('일본')
  await d.getByLabel('여행 도시', { exact: true }).fill('또 다른 도시')
  await expect(d.getByLabel('국가', { exact: true })).toHaveValue('일본')
  await d.locator('.create-options > summary').click()
  await d.getByLabel('현지 시간대', { exact: true }).selectOption('Asia/Tokyo')
  await expect(d.getByLabel('현지 시간대', { exact: true })).toContainText(
    '도쿄·오사카',
  )
  await d.getByRole('button', { name: '내 여행 만들기', exact: true }).click()
  expect((await current(page)).trips[0].destinations[0].timeZone).toBe(
    'Asia/Tokyo',
  )
})
test('large saved lists load in pages, search the full list and fit a 320px phone', async ({
  page,
}, info) => {
  const destination = {
    id: 'guam',
    name: '괌',
    country: '미국령 괌',
    guideCityId: 'guam',
  }
  const entries = Array.from({ length: 65 }, (_, i) => ({
    id: randomUUID(),
    custom: {
      name: `보관한 장소 ${i}`,
      kind: '카페',
      address: '',
      link: '',
      destinationId: 'guam',
    },
    destination,
    description: i === 10 ? '해 질 무렵 후보' : '내가 정한 후보',
    sourceKeys: [],
  }))
  await page.setViewportSize({ width: 320, height: 760 })
  const outside = await boot(page, store([fixture()], { entries, hidden: [] }))
  const d = await openLibrary(page)
  await expect(d.locator('.saved-place-row')).toHaveCount(30)
  await d.getByLabel('보관한 장소 검색').fill('해 질 무렵')
  await expect(d.locator('.saved-place-row')).toHaveCount(1)
  await expect(d.locator('.saved-place-row')).toContainText('보관한 장소 10')
  await d.getByLabel('보관한 장소 검색').fill('')
  await d.getByRole('button', { name: /보관한 장소 더 보기/ }).click()
  await expect(d.locator('.saved-place-row')).toHaveCount(60)
  expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
    true,
  )
  const action = d.locator('.saved-place-actions button').first()
  expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await d.locator('.saved-places').evaluate((el) => {
    el.scrollTop = 0
  })
  await d.evaluate((el) => { el.scrollTop = 0 })
  await page.screenshot({ path: info.outputPath('after-saved-places-320.png') })
  expect(outside).toEqual([])
})
test('saved places remain in the existing full-backup and synchronization format', async ({
  page,
}) => {
  await boot(page)
  await savePlace(page, '오프라인에서도 지킬 후보')
  const data = await current(page)
  const manifest = fullManifest(data.trips, data.placeLibrary)
  expect(manifest.placeLibrary?.entries[0].custom.name).toBe(
    '오프라인에서도 지킬 후보',
  )
  const snapshot = emptySyncSnapshot()
  snapshot.store = data
  expect(canonicalSnapshot(snapshot).store.placeLibrary).toEqual(
    data.placeLibrary,
  )
})
test('cached clocks preserve local dates and DST transitions; record repeated-clock work without a timing threshold', async ({}, info) => {
  const zones = [
    'Asia/Seoul',
    'Pacific/Guam',
    'Pacific/Honolulu',
    'America/New_York',
    'Europe/Paris',
  ]
  const date = new Date('2026-11-01T06:30:00Z')
  const start = performance.now()
  for (let i = 0; i < 100; i++)
    for (const zone of zones) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date)
      const part = (name: string) => parts.find((p) => p.type === name)!.value
      expect(localClock(date, zone)).toEqual({
        date: `${part('year')}-${part('month')}-${part('day')}`,
        time: `${part('hour')}:${part('minute')}`,
        minutes: Number(part('hour')) * 60 + Number(part('minute')),
      })
    }
  const baselineStart = performance.now()
  for (let i = 0; i < 500; i++)
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Guam',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
  const baselineMs = performance.now() - baselineStart
  const cachedStart = performance.now()
  for (let i = 0; i < 500; i++) localClock(date, 'Pacific/Guam')
  await info.attach('clock-work.json', {
    body: JSON.stringify({
      comparisons: 500,
      outputComparisonMs: baselineStart - start,
      freshFormatterMs: baselineMs,
      cachedFormatterMs: performance.now() - cachedStart,
    }),
    contentType: 'application/json',
  })
})
