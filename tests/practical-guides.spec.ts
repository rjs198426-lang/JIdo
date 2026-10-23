import { openCreateOptions } from './navigation'
import { test, expect, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import { practicalGuides, findGuideCourse } from '../src/practical-guides'
import { appendGuideCourse } from '../src/guide-course'
import { tripSchema, type Trip } from '../src/travel-model'
import research from '../public/guide-research.json' with { type: 'json' }
const lookup = (id: string) => places.find((place) => place.id === id)
function baseTrip(): Trip {
  return tripSchema.parse({
    id: 'guide-trip',
    title: '내 교토와 도쿄',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 2,
    destinations: [
      { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
      { id: 'tokyo', name: '도쿄', country: '일본', guideCityId: 'tokyo' },
    ],
    dayDestinationIds: ['kyoto', 'tokyo'],
    days: [
      [
        {
          id: 'my-stop',
          placeId: 'kiyomizu',
          time: '10:00',
          note: '내 예약 메모',
          status: 'done',
          durationMinutes: 75,
          photoId: '11111111-1111-4111-8111-111111111111',
        },
      ],
      [
        {
          id: 'next-day',
          placeId: 'tokyo-sensoji',
          time: '11:00',
          note: '다른 날 메모',
        },
      ],
    ],
    checklist: [{ id: 'passport', title: '여권 확인', done: false }],
    travelInfo: {
      emergencyPhone: '119',
      insurancePhone: '',
      embassyContact: '',
      lodgingAddress: '내 숙소 주소',
      note: '개인 기록',
    },
  })
}
async function navigate(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}
async function openKyoto(page: Page) {
  await navigate(page, '여행지')
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .click()
  await page.getByText('추천 코스·블로그 후기', { exact: true }).click()
}
async function openFirstCourse(page: Page) {
  await page
    .getByRole('tablist', { name: '실전 가이드', exact: true })
    .getByRole('tab', { name: '지역별 코스', exact: true })
    .click()
  await page
    .locator('.guide-course')
    .first()
    .getByRole('button', { name: '이 코스 일정에 담기', exact: true })
    .click()
}

test('21개 가이드·42개 코스는 실제 내장 장소를 같은 여행권에 묶고 조사 실패를 확인 완료로 표시하지 않음', () => {
  expect(new Set(practicalGuides.map((guide) => guide.cityId))).toEqual(
    new Set(cities.map((city) => city.id)),
  )
  expect(practicalGuides.flatMap((guide) => guide.courses)).toHaveLength(42)
  for (const guide of practicalGuides) {
    expect(guide.bases.length).toBeGreaterThanOrEqual(2)
    for (const course of guide.courses) {
      expect(course.placeIds.length).toBeGreaterThanOrEqual(2)
      expect(new Set(course.placeIds).size).toBe(course.placeIds.length)
      for (const id of course.placeIds)
        expect(lookup(id)?.cityId).toBe(guide.cityId)
    }
    for (const source of guide.sources.filter(
      (source) => source.status === 'read',
    )) {
      const record = research.references.find(
        (record) => (record.resolvedUrl || record.url) === source.url,
      )
      expect(record?.httpStatus).toBe(200)
      expect(record?.textLength).toBeGreaterThan(1000)
    }
  }
})

test('코스 추가는 중복·다른 도시·시각 충돌·자정 초과를 검사하고 기존 메모·사진·다른 날짜를 보존', () => {
  const trip = baseTrip(),
    before = structuredClone(trip),
    course = findGuideCourse('kyoto', 'kyoto-course-1')!
  const result = appendGuideCourse(
    trip,
    course.cityId,
    course.placeIds,
    0,
    '12:00',
    lookup,
  )
  expect(result.added).toBe(2)
  expect(result.trip.days[0][0]).toEqual(before.days[0][0])
  expect(result.trip.days[0].map((stop) => stop.time)).toEqual([
    '10:00',
    '12:00',
    '14:00',
  ])
  expect(result.trip.days[1]).toBe(trip.days[1])
  expect(result.trip.travelInfo).toBe(trip.travelInfo)
  expect(result.trip.checklist).toBe(trip.checklist)
  expect(trip).toEqual(before)
  expect(tripSchema.safeParse(result.trip).success).toBe(true)
  const unchanged = appendGuideCourse(
    result.trip,
    course.cityId,
    course.placeIds,
    0,
    '09:00',
    lookup,
  )
  expect(unchanged.added).toBe(0)
  expect(unchanged.trip).toBe(result.trip)
  expect(() =>
    appendGuideCourse(trip, course.cityId, course.placeIds, 1, '09:00', lookup),
  ).toThrow('이 도시로 지정한')
  expect(() =>
    appendGuideCourse(trip, course.cityId, course.placeIds, 0, '23:00', lookup),
  ).toThrow('다음 날')
  expect(() =>
    appendGuideCourse(trip, course.cityId, course.placeIds, 0, '10:00', lookup),
  ).toThrow('겹쳐요')
  expect(() =>
    appendGuideCourse(
      trip,
      course.cityId,
      ['tokyo-sensoji'],
      0,
      '12:00',
      lookup,
    ),
  ).toThrow('이 도시에서')
  const full = {
    ...trip,
    days: [
      Array.from({ length: 200 }, (_, index) => ({
        ...trip.days[0][0],
        id: 'existing-' + index,
      })),
      trip.days[1],
    ],
  }
  expect(() =>
    appendGuideCourse(full, course.cityId, course.placeIds, 0, '12:00', lookup),
  ).toThrow('200곳')
})

test('오프라인 가이드에서 날짜를 골라 코스를 담고 중복 없이 재실행·기존 기록 보존', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  const trip = baseTrip()
  delete trip.days[0][0].photoId
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
  await context.setOffline(true)
  await openKyoto(page)
  await expect(
    page.getByRole('heading', { name: '숙소는 어디에 잡을까', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('tablist', { name: '실전 가이드', exact: true })
    .getByRole('tab', { name: '예약·현장 팁', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: '비가 오거나 날씨가 나쁘면',
      exact: true,
    }),
  ).toBeVisible()
  await openFirstCourse(page)
  await expect(
    page.getByLabel('코스를 담을 날짜').locator('option'),
  ).toHaveCount(1)
  await page.getByLabel('첫 방문 시간', { exact: true }).fill('23:00')
  await page
    .getByRole('button', { name: '2곳 일정에 추가', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('다음 날')
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
    ),
  ).toEqual(trip)
  await page.getByLabel('첫 방문 시간', { exact: true }).fill('12:00')
  await page
    .getByRole('button', { name: '2곳 일정에 추가', exact: true })
    .click()
  await expect(page.locator('.timeline-item')).toHaveCount(3)
  await expect(page.locator('.timeline')).toContainText('야사카 신사')
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(saved.days[0][0]).toEqual(trip.days[0][0])
  expect(saved.days[1]).toEqual(trip.days[1])
  expect(saved.travelInfo).toEqual(trip.travelInfo)
  await context.setOffline(false)
  await page.reload()
  await context.setOffline(true)
  await navigate(page, '내 여행')
  await expect(page.locator('.timeline-item')).toHaveCount(3)
  await openKyoto(page)
  await openFirstCourse(page)
  await expect(
    page.getByRole('button', { name: '이날 이미 모두 담았어요' }),
  ).toBeDisabled()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
  expect(
    await page
      .getByRole('dialog')
      .evaluate((node) => node.scrollWidth > node.clientWidth + 1),
  ).toBe(false)
  await context.setOffline(false)
})

test('여행이 없을 때 명시적으로 고른 코스만 새 여행 첫날에 넣고 일반 생성은 빈 일정 유지', async ({
  page,
}) => {
  await page.goto('/')
  await openKyoto(page)
  await openFirstCourse(page)
  await page
    .getByRole('button', { name: '이 코스로 새 여행 만들기', exact: true })
    .click()
  await expect(page.getByLabel('첫날에 추천 장소 3곳 넣어두기')).toHaveCount(0)
  await openCreateOptions(page)
  await page.getByLabel('여행 이름').fill('내가 고른 동쪽 코스')
  await page.getByLabel('첫날 첫 방문 시간', { exact: true }).fill('23:00')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('alert')).toContainText('다음 날')
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1') || '{"trips":[]}')
          .trips.length,
    ),
  ).toBe(0)
  await page.getByLabel('첫날 첫 방문 시간', { exact: true }).fill('09:00')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.locator('.timeline-item')).toHaveCount(3)
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(
    saved.days[0].map((stop: { placeId: string }) => stop.placeId),
  ).toEqual(findGuideCourse('kyoto', 'kyoto-course-1')!.placeIds)
  expect(saved.days.slice(1).flat()).toEqual([])
  expect(tripSchema.safeParse(saved).success).toBe(true)
  await page.getByRole('button', { name: '새 여행', exact: true }).click()
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await expect(
    page.getByLabel('첫날에 추천 장소 3곳 넣어두기'),
  ).not.toBeChecked()
  await openCreateOptions(page)
  await page.getByLabel('여행 이름').fill('빈 계획으로 시작')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  const normal = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.at(-1),
  )
  expect(normal.days.flat()).toEqual([])
})

test('1.13의 비워진 가이드 캐시에서도 실전 안내·코스를 유지하고 기존 자료 항목은 표시하지 않음', async ({
  page,
  context,
}) => {
  await page.goto('/')
  const trip = baseTrip()
  const guide = {
    id: 'kyoto',
    scope: 'city',
    city: cities.find((city) => city.id === 'kyoto')!,
    places: places.filter((place) => place.cityId === 'kyoto'),
    sections: [],
    sources: [],
    status: 'published',
    requestId: null,
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    publishedAt: '2026-10-15T00:00:00.000Z',
  }
  await page.evaluate(
    ({ trip, guide }) => {
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [trip],
        }),
      )
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({
          usingServer: true,
          available: [guide],
          retained: [guide],
        }),
      )
    },
    { trip, guide },
  )
  await page.reload()
  await context.setOffline(true)
  await openKyoto(page)
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByRole('tablist', { name: '실전 가이드', exact: true }),
  ).toBeVisible()
  await expect(
    dialog.getByText('상세 안내·기존 자료', { exact: true }),
  ).toHaveCount(0)
  await expect(dialog.locator('.guide-background')).toHaveCount(0)
  await expect(
    dialog.getByRole('heading', { name: '숙소는 어디에 잡을까', exact: true }),
  ).toBeVisible()
  await dialog.getByRole('tab', { name: '지역별 코스', exact: true }).click()
  await expect(dialog.locator('.guide-course')).toHaveCount(3)
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(stored.days[0][0]).toEqual(trip.days[0][0])
  expect(stored.days[1]).toEqual(trip.days[1])
})
