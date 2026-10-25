import { test, expect, type Page } from '@playwright/test'
import {
  openTrips,
  openWorkspace,
  openScheduleEditor,
  openScheduleFilters,
} from './navigation'
import { googleMapsFixture } from './google-maps-fixture'
import { tripSchema, type Trip } from '../src/travel-model'
import {
  applyScheduleOrder,
  emptyScheduleFilter,
  matchesSchedule,
  scheduleFiles,
  scheduleStatus,
  scheduleSummary,
} from '../src/schedule-list'
import { portableTrip } from '../src/TravelBackup'
const fileId = '4c98ed15-91b2-4930-9d9f-5d39fb366ffd'
function fixture(): Trip {
  const place = (name: string, kind: '관광' | '맛집' | '카페' = '관광') => ({
    name,
    kind,
    address: '교토 Kyoto',
    destinationId: 'kyoto',
    link: '',
  })
  return tripSchema.parse({
    id: 'schedule-upgrade',
    title: '교토 일정 목록',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 2,
    days: [
      [
        {
          id: 'done',
          placeId: 'done-place',
          time: '09:00',
          note: '완료 메모',
          custom: place('완료한 사찰'),
          status: 'done',
        },
        {
          id: 'lunch',
          placeId: 'lunch-place',
          time: '12:00',
          note: '창가 자리 예약\n채식 메뉴 문의',
          custom: place('강변 점심', '맛집'),
          reservationId: 'booking',
          durationMinutes: 45,
          photoId: fileId,
        },
        {
          id: 'cafe',
          placeId: 'cafe-place',
          time: '10:30',
          note: '말차 디저트',
          custom: place('골목 카페', '카페'),
        },
        {
          id: 'skipped',
          placeId: 'skip-place',
          time: '20:00',
          note: '건너뜀 메모',
          custom: place('쉬어가는 공원'),
          status: 'skipped',
        },
        {
          id: 'cancelled',
          placeId: 'cancel-place',
          time: '23:00',
          note: '취소 메모',
          custom: place('취소된 공연'),
          reservationId: 'cancelled-booking',
        },
      ],
      [
        {
          id: 'tomorrow',
          placeId: 'tomorrow-place',
          time: '11:00',
          note: '다른 날 기록',
          custom: place('내일 산책'),
        },
      ],
    ],
    reservations: [
      {
        id: 'booking',
        title: '점심 창가 예약',
        kind: '기타',
        date: '2026-11-01',
        time: '12:00',
        reference: 'PRIVATE-REF',
        address: '교토',
        link: '',
        note: '예약 원본',
        status: 'confirmed',
      },
      {
        id: 'cancelled-booking',
        title: '취소 공연 예약',
        kind: '체험',
        date: '2026-11-01',
        time: '23:00',
        reference: '',
        address: '',
        link: '',
        note: '',
        status: 'cancelled',
      },
    ],
    attachments: [
      {
        id: fileId,
        name: '식당 확인서.png',
        mimeType: 'image/png',
        size: 67,
        createdAt: '2026-10-18T00:00:00.000Z',
        storage: 'browser',
        stopId: 'lunch',
        reservationId: 'booking',
      },
    ],
    expenses: [
      {
        id: 'meal',
        title: '예약금',
        date: '2026-11-01',
        amount: 1000,
        currency: 'JPY',
        category: '식비',
        note: '보존',
        payer: '나',
      },
    ],
    checklist: [{ id: 'passport', title: '여권', done: false }],
  })
}
async function seed(page: Page, trip = fixture()) {
  await googleMapsFixture(page)
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
  await openTrips(page)
  await openWorkspace(page, '일정')
  await openScheduleEditor(page)
  await openScheduleFilters(page)
}
const state = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
const ids = (page: Page) =>
  page
    .locator('.timeline [data-stop-id]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-stop-id')))

test('하루 요약은 제외 일정을 분리하고 다음 예정은 실제 방문 순서로 고름', () => {
  const trip = fixture(),
    summary = scheduleSummary(trip, 0)
  expect(summary).toMatchObject({
    planned: 2,
    done: 1,
    excluded: 2,
    firstTime: '09:00',
    lastTime: '12:00',
  })
  expect(summary.next?.id).toBe('lunch')
  trip.days[0][4].status = 'done'
  expect(scheduleStatus(trip, trip.days[0][4])).toBe('excluded')
  expect(scheduleSummary({ ...trip, days: [[]] }, 0)).toMatchObject({
    planned: 0,
    done: 0,
    excluded: 0,
    next: undefined,
    firstTime: undefined,
  })
})
test('메모·예약·자료 다중 검색은 현재 상태·분류와 함께 로컬로 처리', () => {
  const trip = fixture(),
    stop = trip.days[0][1]
  expect(scheduleFiles(trip, stop)).toHaveLength(1)
  expect(
    matchesSchedule(trip, stop, {
      query: '창가 확인서',
      status: 'planned',
      category: '맛집',
    }),
  ).toBe(true)
  expect(
    matchesSchedule(trip, stop, {
      ...emptyScheduleFilter,
      query: '채식 KYOTO',
    }),
  ).toBe(true)
  expect(
    matchesSchedule(trip, stop, { ...emptyScheduleFilter, status: 'done' }),
  ).toBe(false)
  expect(
    matchesSchedule(trip, stop, {
      ...emptyScheduleFilter,
      query: 'PRIVATE-REF',
    }),
  ).toBe(false)
})
test('순서 적용·되돌리기는 이후 메모와 시각·사진·첨부·예약·가계부·백업을 보존', () => {
  const trip = fixture(),
    before = trip.days[0].map((stop) => stop.id),
    after = [...before].reverse(),
    change = { day: 0, before, after }
  const next = applyScheduleOrder(trip, change)
  expect(next.days[0].map((stop) => stop.id)).toEqual(after)
  next.days[0].find((stop) => stop.id === 'lunch')!.note = '나중에 수정한 메모'
  next.days[0].find((stop) => stop.id === 'lunch')!.time = '12:30'
  const restored = applyScheduleOrder(next, change, true)
  expect(restored.days[0][1]).toMatchObject({
    id: 'lunch',
    time: '12:30',
    note: '나중에 수정한 메모',
    photoId: fileId,
    reservationId: 'booking',
  })
  expect(restored.days[1]).toEqual(trip.days[1])
  expect(restored.attachments).toEqual(trip.attachments)
  expect(restored.reservations).toEqual(trip.reservations)
  expect(restored.expenses).toEqual(trip.expenses)
  expect(tripSchema.parse(JSON.parse(JSON.stringify(restored))).days).toEqual(
    restored.days,
  )
  expect(tripSchema.parse(portableTrip(restored)).days).toEqual(
    restored.days.map((stops) =>
      stops.map(({ photoId: _photo, ...stop }) => stop),
    ),
  )
})
test('중복·누락·다른 구간·이후 순서 변경은 적용 또는 과거 되돌리기를 거부', () => {
  const trip = fixture(),
    before = trip.days[0].map((stop) => stop.id)
  for (const after of [
    before.slice(1),
    before.map(() => before[0]),
    [...before.slice(1), 'unknown'],
  ])
    expect(() => applyScheduleOrder(trip, { day: 0, before, after })).toThrow()
  const change = { day: 0, before, after: [...before].reverse() }
  expect(() => applyScheduleOrder(trip, change, true)).toThrow(/순서/)
  expect(() => applyScheduleOrder(trip, { ...change, day: 99 })).toThrow()
  const changed = applyScheduleOrder(trip, change)
  changed.days[0] = changed.days[0].slice(1)
  expect(() => applyScheduleOrder(changed, change, true)).toThrow()
})

test('간단 보기에서도 메모·연결 예약·자료가 보이며 원본 화면으로 이동', async ({
  page,
}) => {
  await seed(page)
  await page
    .getByRole('button', { name: '일정 목록 편집', exact: true })
    .click()
  const card = page.locator('[data-stop-id="lunch"]')
  await expect(card.locator('.schedule-note-preview')).toContainText(
    '채식 메뉴 문의',
  )
  await card.getByRole('button', { name: '강변 점심 연결 예약 열기' }).click()
  await expect(page.locator('[data-reservation-id="booking"]')).toBeFocused()
  await openWorkspace(page, '일정')
  await page.getByRole('button', { name: '강변 점심 자료 1개 열기' }).click()
  await expect(page.locator(`[data-attachment-id="${fileId}"]`)).toBeFocused()
  expect((await state(page)).attachments).toEqual(fixture().attachments)
})

test('날짜 이동은 그 날짜의 전체 기록을 표시', async ({
  page,
}) => {
  await seed(page)
  await page
    .getByRole('tablist', { name: '여행 날짜' })
    .getByRole('tab')
    .nth(1)
    .click()
  expect(await ids(page)).toEqual(['tomorrow'])
  await page
    .getByRole('tablist', { name: '여행 날짜' })
    .getByRole('tab')
    .nth(0)
    .click()
  expect(await ids(page)).toHaveLength(5)
})
test('순서 편집 취소·임의 순번 적용·재시작에서 시각과 개인 기록 보존', async ({
  page,
}) => {
  await seed(page)
  const before = await state(page)
  await page.getByRole('button', { name: '순서 편집', exact: true }).click()
  await page
    .getByLabel('골목 카페 방문 순번', { exact: true })
    .selectOption('0')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect(await state(page)).toEqual(before)
  await page.getByRole('button', { name: '순서 편집', exact: true }).click()
  await page
    .getByLabel('골목 카페 방문 순번', { exact: true })
    .selectOption('0')
  await page.getByRole('button', { name: '순서 적용', exact: true }).click()
  const after = await state(page)
  expect(after.days[0].map((stop: any) => stop.id)).toEqual([
    'cafe',
    'done',
    'lunch',
    'skipped',
    'cancelled',
  ])
  expect(after.days[0].find((stop: any) => stop.id === 'lunch')).toEqual(
    before.days[0][1],
  )
  await page.reload()
  await openTrips(page)
  expect(await ids(page)).toEqual([
    'cafe',
    'done',
    'lunch',
    'skipped',
    'cancelled',
  ])
  expect(await state(page)).toEqual(after)
})
test('시간순 정렬 되돌리기는 나중에 수정한 메모를 덮어쓰지 않음', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('button', { name: '시간순 정렬', exact: true }).click()
  expect(await ids(page)).toEqual([
    'done',
    'cafe',
    'lunch',
    'skipped',
    'cancelled',
  ])
  await page
    .locator('[data-stop-id="lunch"] .stop-edit-details > summary')
    .click()
  await page
    .getByLabel('강변 점심 메모', { exact: true })
    .fill('정렬 뒤 추가한 메모')
  await page
    .getByRole('button', { name: '순서 변경 되돌리기', exact: true })
    .click()
  expect(await ids(page)).toEqual([
    'done',
    'lunch',
    'cafe',
    'skipped',
    'cancelled',
  ])
  expect((await state(page)).days[0][1].note).toBe('정렬 뒤 추가한 메모')
})

test('전체 일정 조회는 오프라인에서도 가능하고 Google 경로를 자동 요청하지 않음', async ({
  page,
}) => {
  await seed(page)
  await page.context().setOffline(true)
  await expect(page.locator('.timeline-find')).toHaveCount(0)
  expect(await ids(page)).toHaveLength(5)
  expect(await page.evaluate(() => (window as any).googleCalls.length)).toBe(0)
  await page.context().setOffline(false)
})
test('320px·큰 글자·긴 메모에서도 요약·순서 편집의 버튼과 금액/자료 보존', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const trip = fixture()
  trip.days[0][1].note =
    '길고 자세한 개인 메모와 중요한 식사 요청을 보존합니다. '.repeat(50)
  await seed(page, trip)
  await page.addStyleTag({
    content:
      '.timeline-day-heading,.timeline-day-heading button,.schedule-order-dialog {font-size:18px!important}',
  })
  await page.locator('.timeline-day-heading').scrollIntoViewIfNeeded()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  for (const button of await page.locator('.timeline-day-heading button').all())
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(
      44 * 0.9 - 0.1,
    )
  await page.screenshot({ path: info.outputPath('schedule-320.png') })
  await page.getByRole('button', { name: '순서 편집', exact: true }).click()
  await page
    .getByLabel('강변 점심 방문 순번', { exact: true })
    .selectOption('4')
  const dialog = page.getByRole('dialog', { name: '방문 순서 편집' })
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  )
  await page.screenshot({ path: info.outputPath('schedule-order-320.png') })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect((await state(page)).expenses).toEqual(trip.expenses)
  expect((await state(page)).attachments).toEqual(trip.attachments)
  expect((await state(page)).days[0][1].note).toBe(trip.days[0][1].note)
})
