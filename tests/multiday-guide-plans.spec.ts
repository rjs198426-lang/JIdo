import { test, expect, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import { getGuidePlan, guidePlanDurations } from '../src/practical-guides'
import { appendGuideSelection, eligibleCourseDays } from '../src/guide-course'
import { tripSchema, type Trip } from '../src/travel-model'
import { openTrips } from './navigation'
const lookup = (id: string) => places.find((place) => place.id === id)
function fixture(): Trip {
  return tripSchema.parse({
    id: 'multiday-plan',
    title: '교토와 도쿄 6일',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-06',
    travelers: 1,
    destinations: [
      { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
      { id: 'tokyo', name: '도쿄', country: '일본', guideCityId: 'tokyo' },
    ],
    dayDestinationIds: ['tokyo', 'kyoto', 'kyoto', 'kyoto', 'kyoto', 'kyoto'],
    days: [
      [
        {
          id: 'tokyo-visit',
          placeId: 'tokyo-sensoji',
          time: '08:00',
          note: '도쿄 예약',
        },
      ],
      [
        {
          id: 'my-stop',
          placeId: 'kiyomizu',
          time: '08:00',
          note: '개인 메모',
          status: 'done',
          durationMinutes: 70,
          photoId: '11111111-1111-4111-8111-111111111111',
          reservationId: 'ticket',
        },
      ],
      [],
      [],
      [],
      [],
    ],
    reservations: [
      {
        id: 'ticket',
        title: '관람권',
        kind: '체험',
        date: '2026-11-02',
        time: '08:00',
        reference: 'PRIVATE-BOOKING',
        address: '교토',
        link: '',
        note: '원래 예약 메모',
        status: 'confirmed',
      },
    ],
    checklist: [{ id: 'passport', title: '여권', done: true }],
  })
}
async function openPlan(page: Page, duration = 3) {
  await page
    .locator('.desktop-nav:visible,.bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page.getByText('추천 코스·블로그 후기', { exact: true }).click()
  await page.getByRole('tab', { name: '지역별 코스', exact: true }).click()
  await page
    .getByRole('group', { name: '추천 일정 기간' })
    .getByRole('button', { name: `${duration}일`, exact: true })
    .click()
}
async function seed(page: Page, trip = fixture()) {
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

test('21개 여행지마다 3·4·5일 코스 63개를 내장하고 하루 1~4곳을 해당 여행지로 묶음', () => {
  let count = 0
  for (const city of cities)
    for (const duration of guidePlanDurations) {
      const plan = getGuidePlan(city.id, duration)!
      expect(plan, city.id).toBeDefined()
      expect(plan.days).toHaveLength(duration)
      expect(new Set(plan.days!.map((day) => day.id)).size).toBe(duration)
      for (const day of plan.days!) {
        expect(day.title.trim().length).toBeGreaterThan(3)
        expect(day.why.trim().length).toBeGreaterThan(10)
        expect(day.placeIds.length).toBeGreaterThanOrEqual(1)
        expect(day.placeIds.length).toBeLessThanOrEqual(4)
        expect(new Set(day.placeIds).size).toBe(day.placeIds.length)
        for (const id of day.placeIds) {
          expect(lookup(id)?.cityId, id).toBe(city.id)
          expect(lookup(id)?.name).toMatch(/[가-힣]/)
        }
      }
      expect(plan.placeIds).toEqual(plan.days!.flatMap((day) => day.placeIds))
      const trip = tripSchema.parse({
        id: city.id,
        title: city.name,
        cityId: city.id,
        startDate: '2026-11-01',
        endDate: `2026-11-0${duration}`,
        travelers: 1,
        days: Array.from({ length: duration }, () => []),
      })
      const applied = appendGuideSelection(trip, plan, 0, '09:00', lookup)
      expect(
        applied.trip.days.map((day) => day.map((stop) => stop.placeId)),
      ).toEqual(plan.days!.map((day) => day.placeIds))
      expect(tripSchema.safeParse(applied.trip).success).toBe(true)
      count++
    }
  expect(count).toBe(63)
  for (const duration of guidePlanDurations) {
    const plan = getGuidePlan('maldives', duration)!
    expect(plan.days!.at(-1)?.title).toContain('출국')
    expect(plan.placeIds.some((id) => lookup(id)?.area?.includes('바아'))).toBe(
      false,
    )
  }
})

test('다일 코스는 연속 체류일에만 담고 중복·메모·사진·예약·다른 날짜를 보존하며 실패 시 전부 취소', () => {
  const trip = fixture(),
    before = structuredClone(trip),
    plan = getGuidePlan('kyoto', 3)!
  expect(eligibleCourseDays(trip, plan)).toEqual([1, 2, 3])
  const applied = appendGuideSelection(trip, plan, 2, '09:00', lookup)
  expect(applied.trip.days[0]).toBe(trip.days[0])
  expect(applied.trip.days[1]).toBe(trip.days[1])
  expect(applied.trip.days[5]).toBe(trip.days[5])
  expect(applied.trip.reservations).toBe(trip.reservations)
  expect(applied.trip.checklist).toBe(trip.checklist)
  expect(appendGuideSelection(applied.trip, plan, 2, '09:00', lookup)).toEqual({
    trip: applied.trip,
    added: 0,
  })
  expect(() => appendGuideSelection(trip, plan, 0, '09:00', lookup)).toThrow(
    '연속',
  )
  expect(() => appendGuideSelection(trip, plan, 4, '09:00', lookup)).toThrow(
    '연속',
  )
  expect(() => appendGuideSelection(trip, plan, 1, '23:00', lookup)).toThrow(
    '다음 날',
  )
  const collision = structuredClone(trip)
  collision.days[3] = [
    {
      id: 'later-conflict',
      placeId: 'nishiki',
      time: '09:00',
      note: '기존 세 번째 날 예약',
    },
  ]
  const collisionBefore = structuredClone(collision)
  expect(() =>
    appendGuideSelection(collision, plan, 1, '09:00', lookup),
  ).toThrow('DAY 3')
  expect(collision).toEqual(collisionBefore)
  expect(trip).toEqual(before)
  const preserved = appendGuideSelection(trip, plan, 1, '09:00', lookup)
  expect(preserved.trip.days[1][0]).toEqual(before.days[1][0])
  expect(
    preserved.trip.days[1].filter((stop) => stop.placeId === 'kiyomizu'),
  ).toHaveLength(1)
})

test('오프라인 3·4·5일 전환과 320px 큰 글자에서도 일차·장소·버튼을 표시하고 창 하나로 전환', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await context.setOffline(true)
  await openPlan(page)
  await page.addStyleTag({ content: 'html { font-size: 20px !important; }' })
  for (const duration of guidePlanDurations) {
    await page
      .getByRole('group', { name: '추천 일정 기간' })
      .getByRole('button', { name: `${duration}일`, exact: true })
      .click()
    await expect(page.locator('.guide-course')).toHaveCount(duration)
    await expect(page.locator('.guide-course-day strong').last()).toHaveText(
      `DAY ${duration}`,
    )
    await expect(
      page.getByRole('button', {
        name: `${duration}일 전체 일정에 담기`,
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('group', { name: '추천 일정 기간' })
        .getByRole('button', { name: `${duration}일`, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    for (const selector of [
      '.guide-duration button',
      '.guide-plan-summary button',
      '.guide-course li > button',
    ]) {
      const bad = await page
        .locator(selector)
        .evaluateAll(
          (nodes) =>
            nodes.filter(
              (n) =>
                n.scrollWidth > n.clientWidth + 1 ||
                n.getBoundingClientRect().height < 44 * 0.9 - 0.1,
            ).length,
        )
      expect(bad, selector).toBe(0)
    }
    expect(
      await page
        .getByRole('dialog')
        .evaluate((n) => n.scrollWidth > n.clientWidth + 1),
    ).toBe(false)
  }
  await page
    .getByRole('button', { name: '코스 장소 기요미즈데라 보기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.getByRole('dialog')).toHaveAccessibleName('기요미즈데라')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await openPlan(page)
  await expect(
    page
      .getByRole('group', { name: '추천 일정 기간' })
      .getByRole('button', { name: '3일', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page
    .getByRole('button', { name: '3일 전체 일정에 담기', exact: true })
    .click()
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('전체 코스를 시작 날짜부터 나누어 담고 다른 도시·기록을 보존하며 재실행 뒤 중복 방지', async ({
  page,
  context,
}) => {
  const trip = fixture()
  delete trip.days[1][0].photoId
  await seed(page, trip)
  await context.setOffline(true)
  await openPlan(page, 4)
  await page
    .getByRole('button', { name: '4일 전체 일정에 담기', exact: true })
    .click()
  await expect(
    page.getByLabel('코스를 시작할 날짜').locator('option'),
  ).toHaveCount(2)
  await page.getByLabel('코스를 시작할 날짜').selectOption('2')
  const plan = getGuidePlan('kyoto', 4)!
  await page
    .getByRole('button', {
      name: `${plan.placeIds.length}곳 일정에 추가`,
      exact: true,
    })
    .click()
  const saved: Trip = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(saved.days.slice(0, 2)).toEqual(trip.days.slice(0, 2))
  expect(
    saved.days.slice(2).map((day) => day.map((stop) => stop.placeId)),
  ).toEqual(plan.days!.map((day) => day.placeIds))
  expect(saved.reservations).toEqual(trip.reservations)
  expect(saved.checklist).toEqual(trip.checklist)
  await context.setOffline(false)
  await page.reload()
  await context.setOffline(true)
  await openPlan(page, 4)
  await page
    .getByRole('button', { name: '4일 전체 일정에 담기', exact: true })
    .click()
  await page.getByLabel('코스를 시작할 날짜').selectOption('2')
  await expect(
    page.getByRole('button', {
      name: '모든 날짜에 이미 담았어요',
      exact: true,
    }),
  ).toBeDisabled()
})

test('짧거나 도시가 끊긴 여행에는 전체 코스를 담지 않고 새 여행에는 고른 일수만 생성', async ({
  page,
}) => {
  const trip = fixture()
  trip.dayDestinationIds = [
    'kyoto',
    'tokyo',
    'kyoto',
    'tokyo',
    'kyoto',
    'tokyo',
  ]
  delete trip.days[1][0].photoId
  await seed(page, trip)
  await openPlan(page, 5)
  await page
    .getByRole('button', { name: '5일 전체 일정에 담기', exact: true })
    .click()
  await expect(
    page.getByText('5일 연속으로 이 도시에 머무는 날짜가 없습니다.', {
      exact: false,
    }),
  ).toBeVisible()
  await expect(page.getByLabel('코스를 시작할 날짜')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '내 여행에서 날짜 지정', exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
    ),
  ).toEqual(trip)
  await page
    .getByRole('button', { name: '이 코스로 새 여행 만들기', exact: true })
    .click()
  await page.getByLabel('출발일', { exact: true }).fill('2026-12-10')
  await expect(page.getByLabel('마지막 날', { exact: true })).toHaveValue(
    '2026-12-14',
  )
  await page.getByLabel('마지막 날', { exact: true }).fill('2026-12-12')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('5일 연속')
  await page.getByLabel('마지막 날', { exact: true }).fill('2026-12-14')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  const saved: Trip = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.at(-1),
  )
  expect(saved.days).toHaveLength(5)
  expect(saved.days.map((day) => day.map((stop) => stop.placeId))).toEqual(
    getGuidePlan('kyoto', 5)!.days!.map((day) => day.placeIds),
  )
  expect(saved.travelers).toBe(1)
  expect(tripSchema.safeParse(saved).success).toBe(true)
  await page.reload()
  await openTrips(page)
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.at(-1).days
          .length,
    ),
  ).toBe(5)
})
