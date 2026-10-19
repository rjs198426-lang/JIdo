import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import {
  openTrips,
  openWorkspace,
  openScheduleEditor,
  openScheduleFilters,
} from './navigation'
import { googleMapsFixture } from './google-maps-fixture'
import { tripSchema, type Trip } from '../src/travel-model'
import { timelineDistance } from '../src/TimelineRail'
import { timelineBookings } from '../src/TimelineBookings'
function fixture(): Trip {
  return tripSchema.parse({
    id: 'timeline-new',
    title: '삿포로 여행',
    cityId: 'sapporo',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 2,
    days: [
      [
        {
          id: 'airport',
          placeId: 'airport',
          time: '12:00',
          note: '여권 챙기기',
          custom: {
            name: '신 치토세 공항',
            kind: '이동',
            address: 'New Chitose Airport',
            destinationId: 'sapporo',
            link: '',
            coordinates: { lat: 42.787, lng: 141.681 },
          },
        },
        {
          id: 'station',
          placeId: 'station',
          time: '13:00',
          note: '북쪽 출구에서 만나기',
          custom: {
            name: '삿포로 역',
            kind: '관광',
            address: 'Sapporo Station',
            destinationId: 'sapporo',
            link: '',
            coordinates: { lat: 43.0687, lng: 141.3508 },
          },
        },
        {
          id: 'hotel',
          placeId: 'hotel',
          time: '13:10',
          note: '짐 먼저 보관',
          reservationId: 'stay',
          custom: {
            name: '게이오 프렐리아 호텔 삿포로',
            kind: '숙소',
            address: 'Sapporo hotel',
            destinationId: 'sapporo',
            link: '',
            coordinates: { lat: 43.069, lng: 141.348 },
          },
        },
        {
          id: 'curry',
          placeId: 'curry',
          time: '14:00',
          note: '매운맛은 낮게',
          custom: {
            name: '수프 카레 킹 게이트웨이 점',
            kind: '맛집',
            address: 'Sapporo curry',
            destinationId: 'sapporo',
            link: '',
            coordinates: { lat: 43.065, lng: 141.35 },
          },
        },
      ],
      [],
    ],
    reservations: [
      {
        id: 'flight',
        title: 'ICN 08:20 - CTS 11:00',
        kind: '항공',
        date: '2026-11-01',
        time: '08:20',
        reference: 'PRIVATE-FLIGHT',
        address: '인천공항',
        link: '',
        note: '진에어 · LJ301',
        status: 'confirmed',
      },
      {
        id: 'stay',
        title: '호텔 체크인',
        kind: '숙소',
        date: '2026-11-01',
        time: '13:10',
        reference: 'PRIVATE-HOTEL',
        address: '삿포로',
        link: '',
        note: '호텔 예약 원본',
        status: 'confirmed',
      },
      {
        id: 'next',
        title: '다음 날 체험',
        kind: '체험',
        date: '2026-11-02',
        time: '10:00',
        reference: '',
        address: '',
        link: '',
        note: '',
        status: 'pending',
      },
    ],
    checklist: [{ id: 'passport', title: '여권', done: false }],
    expenses: [
      {
        id: 'meal',
        title: '점심',
        amount: 1500,
        currency: 'JPY',
        date: '2026-11-01',
        category: '식비',
        payer: '나',
        note: '기존 경비',
      },
    ],
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
}
const androidVersion = readFileSync('android/app/build.gradle', 'utf8')
const version = androidVersion.match(/versionName \"([^\"]+)\"/)![1]
const build = androidVersion.match(/versionCode (\d+)/)![1]
const state = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )

test('읽기 목록은 시간·번호·카드와 실제 예약·메모를 표시하고 편집 입력은 접힘', async ({
  page,
}, info) => {
  await seed(page)
  await expect(
    page.getByRole('button', { name: '일정 목록 편집' }),
  ).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.timeline .timeline-visit-time')).toHaveText([
    '12:00',
    '13:00',
    '13:10',
    '14:00',
  ])
  await expect(
    page.locator('[data-stop-id="station"] .stop-number'),
  ).toHaveText('2')
  await expect(
    page.getByLabel('삿포로 역 방문 시간', { exact: true }),
  ).not.toBeVisible()
  await expect(
    page.locator('[data-stop-id="station"] .schedule-note-preview'),
  ).toContainText('북쪽 출구')
  await expect(page.locator('.timeline-find')).not.toHaveAttribute('open', '')
  await expect(
    page.getByRole('button', { name: 'ICN 08:20 - CTS 11:00 예약 관리' }),
  ).toBeVisible()
  await expect(page.locator('.timeline-bookings')).not.toContainText(
    'PRIVATE-FLIGHT',
  )
  expect(await state(page)).toEqual(fixture())
  expect(await page.evaluate(() => (window as any).googleCalls.length)).toBe(0)
  await page.locator('.timeline-workspace').scrollIntoViewIfNeeded()
  await page.screenshot({
    path: info.outputPath('timeline-reading.png'),
    fullPage: true,
  })
  await page.evaluate(() => {
    const heading = document.querySelector('.timeline-day-heading')!
    window.scrollBy(0, heading.getBoundingClientRect().top - 80)
  })
  await page.screenshot({ path: info.outputPath('timeline-viewport.png') })
})
test('카드별 편집은 해당 카드만 펼치고 시간·메모·날짜 변경을 보존', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('button', { name: '삿포로 역 일정 상세 펼치기' }).click()
  await page.getByLabel('삿포로 역 방문 시간', { exact: true }).fill('13:05')
  await expect(
    page.getByLabel('신 치토세 공항 방문 시간', { exact: true }),
  ).not.toBeVisible()
  await page
    .locator('[data-stop-id="station"] .stop-edit-details > summary')
    .click()
  await page
    .getByLabel('삿포로 역 메모', { exact: true })
    .fill('동행자와 출구 확인')
  await page.getByLabel('삿포로 역 이동할 날짜').selectOption('1')
  await expect(page.locator('[data-stop-id="station"]')).toBeVisible()
  const trip = await state(page)
  expect(trip.days[1][0]).toMatchObject({
    id: 'station',
    time: '13:05',
    note: '동행자와 출구 확인',
  })
  expect(trip.reservations).toEqual(fixture().reservations)
  expect(trip.expenses).toEqual(fixture().expenses)
})
test('전체 편집·순서 적용·완료 후 읽기 복귀와 재시작', async ({ page }) => {
  await seed(page)
  await openScheduleEditor(page)
  await page.getByRole('button', { name: '순서 편집', exact: true }).click()
  await page
    .getByLabel('수프 카레 킹 게이트웨이 점 방문 순번')
    .selectOption('1')
  await page.getByRole('button', { name: '순서 적용', exact: true }).click()
  await page.getByRole('button', { name: '일정 목록 편집' }).click()
  await expect(
    page.getByLabel('삿포로 역 방문 시간', { exact: true }),
  ).not.toBeVisible()
  expect((await state(page)).days[0].map((stop: any) => stop.id)).toEqual([
    'airport',
    'curry',
    'station',
    'hotel',
  ])
  await page.reload()
  await openTrips(page)
  await expect(
    page.getByRole('button', { name: '일정 목록 편집' }),
  ).toHaveAttribute('aria-pressed', 'false')
  expect((await state(page)).days[0].map((stop: any) => stop.id)).toEqual([
    'airport',
    'curry',
    'station',
    'hotel',
  ])
})
test('예약 카드는 해당 날짜만 표시하고 연결된 예약은 중복하지 않음', async ({
  page,
}) => {
  const trip = fixture()
  expect(timelineBookings(trip, 0).map((item) => item.id)).toEqual(['flight'])
  expect(timelineBookings(trip, 1).map((item) => item.id)).toEqual(['next'])
  await seed(page)
  await page
    .getByRole('button', { name: 'ICN 08:20 - CTS 11:00 예약 관리' })
    .click()
  await expect(page.locator('[data-reservation-id="flight"]')).toBeFocused()
  await openWorkspace(page, '일정')
  await page
    .getByRole('tablist', { name: '여행 날짜' })
    .getByRole('tab')
    .nth(1)
    .click()
  await expect(
    page.getByRole('button', { name: '다음 날 체험 예약 관리' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'ICN 08:20 - CTS 11:00 예약 관리' }),
  ).toHaveCount(0)
})
test('직선 거리는 실제 인접 좌표만 계산하고 누락·제외·숨긴 이전 장소는 표시하지 않음', () => {
  const trip = fixture(),
    ids = trip.days[0].map((stop) => stop.id),
    stop = trip.days[0][1]
  expect(timelineDistance(trip, 0, stop, ids)).toMatch(/km$/)
  expect(timelineDistance(trip, 0, trip.days[0][2], ids)).toMatch(/m$/)
  expect(timelineDistance(trip, 0, stop, ['station'])).toBeUndefined()
  delete trip.days[0][0].custom!.coordinates
  expect(timelineDistance(trip, 0, stop, ids)).toBeUndefined()
  trip.days[0][0].custom!.coordinates = { lat: 42.787, lng: 141.681 }
  trip.days[0][0].status = 'skipped'
  expect(timelineDistance(trip, 0, stop, ids)).toBeUndefined()
})
test('필터는 펼쳐서 쓰고 원래 번호·직선 구간을 왜곡하지 않음', async ({
  page,
}) => {
  await seed(page)
  await openScheduleFilters(page)
  await page.getByLabel('이날 일정 검색').fill('삿포로 역')
  await expect(page.locator('.timeline [data-stop-id]')).toHaveCount(1)
  await expect(page.locator('.timeline .stop-number')).toHaveText('2')
  await expect(page.locator('.timeline .timeline-distance')).toHaveCount(0)
  await page.getByRole('button', { name: '필터 초기화' }).click()
  await expect(page.locator('.timeline [data-stop-id]')).toHaveCount(4)
})
test('앱 정보의 0.x 개발판 표시와 업데이트 가능한 내부 빌드 번호', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('button', { name: '앱 정보', exact: true }).click()
  const panel = page.getByRole('region', { name: '앱 정보', exact: true })
  expect(version).toMatch(/^0\.\d+$/)
  expect(Number(build)).toBeGreaterThan(51)
  await expect(panel).toContainText('개발판')
  await expect(
    panel.locator('dl > div').filter({ hasText: '앱 버전' }).locator('dd'),
  ).toHaveText(version)
  await expect(
    panel.locator('dl > div').filter({ hasText: '빌드 번호' }).locator('dd'),
  ).toHaveText(build)
})
test('320px 긴 장소·메모·큰 글자에서도 카드와 편집 메뉴를 읽을 수 있음', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const trip = fixture()
  trip.days[0][1].custom!.name =
    '동행자와 함께 방문하는 아주 긴 장소 이름과 공백없는ABCDEFGHIJKLMNOPQRSTUVWXYZ'.repeat(
      2,
    )
  trip.days[0][1].note = '동행자와 예약을 확인하는 긴 메모. '.repeat(40)
  await seed(page, trip)
  await page.addStyleTag({
    content:
      '.stop-place strong {font-size:20px!important} .timeline-visit-time {font-size:16px!important}',
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.locator('[data-stop-id="station"]').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('timeline-long-320.png') })
  await openScheduleEditor(page)
  await expect(
    page.getByLabel('신 치토세 공항 방문 시간', { exact: true }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})
