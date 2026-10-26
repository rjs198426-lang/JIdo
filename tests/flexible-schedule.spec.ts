import { test, expect, type Page } from '@playwright/test'
import { tripSchema, stopSchema } from '../src/travel-model'
import { timeConflicts } from '../src/journey-progress'
import { transferLegs } from '../src/transfer-planning'
import { canAdjustStop } from '../src/schedule-adjust'
import { appendGuideCourse } from '../src/guide-course'
import { getPlace } from '../src/data'
import { openTrips, openWorkspace } from './navigation'
const fixture = () =>
  tripSchema.parse({
    id: 'flexible',
    title: '시간을 천천히 정하는 교토 여행',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 1,
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '',
          note: '원래 메모',
          durationMinutes: 60,
        },
      ],
      [],
    ],
    reservations: [
      {
        id: 'flight',
        title: '따로 관리하는 항공 예약',
        kind: '항공',
        date: '2026-11-01',
        time: '09:30',
        reference: 'sample',
        address: '공항',
        link: '',
        note: '예약 메모',
        status: 'confirmed',
      },
    ],
    expenses: [],
  })
async function seed(page: Page) {
  await page.goto('/')
  await page.evaluate(
    (t) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [t],
        }),
      ),
    fixture(),
  )
  await page.reload()
  await openTrips(page)
}
async function saved(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}
test('빈 방문 시간은 유효하며 충돌·지각·일괄 이동 계산에 가짜 자정을 만들지 않음', () => {
  expect(
    stopSchema.parse({ id: 'empty', placeId: 'kiyomizu', note: '' }).time,
  ).toBe('')
  expect(
    stopSchema.safeParse({
      id: 'bad',
      placeId: 'kiyomizu',
      note: '',
      time: '25:30',
    }).success,
  ).toBe(false)
  const t = fixture()
  t.days[0].push({
    id: 'later',
    placeId: 'fushimi',
    time: '',
    note: '',
    durationMinutes: 60,
  })
  expect(timeConflicts(t, 0)).toEqual([])
  expect(canAdjustStop(t, t.days[0][0])).toBe(false)
  expect(transferLegs(t.days[0])[0]).toMatchObject({
    arrival: undefined,
    lateMinutes: undefined,
  })
  const added = appendGuideCourse(
    t,
    'kyoto',
    ['fushimi', 'nishiki'],
    0,
    '',
    getPlace,
  )
  expect(added.added).toBe(1)
  expect(added.trip.days[0].every((s) => s.time === '')).toBe(true)
  expect(tripSchema.safeParse(added.trip).success).toBe(true)
})
test('장소 추가는 시간 없이 저장하고 편집에서 지정·삭제·재실행 보존', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('일정에 추가할 장소 검색').fill('니시키')
  await dialog
    .getByRole('button', { name: '니시키 시장 일정에 추가', exact: true })
    .click()
  await dialog.getByRole('button', { name: '일정 보기', exact: true }).click()
  expect((await saved(page)).days[0][1].time).toBe('')
  const card = page.locator('[data-stop-id]').filter({ hasText: '니시키 시장' })
  await card
    .getByRole('button', { name: '니시키 시장 일정 상세 펼치기', exact: true })
    .click()
  await card.getByLabel('니시키 시장 방문 시간', { exact: true }).fill('13:40')
  expect((await saved(page)).days[0][1].time).toBe('13:40')
  await card.getByLabel('니시키 시장 방문 시간', { exact: true }).fill('')
  await page.reload()
  await openTrips(page)
  expect((await saved(page)).days[0][1].time).toBe('')
  expect((await saved(page)).days[0][0].note).toBe('원래 메모')
  await expect(page.locator('.time-conflicts')).toHaveCount(0)
})
test('직접 추가도 시간 입력을 요구하지 않고 나중에 편집에서 설정', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('일정에 추가할 장소 검색').fill('나만의 작은 산책길')
  await dialog.getByRole('button', { name: /새 장소 추가/ }).click()
  await expect(page.getByLabel('방문 시간', { exact: true })).toHaveCount(0)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '일정에 추가', exact: true })
    .click()
  const t = await saved(page)
  expect(t.days[0].at(-1).time).toBe('')
  expect(t.days[0].at(-1).custom.name).toBe('나만의 작은 산책길')
})
test('예약은 일정에 자동 노출하지 않고 예약 설정에서 선택한 뒤에만 반영', async ({
  page,
}) => {
  await seed(page)
  await expect(page.locator('.timeline-bookings')).toHaveCount(0)
  await expect(page.locator('.timeline-item')).toHaveCount(1)
  const before = await saved(page)
  await openWorkspace(page, '예약')
  const booking = page.locator('[data-reservation-id="flight"]')
  await expect(booking).toContainText('따로 관리하는 항공 예약')
  await expect(
    booking.getByRole('button', {
      name: '따로 관리하는 항공 예약 일정에 복사',
      exact: true,
    }),
  ).toHaveCount(0)
  await booking.getByText('일정에 반영 설정', { exact: true }).click()
  expect((await saved(page)).days).toEqual(before.days)
  await booking
    .getByRole('button', {
      name: '따로 관리하는 항공 예약 일정에 복사',
      exact: true,
    })
    .click()
  const after = await saved(page)
  expect(after.days[0]).toHaveLength(2)
  expect(after.reservations).toEqual(before.reservations)
  expect(after.days[0][1]).toMatchObject({
    reservationId: 'flight',
    time: '09:30',
  })
  await openWorkspace(page, '일정')
  await expect(page.locator('.timeline-item')).toHaveCount(2)
  await expect(page.locator('.timeline-bookings')).toHaveCount(0)
})
test('320px 여행 중 사진·소개를 기본 표시하고 버튼·추가 행·90% 배율과 안전 여백 유지', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await seed(page)
  await openWorkspace(page, '여행 중')
  const photo = page.locator('.field-primary-photo')
  await expect(photo).toBeVisible()
  expect(await photo.evaluate((e) => e.closest('details') === null)).toBe(true)
  await expect(page.locator('.field-place-introduction')).not.toBeEmpty()
  await expect(page.locator('.field-delay')).toHaveCount(0)
  for (const selector of [
    '.field-actions > .button',
    '.field-add-row > button',
  ]) {
    const boxes = await page.locator(selector).evaluateAll((nodes) =>
      nodes.map((n) => {
        const b = n.getBoundingClientRect()
        return { y: b.y, h: b.height, w: b.width }
      }),
    )
    expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1)
    expect(boxes.every((b) => b.w > 60)).toBe(true)
  }
  expect(
    await page
      .locator('#root')
      .evaluate((e) => Number(getComputedStyle(e).zoom)),
  ).toBe(0.9)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  const before = await saved(page)
  await openWorkspace(page, '가계부')
  expect((await saved(page)).days).toEqual(before.days)
})
