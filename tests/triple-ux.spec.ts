import { test, expect, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import {
  moveScheduleStops,
  scheduleMoveRecord,
  undoScheduleMove,
} from '../src/schedule-move'
import {
  openTrips,
  openScheduleEditor,
  openWorkspace,
  openScheduleFilters,
} from './navigation'
import { googleMapsFixture } from './google-maps-fixture'
function fixture(): Trip {
  return tripSchema.parse({
    id: 'ux-trip',
    title: '천천히 둘러보는 교토',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-14',
    travelers: 1,
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:15',
          note: '원래 메모',
          status: 'done',
        },
        {
          id: 'custom',
          placeId: 'custom-cafe',
          time: '12:30',
          note: '예약해 둔 자리',
          custom: {
            name: '내가 등록한 골목 카페',
            kind: '카페',
            destinationId: 'kyoto',
            address: 'Kyoto',
            link: 'https://example.com/cafe',
            coordinates: { lat: 35, lng: 135 },
          },
        },
      ],
      ...Array.from({ length: 13 }, () => []),
    ],
  })
}
async function seed(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
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
    fixture(),
  )
  await page.reload()
  await openTrips(page)
}
async function current(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}

test('여러 일정은 한 번에 이동하며 최근 메모·사진 참조와 순서를 되돌림', () => {
  const trip = fixture()
  const photoId = '4c98ed15-91b2-4930-9d9f-5d39fb366ffd'
  trip.attachments = [
    {
      id: photoId,
      name: '개인 사진.png',
      mimeType: 'image/png',
      size: 67,
      createdAt: '2026-10-23T00:00:00.000Z',
      storage: 'browser',
      stopId: 'temple',
      reservationId: 'booking',
    },
  ]
  trip.reservations = [
    {
      id: 'booking',
      title: '입장 예약',
      kind: '체험',
      date: '2026-11-01',
      time: '10:15',
      reference: 'PRIVATE-TEST',
      address: '',
      link: '',
      note: '예약 원본',
      status: 'confirmed',
    },
  ]
  trip.expenses = [
    {
      id: 'payment',
      title: '입장료',
      date: '2026-11-01',
      amount: 1000,
      currency: 'JPY',
      category: '관광',
      note: '경비 원본',
      payer: '나',
    },
  ]
  trip.days[0][0] = { ...trip.days[0][0], photoId, reservationId: 'booking' }
  const moved = moveScheduleStops(trip, 0, 1, ['custom', 'temple'])
  expect(moved.attachments).toBe(trip.attachments)
  expect(moved.reservations).toBe(trip.reservations)
  expect(moved.expenses).toBe(trip.expenses)
  expect(moved.days[0]).toEqual([])
  expect(moved.days[1].map((s) => s.id)).toEqual(['temple', 'custom'])
  expect(moved.days[1]).toEqual(trip.days[0])
  expect(trip.days[0]).toHaveLength(2)
  const change = scheduleMoveRecord(trip, moved, 0, 1, ['temple', 'custom'])
  moved.days[1][0] = {
    ...moved.days[1][0],
    note: '이동 후 최신 메모',
    time: '11:00',
  }
  const restored = undoScheduleMove(moved, change)
  expect(restored.days[0][0].note).toBe('이동 후 최신 메모')
  expect(restored.days[0][0].time).toBe('11:00')
  expect(restored.days[0][1].custom).toEqual(trip.days[0][1].custom)
  expect(restored.days[1]).toEqual([])
  expect(tripSchema.safeParse(restored).success).toBe(true)
})

test('중복·다른 도시·한도 초과·변경된 목록은 부분 이동하거나 덮어쓰지 않음', () => {
  const trip = fixture(),
    original = JSON.stringify(trip)
  expect(() => moveScheduleStops(trip, 0, 1, ['missing'])).toThrow('바뀌었어요')
  expect(() => moveScheduleStops(trip, 0, 1, ['temple', 'temple'])).toThrow()
  const duplicate = {
    ...trip,
    days: trip.days.map((stops, i) =>
      i === 1 ? [{ ...trip.days[0][0], id: 'duplicate' }] : stops,
    ),
  }
  expect(() =>
    moveScheduleStops(duplicate, 0, 1, ['temple', 'custom']),
  ).toThrow('같은 장소')
  const otherCity = tripSchema.parse({
    ...trip,
    destinations: [
      { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
      { id: 'osaka', name: '오사카', country: '일본', guideCityId: 'osaka' },
    ],
    dayDestinationIds: trip.days.map((_, i) => (i === 1 ? 'osaka' : 'kyoto')),
  })
  expect(() =>
    moveScheduleStops(otherCity, 0, 1, ['temple', 'custom']),
  ).toThrow('같은 도시')
  const full = {
    ...trip,
    days: trip.days.map((stops, i) =>
      i === 1
        ? Array.from({ length: 200 }, (_, j) => ({
            ...trip.days[0][1],
            id: `full-${j}`,
            placeId: `other-${j}`,
          }))
        : stops,
    ),
  }
  expect(() => moveScheduleStops(full, 0, 1, ['temple'])).toThrow('200곳')
  const moved = moveScheduleStops(trip, 0, 1, ['temple'])
  const change = scheduleMoveRecord(trip, moved, 0, 1, ['temple'])
  moved.days[1] = []
  expect(() => undoScheduleMove(moved, change)).toThrow('바뀌어')
  expect(JSON.stringify(trip)).toBe(original)
})

test('14일 날짜 이동·키보드 탐색·개수 표시는 원본을 바꾸지 않음', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await seed(page)
  const before = await current(page)
  const tabs = page.getByRole('tablist', { name: '여행 날짜', exact: true })
  await expect(tabs.getByRole('tab').first().locator('small')).toHaveText('2곳')
  await page.addStyleTag({
    content:
      '.day-tab strong,.day-tab span,.day-tab small { font-size: 20px !important; }',
  })
  await page.getByLabel('일정 날짜 바로 이동').selectOption('13')
  const last = tabs.getByRole('tab').last()
  await expect(last).toHaveAttribute('aria-selected', 'true')
  await expect(last).toBeInViewport()
  await expect(
    page.getByRole('button', { name: '다음 여행일', exact: true }),
  ).toBeDisabled()
  await last.focus()
  await page.keyboard.press('Home')
  await expect(tabs.getByRole('tab').first()).toBeFocused()
  await expect(tabs.getByRole('tab').first()).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('button', { name: '다음 여행일', exact: true }).click()
  await expect(tabs.getByRole('tab').nth(1).locator('small')).toHaveText(
    '비어 있음',
  )
  expect(await current(page)).toEqual(before)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('담은 장소를 확인하고 목록으로 복귀·중복 방지·재실행 보존', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const action = dialog.getByRole('button', { name: '일정 보기', exact: true })
  await expect(action).toBeInViewport({ ratio: 1 })
  const dialogBox = await dialog.boundingBox(),
    actionBox = await action.boundingBox()
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(
    dialogBox!.y + dialogBox!.height,
  )
  await dialog.getByLabel('일정에 추가할 장소 검색').fill('니시키')
  await dialog
    .getByRole('button', { name: '니시키 시장 일정에 추가', exact: true })
    .click()
  const summary = dialog.getByLabel('이날 담은 장소')
  await expect(summary).toContainText('이번에 1곳 추가했어요')
  await expect(page.locator('.toast')).toHaveCount(0)
  await expect(summary.getByLabel('이번에 추가한 장소')).toContainText(
    '니시키 시장',
  )
  await expect(
    dialog.getByRole('button', { name: '니시키 시장 추가됨', exact: true }),
  ).toBeDisabled()
  await summary.getByRole('button', { name: '일정 보기', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('.timeline-item').last()).toContainText(
    '니시키 시장',
  )
  await page.reload()
  await openTrips(page)
  await expect(page.locator('.timeline-item')).toHaveCount(3)
})

test('편집에서 여러 일정을 선택·날짜 이동·메모 유지·최신 내용으로 되돌림', async ({
  page,
}) => {
  await seed(page)
  await openScheduleEditor(page)
  await page.getByLabel('기요미즈데라 일정 선택', { exact: true }).check()
  await page
    .getByLabel('내가 등록한 골목 카페 일정 선택', { exact: true })
    .check()
  await page.getByLabel('선택한 일정 옮길 날짜').selectOption('1')
  await page.getByRole('button', { name: '날짜로 이동', exact: true }).click()
  await expect(
    page
      .getByRole('tablist', { name: '여행 날짜', exact: true })
      .getByRole('tab')
      .nth(1),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.timeline-item')).toHaveCount(2)
  expect((await current(page)).days[1].map((s: any) => s.id)).toEqual([
    'temple',
    'custom',
  ])
  const note = page.locator(
    '[data-stop-id="temple"] .stop-edit-details > summary',
  )
  await note.click()
  await page
    .getByLabel('기요미즈데라 메모', { exact: true })
    .fill('이동한 뒤 쓴 메모')
  await page
    .getByRole('button', { name: '날짜 이동 되돌리기', exact: true })
    .click()
  expect((await current(page)).days[0][0].note).toBe('이동한 뒤 쓴 메모')
  expect((await current(page)).days[1]).toEqual([])
})

test('필터가 바뀌면 이전 선택을 해제해 숨은 일정까지 옮기지 않음', async ({
  page,
}) => {
  await seed(page)
  await openScheduleEditor(page)
  await page
    .getByRole('button', { name: '보이는 일정 모두 선택', exact: true })
    .click()
  await openScheduleFilters(page)
  await page.getByLabel('이날 일정 검색').fill('골목')
  await expect(
    page.getByRole('region', { name: '선택한 일정 관리' }),
  ).toContainText('0개 선택')
  await page
    .getByRole('button', { name: '보이는 일정 모두 선택', exact: true })
    .click()
  await page.getByLabel('선택한 일정 옮길 날짜').selectOption('1')
  await page.getByRole('button', { name: '날짜로 이동', exact: true }).click()
  const saved = await current(page)
  expect(saved.days[0].map((s: any) => s.id)).toEqual(['temple'])
  expect(saved.days[1].map((s: any) => s.id)).toEqual(['custom'])
})

test('지도에서 장소를 담아도 선택한 날짜의 일정 목록으로 복귀', async ({
  page,
}) => {
  await googleMapsFixture(page)
  await seed(page)
  await openWorkspace(page, '동선')
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByLabel('일정에 추가할 장소 검색')
    .fill('니시키')
  await page
    .getByRole('button', { name: '니시키 시장 일정에 추가', exact: true })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '일정 보기', exact: true })
    .click()
  await expect(
    page
      .getByRole('group', { name: '일정 보기', exact: true })
      .getByRole('button', { name: '일정 목록', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.timeline-item').last()).toContainText(
    '니시키 시장',
  )
})

test('320px·낮은 화면에서도 담기 결과와 복귀 버튼 전체가 보임', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 470 })
  await seed(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const button = dialog.getByRole('button', { name: '일정 보기', exact: true })
  await expect(button).toBeInViewport({ ratio: 1 })
  const box = await button.boundingBox(),
    modal = await dialog.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(44)
  expect(box!.y + box!.height).toBeLessThanOrEqual(modal!.y + modal!.height)
  await dialog.getByLabel('일정에 추가할 장소 검색').fill('니시키')
  await dialog
    .getByRole('button', { name: '니시키 시장 일정에 추가', exact: true })
    .click()
  await expect(dialog.getByLabel('이날 담은 장소')).toContainText(
    '이번에 1곳 추가했어요',
  )
  await expect(button).toBeInViewport({ ratio: 1 })
  await button.click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test('기존 백업의 임의 일정 ID도 날짜 참조를 바꾸지 않고 되돌림', () => {
  const trip = fixture()
  trip.days[1] = [
    { ...trip.days[0][1], id: 'toString', placeId: 'another-custom' },
  ]
  const moved = moveScheduleStops(trip, 0, 1, ['temple'])
  const change = scheduleMoveRecord(trip, moved, 0, 1, ['temple'])
  const restored = undoScheduleMove(moved, change)
  expect(restored.days[1][0].custom!.destinationId).toBe('kyoto')
  expect(tripSchema.safeParse(restored).success).toBe(true)
})
