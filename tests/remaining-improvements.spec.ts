import { test, expect } from '@playwright/test'
import { googleMapsFixture } from './google-maps-fixture'
import { openTrips, openWorkspace } from './navigation'
import { tripSchema } from '../src/travel-model'
import { localClock, validTimeZone } from '../src/destination-time'
import { places } from '../src/data'
import { portableTrip } from '../src/TravelBackup'
const fixture = () => ({
  id: 'remaining',
  title: '우리 교토 여행',
  cityId: 'kyoto',
  startDate: '2026-11-04',
  endDate: '2026-11-06',
  travelers: 2,
  members: [
    { id: 'me', name: '나' },
    { id: 'friend', name: '수진' },
  ],
  destinations: [
    { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
  ],
  dayDestinationIds: ['kyoto', 'kyoto', 'kyoto'],
  days: [
    [
      { id: 'first', placeId: 'kiyomizu', time: '10:00', note: 'PRIVATE-NOTE' },
      {
        id: 'second',
        placeId: 'kyoto-gion',
        time: '13:00',
        note: '',
        custom: {
          name: '기온 산책',
          kind: '관광',
          address: 'Kyoto Japan',
          link: '',
          destinationId: 'kyoto',
          coordinates: { lat: 35.003, lng: 135.777 },
        },
      },
    ],
    [],
    [],
  ],
  reservations: [
    {
      id: 'hotel',
      title: '호텔',
      kind: '숙소',
      date: '2026-11-04',
      endDate: '2026-11-07',
      time: '15:00',
      reference: 'PRIVATE-BOOKING',
      address: 'Kyoto',
      link: '',
      note: '',
    },
  ],
  checklist: [
    { id: 'done', title: '끝낸 준비', done: true, category: '짐' },
    { id: 'todo', title: '여권 확인', done: false, category: '서류' },
  ],
})
async function seed(page: import('@playwright/test').Page) {
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

test('시간대는 날짜 변경선과 서머타임을 반영하며 잘못된 설정을 거부', () => {
  expect(
    localClock(new Date('2026-11-04T02:00:00Z'), 'Pacific/Honolulu'),
  ).toMatchObject({ date: '2026-11-03', time: '16:00' })
  expect(
    localClock(new Date('2026-07-01T12:00:00Z'), 'America/New_York').time,
  ).toBe('08:00')
  expect(
    localClock(new Date('2026-12-01T12:00:00Z'), 'America/New_York').time,
  ).toBe('07:00')
  expect(validTimeZone('Not/AZone')).toBe(false)
  const bali = tripSchema.parse({
    ...fixture(),
    destinations: [
      { id: 'kyoto', name: '발리', country: '인도네시아', guideCityId: 'bali' },
    ],
  })
  expect(portableTrip(bali).destinations?.[0].timeZone).toBe('Asia/Makassar')
  expect(
    tripSchema.safeParse({
      ...fixture(),
      destinations: [
        { id: 'kyoto', name: '교토', country: '일본', timeZone: 'Not/AZone' },
      ],
    }).success,
  ).toBe(false)
})

test('새 식당·카페 13곳은 한글·좌표·검증 가능한 출처와 원문 증거를 갖춤', () => {
  const dining = places.filter((p) => p.id.includes('-dining-'))
  expect(dining).toHaveLength(13)
  expect(places).toHaveLength(1066)
  for (const place of dining) {
    expect(place.name).toMatch(/[가-힣]/)
    expect(place.lat).toBeGreaterThan(0)
    expect(place.lng).toBeGreaterThan(0)
    expect(place.reviewSources?.[0].checkedAt).toBe('2026-10-17')
    expect(place.reviewSources?.[0].url).toContain('oldid=')
  }
  expect(
    dining.some((p) => p.cityId === 'kyoto' && p.category === '맛집'),
  ).toBe(true)
  expect(
    dining.some((p) => p.cityId === 'tokyo' && p.category === '카페'),
  ).toBe(true)
})

test('준비물 기본 화면은 필터를 접고 미완료를 우선 표시, 펼치면 분류 가능', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('tab', { name: '여행 준비', exact: true }).click()
  await page
    .getByRole('group', { name: '준비 관리', exact: true })
    .getByRole('button', { name: '준비물', exact: true })
    .click()
  await expect(page.locator('.preparation-options')).not.toHaveAttribute(
    'open',
    '',
  )
  await expect(page.getByLabel('준비 상태 필터')).not.toBeVisible()
  await expect(page.locator('.checklist input').first()).toHaveAttribute(
    'aria-label',
    '여권 확인',
  )
  await page.locator('.preparation-options > summary').click()
  await page.getByLabel('준비 상태 필터').selectOption('완료')
  await expect(page.locator('.checklist input')).toHaveCount(1)
  await expect(page.getByLabel('끝낸 준비', { exact: true })).toBeChecked()
})

test('백업 목적 기본은 전체 파일 보관이며 동행자 전달에 예약번호·개인 메모 제외', async ({
  page,
}) => {
  await seed(page)
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '전체 백업 저장', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: '전체 여행 백업 복사', exact: true }),
  ).not.toBeVisible()
  await page
    .getByRole('tab', { name: '동행자에게 일정 전달', exact: true })
    .click()
  const text = await page
    .getByRole('dialog')
    .getByLabel('동행자에게 전달할 내용')
    .inputValue()
  expect(text).not.toContain('PRIVATE-BOOKING')
  expect(text).not.toContain('PRIVATE-NOTE')
  await page
    .getByRole('tab', { name: '내 자료 보관·복원', exact: true })
    .click()
  await page.locator('.legacy-backup > summary').click()
  await expect(
    page.getByRole('button', { name: '전체 여행 백업 복사', exact: true }),
  ).toBeVisible()
})

test('선택 날짜의 숙소와 경비·현지 통화, 간단한 목록이 복구 후에도 동작', async ({
  page,
}) => {
  await seed(page)
  await openWorkspace(page, '일정')
  await page
    .getByRole('button', { name: '간단한 목록 보기', exact: true })
    .click()
  await expect(page.locator('.stop-condensed')).toHaveCount(2)
  await page
    .getByRole('button', { name: '기요미즈데라 일정 상세 펼치기' })
    .click()
  await expect(
    page.getByRole('button', { name: '기요미즈데라 일정에서 삭제' }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /DAY 3/ }).click()
  await openWorkspace(page, '가계부')
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  await expect(page.getByLabel('지출 날짜', { exact: true })).toHaveValue(
    '2026-11-06',
  )
  await expect(page.getByLabel('지출 통화', { exact: true })).toHaveValue('JPY')
  await page.getByLabel('지출 이름', { exact: true }).fill('점심')
  await page.getByLabel('금액', { exact: true }).fill('3800')
  await page.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(page.locator('.money-overview')).toContainText('3,800')
  await expect(page.locator('.money-overview')).not.toContainText('₩0')
  await openWorkspace(page, '예약')
  await page
    .getByRole('button', { name: '예약 정보 추가', exact: true })
    .click()
  await expect(page.getByLabel('체크아웃 날짜')).toBeVisible()
})

test('이동 구간은 수단 선택만으로 자동 계산하고 원본에 저장하지 않음', async ({
  page,
}) => {
  await googleMapsFixture(page)
  await seed(page)
  await openWorkspace(page, '이동시간')
  const output = page.getByLabel('기요미즈데라에서 기온 산책 이동시간', {
    exact: true,
  })
  await expect(output).toHaveText('13분')
  await page
    .getByLabel('기요미즈데라에서 기온 산책 이동수단')
    .selectOption('transit')
  await expect(output).toHaveText('22분')
  const value = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].days[0][1]
        .transfer,
  )
  expect(value).toBeUndefined()
})

test('도시 시간대 설정은 재실행·JSON 백업에도 보존', async ({ page }) => {
  await seed(page)
  await openWorkspace(page, '일정')
  await page.locator('.city-details > summary').click()
  await page.locator('.destination-zone > summary').click()
  await page.getByLabel('도시 시간대').fill('Pacific/Honolulu')
  await page.getByLabel('도시 시간대').press('Tab')
  await page
    .getByRole('button', { name: '여행 백업·공유', exact: true })
    .click()
  await page.locator('.legacy-backup > summary').click()
  await page
    .getByRole('button', { name: '전체 여행 백업 복사', exact: true })
    .click()
  expect(
    JSON.parse(await page.getByLabel('내보낸 여행 내용').inputValue()).trips[0]
      .destinations[0].timeZone,
  ).toBe('Pacific/Honolulu')
})
