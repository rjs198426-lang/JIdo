import { test, expect, type Page } from '@playwright/test'
import { tripSchema, type Trip } from '../src/travel-model'
import {
  openTrips,
  openWorkspace,
  openDisclosure,
  openTripMore,
  openCreateOptions,
  openExpenseTools,
  openSearchOptions,
} from './navigation'
const fixture = (): Trip =>
  tripSchema.parse({
    id: 'simple-trip',
    title: '교토의 느긋한 이틀',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    travelers: 2,
    members: [
      { id: 'me', name: '나' },
      { id: 'friend', name: '친구' },
    ],
    destinations: [
      { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
    ],
    dayDestinationIds: ['kyoto', 'kyoto'],
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:00',
          note: '입구에서 만나기',
        },
        {
          id: 'cafe',
          placeId: 'custom-cafe',
          time: '13:00',
          note: '예약 메모',
          reservationId: 'lunch',
          status: 'done',
          photoId: 'ec240e74-951b-41c1-94da-ffde24e24f5c',
          custom: {
            name: '작은 카페',
            kind: '카페',
            address: '숨길 주소',
            link: 'https://www.google.com/maps/search/?api=1&query=cafe',
            destinationId: 'kyoto',
            googlePlaceId: 'cafe',
            coordinates: { lat: 35.01, lng: 135.76 },
          },
        },
      ],
      [],
    ],
    expenses: [
      {
        id: 'taxi',
        title: '택시',
        amount: 500,
        currency: 'JPY',
        date: '2026-11-01',
        category: '교통',
        payer: '나',
        payerId: 'me',
      },
    ],
    reservations: [
      {
        id: 'lunch',
        title: '점심 예약',
        kind: '기타',
        date: '2026-11-01',
        time: '13:00',
        reference: 'PRIVATE-REF',
        address: '',
        link: '',
        note: '창가',
        status: 'confirmed',
      },
    ],
    checklist: [],
    attachments: [],
    travelInfo: {
      emergencyPhone: '119',
      insurancePhone: '',
      embassyContact: '',
      lodgingAddress: '개인 숙소',
      note: '원래 여행 메모',
    },
  })
async function stored(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
}
async function seed(page: Page) {
  await page.goto('/')
  const value = fixture()
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [value],
        }),
      ),
    value,
  )
  await page.reload()
}
async function screenshot(page: Page, info: any, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: info.outputPath(`${name}.png`) })
}

test('처음 사용자는 여행지와 날짜만으로 여행을 만들고 바로 일정에 도착', async ({
  page,
}, info) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('여행 이름')).toBeHidden()
  await expect(dialog.getByLabel('함께하는 인원')).toBeHidden()
  await dialog.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await dialog.getByLabel('출발일').fill('2026-11-01')
  await dialog.getByLabel('마지막 날').fill('2026-11-02')
  await dialog
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  const trip = await stored(page)
  expect(trip).toMatchObject({
    title: '교토 여행',
    travelers: 1,
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    days: [[], []],
  })
  await expect(page.locator('.trip-selector')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '장소 추가', exact: true }),
  ).toHaveCount(1)
  await expect(page.locator('.trip-more')).not.toHaveAttribute('open', '')
  await expect(page.getByRole('heading', { name: /DAY 1/ })).toBeVisible()
  await screenshot(page, info, 'empty-day')
})

test('이름·동행·추천은 원하는 경우에만 선택하며 초안도 복원', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await openCreateOptions(page)
  await page.getByLabel('여행 이름').fill('친구와 교토')
  await page.getByLabel('함께하는 인원').selectOption('2')
  await page.getByLabel('첫날에 추천 장소 3곳 넣어두기').check()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await openCreateOptions(page)
  await expect(page.getByLabel('여행 이름')).toHaveValue('친구와 교토')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  const trip = await stored(page)
  expect(trip.title).toBe('친구와 교토')
  expect(trip.travelers).toBe(3)
  expect(trip.members).toHaveLength(3)
  expect(trip.days[0]).toHaveLength(3)
})

test('일정은 장소가 먼저 보이고 도시·공유·전체 일정은 더보기에서 열며 조회로 기록을 바꾸지 않음', async ({
  page,
}, info) => {
  await seed(page)
  await openTrips(page)
  const before = await stored(page)
  await expect(page.getByLabel('이날의 체류 도시')).toBeHidden()
  await expect(page.locator('.timeline')).toBeVisible()
  const rail = await page.locator('.timeline').boundingBox(),
    more = await page.locator('.trip-more').boundingBox()
  expect(more!.y).toBeGreaterThan(rail!.y + rail!.height - 1)
  await openTripMore(page)
  await expect(page.getByLabel('이날의 체류 도시')).toBeVisible()
  await openDisclosure(page, '.trip-overview')
  await expect(page.getByLabel('여행 전체 일정 검색')).toBeVisible()
  await page.locator('.trip-more > summary').click()
  expect(await stored(page)).toEqual(before)
  await page.getByRole('tab', { name: /DAY 2/ }).click()
  await expect(
    page.getByRole('button', { name: '장소 추가', exact: true }),
  ).toHaveCount(1)
  await page.getByRole('tab', { name: /DAY 1/ }).click()
  expect((await stored(page)).days).toEqual(before.days)
  await screenshot(page, info, 'schedule')
})

test('홈은 여행과 하루 일정·준비 바로가기 중심이며 추천·다른 여행을 접어 둠', async ({
  page,
}, info) => {
  await seed(page)
  const before = await stored(page)
  await expect(page.locator('.home-journey-card')).toBeVisible()
  await expect(page.locator('.home-next-day')).toBeVisible()
  await expect(page.locator('.home-shortcuts')).toHaveCount(0)
  await expect(page.locator('.home-discover .city-card').first()).toBeHidden()
  await openDisclosure(page, '.home-discover')
  await expect(page.locator('.home-discover .city-card').first()).toBeVisible()
  await page.locator('.home-discover > summary').click()
  expect(await stored(page)).toEqual(before)
  await screenshot(page, info, 'home')
})

test('가계부는 지출 추가 하나로 이름·금액만 입력하고 선택한 날짜와 통화로 저장', async ({
  page,
}, info) => {
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '가계부')
  const before = await stored(page)
  await expect(page.getByRole('tablist', { name: '가계부 보기' })).toBeHidden()
  await expect(
    page.getByRole('button', { name: '빠른 기록', exact: true }),
  ).toHaveCount(0)
  await expect(page.locator('.expense-manager')).not.toContainText(
    '아직 설정하지 않았어요',
  )
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  const form = page.getByRole('dialog')
  await expect(form.getByLabel('지출 이름')).toBeVisible()
  await expect(form.getByLabel('결제한 사람', { exact: true })).toBeHidden()
  await form.getByLabel('지출 이름').fill('점심')
  await form.getByLabel('금액', { exact: true }).fill('1200')
  await expect(form.getByLabel('지출 통화')).toHaveValue('JPY')
  await screenshot(page, info, 'quick-expense')
  await form.getByRole('button', { name: '지출 저장', exact: true }).click()
  const after = await stored(page)
  expect(after.expenses.at(-1)).toMatchObject({
    title: '점심',
    amount: 1200,
    currency: 'JPY',
    date: '2026-11-01',
    payerId: 'me',
    direction: 'expense',
  })
  expect(after.expenses.at(-1).splits).toBeUndefined()
  expect(after.totalBudget).toBeUndefined()
  expect(after.exchangeRates).toBeUndefined()
  expect({ ...after, expenses: before.expenses }).toEqual(before)
})

test('예산·정산·상세 지출은 더보기에서 동작하고 접으면 내역으로 돌아옴', async ({
  page,
}) => {
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '가계부')
  await openExpenseTools(page)
  await page.getByRole('tab', { name: '예산', exact: true }).click()
  await expect(page.getByLabel('기준 통화')).toBeVisible()
  await page.getByLabel('전체 여행 예산', { exact: true }).fill('100000')
  await page
    .getByRole('button', { name: '환율·전체 예산 저장', exact: true })
    .click()
  await page.locator('.expense-more > summary').click()
  await expect(
    page.getByRole('tab', { name: '지출', exact: true }),
  ).toBeHidden()
  await expect(page.locator('.expense-list')).toBeVisible()
  await openExpenseTools(page)
  await page.getByRole('tab', { name: '정산', exact: true }).click()
  await expect(page.locator('.settlement-view')).toBeVisible()
  await page.getByRole('button', { name: '자세히 기록', exact: true }).click()
  await expect(page.locator('.expense-form')).toBeVisible()
  await page
    .locator('.expense-form')
    .getByRole('button', { name: '취소', exact: true })
    .click()
  expect((await stored(page)).totalBudget).toBe(100000)
})

test('준비는 예약·준비물·자료로 시작하고 준비물은 이름 하나로 추가·완료', async ({
  page,
}) => {
  await seed(page)
  await openTrips(page)
  await openWorkspace(page, '여행 준비')
  const before = await stored(page)
  await expect(page.locator('.dashboard-cards > button')).toHaveCount(3)
  await expect(page.getByRole('region', { name: '여행 점검' })).toBeHidden()
  await expect(page.getByLabel('긴급 연락처', { exact: true })).toHaveCount(0)
  await openDisclosure(page, '.preparation-people')
  await expect(page.getByText('개인 숙소', { exact: false })).toBeVisible()
  await page.locator('.preparation-people > summary').click()
  expect(await stored(page)).toEqual(before)
  await openWorkspace(page, '준비물')
  expect((await stored(page)).checklist).toHaveLength(0)
  await expect(page.getByLabel('준비물 분류', { exact: true })).toBeHidden()
  await page.getByLabel('새 준비물').fill('보조 배터리')
  await page
    .locator('.quick-add')
    .getByRole('button', { name: '추가', exact: true })
    .click()
  await page.getByLabel('보조 배터리', { exact: true }).check()
  expect((await stored(page)).checklist[0]).toMatchObject({
    title: '보조 배터리',
    done: true,
    category: '기타',
  })
  await page.getByRole('button', { name: '준비물 편집', exact: true }).click()
  await page
    .getByRole('button', { name: '보조 배터리 준비물 삭제', exact: true })
    .click()
  await page
    .getByRole('button', { name: '기본 준비물 담기', exact: true })
    .click()
  expect((await stored(page)).checklist).toHaveLength(8)
})

test('새 장소는 유형·시각·메모만 보이고 검색 방법은 원하는 때에만 변경', async ({
  page,
}) => {
  await seed(page)
  await openTrips(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByRole('button', { name: '새 장소 추가', exact: true }).click()
  const form = page.getByRole('dialog')
  await expect(form.getByLabel('장소 검색 서비스')).toBeHidden()
  await expect(form.getByLabel('일정의 도시')).toHaveCount(0)
  await expect(form.getByLabel('메모', { exact: true })).toBeVisible()
  await form.getByLabel('장소 또는 일정 이름').fill('저녁 산책')
  await form.getByLabel('일정 유형').selectOption('체험')
  await form.getByLabel('방문 시간', { exact: true }).fill('19:30')
  await form.getByLabel('메모', { exact: true }).fill('우산 챙기기')
  await openSearchOptions(page)
  await expect(form.getByLabel('장소 검색 서비스')).toHaveValue('osm')
  await page.locator('.search-options > summary').click()
  await form.getByRole('button', { name: '일정에 추가', exact: true }).click()
  const stop = (await stored(page)).days[0].at(-1)
  expect(stop).toMatchObject({
    time: '19:30',
    note: '우산 챙기기',
    custom: { kind: '체험', name: '저녁 산책' },
  })
  expect(stop.custom.coordinates).toBeUndefined()
})

test('320px와 큰 글자에서 주요 화면·더보기·입력에 가로 넘침이 없음', async ({
  page,
}, info) => {
  await seed(page)
  await openTrips(page)
  await page.setViewportSize({ width: 320, height: 800 })
  await page.addStyleTag({ content: ':root { font-size:20px !important; }' })
  for (const screen of ['일정', '가계부', '여행 준비', '준비물']) {
    await openWorkspace(page, screen)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      screen,
    ).toBe(true)
  }
  await openWorkspace(page, '가계부')
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  const form = page.getByRole('dialog')
  await form
    .getByLabel('지출 이름')
    .fill('とても長い名前의 점심 장소와 커피 기록')
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await screenshot(page, info, 'narrow-form')
})

test('선택 항목을 접어도 입력 오류가 있으면 다시 펼쳐 수정할 수 있음', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await openCreateOptions(page)
  await page.getByLabel('함께하는 인원').selectOption('custom')
  await page.getByLabel('동행 인원 직접 입력').fill('')
  await page.locator('.create-options > summary').click()
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByLabel('동행 인원 직접 입력')).toBeVisible()
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1') || '{"trips":[]}')
          .trips.length,
    ),
  ).toBe(0)
  await page.getByLabel('동행 인원 직접 입력').fill('12')
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  expect((await stored(page)).travelers).toBe(13)
})
