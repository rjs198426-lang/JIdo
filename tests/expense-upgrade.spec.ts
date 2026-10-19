import { test, expect, type Page } from '@playwright/test'
import { settlements, convertedTotal, splitEvenly } from '../src/finance'
import { filterExpenses, memberSpending } from '../src/expense-insights'
import {
  tripSchema,
  type Trip,
  type SettlementPayment,
} from '../src/travel-model'
import { portableTrip } from '../src/TravelBackup'
import { companionBackup } from '../src/journey-personal'
import { fullManifest, inspectFullBackup } from '../src/full-backup'
import { zipSync, strToU8 } from 'fflate'
import { openTrips, openWorkspace, openExpenseTools } from './navigation'
function fixture(): Trip {
  return tripSchema.parse({
    id: 'expense-upgrade',
    title: '교토 가계부 여행',
    cityId: 'kyoto',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    travelers: 2,
    members: [
      { id: 'me', name: '나' },
      { id: 'friend', name: '동행' },
    ],
    days: [
      [{ id: 'temple', placeId: 'kiyomizu', time: '10:00', note: '일정 메모' }],
      [],
      [],
    ],
    baseCurrency: 'KRW',
    totalBudget: 100000,
    exchangeRates: { JPY: 10 },
    expenses: [
      {
        id: 'dinner',
        title: '저녁 식사',
        date: '2026-11-01',
        amount: 6000,
        currency: 'JPY',
        category: '식비',
        payer: '나',
        payerId: 'me',
        paymentMethod: '카드',
        splits: splitEvenly(6000, 'JPY', ['me', 'friend']),
        note: '창가 예약 메모',
      },
      {
        id: 'taxi',
        title: '숙소 택시',
        date: '2026-11-02',
        amount: 1000,
        currency: 'JPY',
        category: '교통',
        payer: '동행',
        payerId: 'friend',
        paymentMethod: '현금',
        splits: splitEvenly(1000, 'JPY', ['me', 'friend']),
        note: '공항 이동',
      },
      {
        id: 'refund',
        title: '식사 부분 환불',
        date: '2026-11-02',
        amount: 1000,
        currency: 'JPY',
        category: '식비',
        payer: '나',
        payerId: 'me',
        paymentMethod: '카드',
        direction: 'refund',
        splits: splitEvenly(1000, 'JPY', ['me', 'friend']),
      },
      {
        id: 'souvenir',
        title: '개인 선물',
        date: '2026-11-03',
        amount: 500,
        currency: 'JPY',
        category: '쇼핑',
        payer: '동행',
        payerId: 'friend',
        paymentMethod: '현금',
      },
    ],
    checklist: [{ id: 'passport', title: '여권', done: false }],
    attachments: [],
  })
}
const payment = (amount = 500): SettlementPayment => ({
  id: 'paid',
  from: 'friend',
  to: 'me',
  amount,
  currency: 'JPY',
  date: '2026-11-04',
  note: '확인한 송금',
})
const filters = {
  date: '',
  category: '전체',
  currency: '전체',
  query: '',
  payment: '전체',
  payer: '전체',
  direction: '전체',
}

test('송금은 정산 잔액만 줄이고 순지출·예산·실제 부담액을 변경하지 않음', () => {
  const before = fixture(),
    after = { ...before, settlementPayments: [payment()] }
  expect(settlements(before).groups[0].transfers).toEqual([
    { from: 'friend', to: 'me', amount: 2000 },
  ])
  expect(settlements(after).groups[0].transfers).toEqual([
    { from: 'friend', to: 'me', amount: 1500 },
  ])
  expect(convertedTotal(after)).toEqual(convertedTotal(before))
  expect(memberSpending(after, 'friend')).toEqual(
    memberSpending(before, 'friend'),
  )
  expect(
    settlements({ ...before, settlementPayments: [payment(2000)] }).groups[0]
      .transfers,
  ).toEqual([])
  expect(
    settlements({ ...before, settlementPayments: [payment(2500)] }).groups[0]
      .transfers,
  ).toEqual([{ from: 'me', to: 'friend', amount: 500 }])
})

test('다중 통화·센트 송금·환불과 부분 정산의 합계 보존', () => {
  const trip = fixture()
  trip.expenses!.push({
    ...trip.expenses![0],
    id: 'euro',
    amount: 10.01,
    currency: 'EUR',
    splits: splitEvenly(10.01, 'EUR', ['me', 'friend']),
  })
  trip.settlementPayments = [
    payment(),
    { ...payment(), id: 'eur-pay', amount: 2.05, currency: 'EUR' },
  ]
  expect(tripSchema.safeParse(trip).success).toBe(true)
  const groups = settlements(trip).groups
  expect(groups.find((g) => g.currency === 'EUR')?.transfers).toEqual([
    { from: 'friend', to: 'me', amount: 2.95 },
  ])
  for (const group of groups)
    expect(
      Math.round(
        group.balances.reduce((sum, item) => sum + item.amount, 0) * 100,
      ),
    ).toBe(0)
})

test('송금 기록의 잘못된 사람·금액·날짜·중복 ID는 백업 검증에서 거부', () => {
  const trip = fixture()
  for (const value of [
    { ...payment(), from: 'me' },
    { ...payment(), to: 'missing' },
    { ...payment(), amount: 0 },
    { ...payment(), amount: -1 },
    { ...payment(), amount: 0.5 },
    { ...payment(), date: '2026-02-30' },
  ])
    expect(
      tripSchema.safeParse({ ...trip, settlementPayments: [value] }).success,
    ).toBe(false)
  expect(
    tripSchema.safeParse({
      ...trip,
      settlementPayments: [payment(), payment()],
    }).success,
  ).toBe(false)
  expect(
    tripSchema.safeParse({
      ...trip,
      expenses: [],
      settlementPayments: [payment()],
      members: trip.members!.slice(0, 1),
      travelers: 1,
    }).success,
  ).toBe(false)
})

test('기존 백업 호환·새 송금 보존·동행자 일정에서는 경비와 송금을 제외', () => {
  expect(tripSchema.safeParse(fixture()).success).toBe(true)
  const trip = { ...fixture(), settlementPayments: [payment()] }
  const portable = portableTrip(trip)
  expect(
    tripSchema.parse(JSON.parse(JSON.stringify(portable))).settlementPayments,
  ).toEqual([payment()])
  expect(JSON.parse(companionBackup(trip)).trips[0].expenses).toBeUndefined()
  expect(
    JSON.parse(companionBackup(trip)).trips[0].settlementPayments,
  ).toBeUndefined()
})

test('실제 부담은 균등 평균이 아닌 사용자 분담·개인 경비·환불을 반영', () => {
  const trip = fixture()
  trip.expenses![0].splits = [
    { memberId: 'me', amount: 1000 },
    { memberId: 'friend', amount: 5000 },
  ]
  expect(memberSpending(trip, 'friend').share).toEqual([
    { currency: 'JPY', total: 5500 },
  ])
  expect(memberSpending(trip, 'me').share).toEqual([
    { currency: 'JPY', total: 1000 },
  ])
  expect(memberSpending(trip, 'friend').paid).toEqual([
    { currency: 'JPY', total: 1500 },
  ])
})

test('복합 검색은 이름·메모·결제자와 유형·통화·수단을 함께 적용', () => {
  const trip = fixture()
  expect(
    filterExpenses(trip, { ...filters, query: '창가 나' }).map((e) => e.id),
  ).toEqual(['dinner'])
  expect(
    filterExpenses(trip, {
      ...filters,
      payment: '현금',
      payer: 'friend',
      date: '2026-11-02',
    }).map((e) => e.id),
  ).toEqual(['taxi'])
  expect(
    filterExpenses(trip, {
      ...filters,
      direction: 'refund',
      category: '식비',
      currency: 'JPY',
    }).map((e) => e.id),
  ).toEqual(['refund'])
})

async function seed(page: Page, trip = fixture()) {
  await page.route('https://**', (route) => route.abort())
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
  await openWorkspace(page, '가계부')
}
const ledgerTab = async (page: Page, name: string) => {
  await openExpenseTools(page)
  await page
    .getByRole('tablist', { name: '가계부 보기' })
    .getByRole('tab', { name, exact: true })
    .click()
}
const state = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )

test('빠른 기록·예산 진행률·선택일 내역이 실제 기록에 연결', async ({
  page,
}) => {
  await seed(page)
  await expect(page.locator('.money-overview')).toContainText('₩65,000')
  await expect(
    page.getByRole('progressbar', { name: '전체 예산 사용률' }),
  ).toHaveAttribute('value', '65000')
  await page.getByRole('button', { name: '선택일 지출 내역 보기' }).click()
  await expect(page.locator('.expense-list > article')).toHaveCount(1)
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '빠른 지출 기록' })
  await dialog.getByLabel('금액', { exact: true }).fill('350')
  await dialog.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect((await state(page)).expenses.at(-1)).toMatchObject({
    amount: 350,
    currency: 'JPY',
    date: '2026-11-01',
  })
  await expect(page.locator('.expense-filter-summary')).toContainText(
    '전체 내역 5건',
  )
})

test('검색·추가 필터·조회 합계·CSV 범위와 초기화', async ({ page }) => {
  await seed(page)
  await page.getByLabel('지출 검색').fill('공항')
  await expect(page.locator('.expense-list > article')).toHaveCount(1)
  await expect(page.locator('.expense-filter-summary')).toContainText(
    'JP¥1,000',
  )
  await page.getByRole('button', { name: '조회 내역 CSV 복사' }).click()
  await expect(page.getByLabel('조회 내역 CSV')).toHaveValue(/숙소 택시/)
  await expect(page.getByLabel('조회 내역 CSV')).not.toHaveValue(/저녁 식사/)
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await page.getByRole('button', { name: '필터', exact: true }).click()
  await page.getByLabel('지출 유형 필터').selectOption('refund')
  await expect(page.locator('.expense-filter-summary')).toContainText(
    '-JP¥1,000',
  )
  await expect(page.locator('.expense-list > article')).toHaveCount(1)
  await expect(page.locator('.expense-list')).toContainText('식사 부분 환불')
  await page.getByLabel('지출 결제수단 필터').selectOption('현금')
  await expect(page.locator('.expense-list > article')).toHaveCount(0)
})

test('통계 그래프에서 내역 이동·개인 실제 분담 표시', async ({ page }) => {
  await seed(page)
  await ledgerTab(page, '통계')
  await expect(
    page.getByRole('region', { name: '사람별 실제 부담' }),
  ).toContainText('JP¥3,000')
  await page.getByLabel('확인할 사람').selectOption('friend')
  await expect(
    page.getByRole('region', { name: '사람별 실제 부담' }),
  ).toContainText('JP¥1,500')
  await page.getByRole('button', { name: '식비 JPY 지출 내역 보기' }).click()
  await expect(page.locator('.expense-list > article')).toHaveCount(2)
  await expect(page.locator('.expense-filter-summary')).toContainText(
    'JP¥5,000',
  )
  await expect(page.getByLabel('지출 분류 필터')).toHaveValue('식비')
})

test('부분 송금·완료·삭제 취소·재실행과 원본 지출 보존', async ({ page }) => {
  await seed(page)
  const before = await state(page)
  await ledgerTab(page, '정산')
  await page
    .getByRole('button', { name: '동행에서 나 JPY 송금 기록', exact: true })
    .click()
  await page.getByLabel('송금 금액', { exact: true }).fill('500')
  await page.getByLabel('송금 메모').fill('송금 확인')
  await page
    .getByRole('button', { name: '송금 기록 저장', exact: true })
    .click()
  await expect(page.locator('.settlement-transfer')).toContainText('JP¥1,500')
  expect((await state(page)).expenses).toEqual(before.expenses)
  await expect(page.locator('.money-overview')).toContainText('₩65,000')
  await page
    .getByRole('button', { name: '동행에서 나 JPY 송금 기록', exact: true })
    .click()
  await page
    .getByRole('button', { name: '송금 기록 저장', exact: true })
    .click()
  await expect(page.locator('.settlement-transfer')).toHaveCount(0)
  await expect(page.locator('.settlement-group')).toContainText(
    '서로 주고받을 금액이 없어요.',
  )
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '가계부')
  await ledgerTab(page, '정산')
  await expect(page.locator('.settlement-history article')).toHaveCount(2)
  await page
    .getByRole('button', { name: '동행에서 나 JPY 송금 기록 삭제' })
    .first()
    .click()
  await expect(page.locator('.settlement-transfer')).toHaveCount(1)
  await page.getByRole('button', { name: '송금 기록 삭제 취소' }).click()
  await expect(page.locator('.settlement-transfer')).toHaveCount(0)
})

test('미저장 송금 초안·취소·본인 송금 거부와 참조 동행인 삭제 방지', async ({
  page,
}) => {
  const trip = fixture()
  trip.expenses = []
  trip.settlementPayments = [payment()]
  await seed(page, trip)
  await ledgerTab(page, '정산')
  await page.getByRole('button', { name: '동행인 편집', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '동행 동행인 삭제', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('button', { name: '송금 기록 추가' }).click()
  await page.getByLabel('송금 금액', { exact: true }).fill('100')
  await page.getByLabel('송금 받은 사람', { exact: true }).selectOption('me')
  await page.getByRole('button', { name: '송금 기록 저장' }).click()
  await expect(page.getByRole('alert')).toContainText('서로 다른 동행인')
  await page.reload()
  await openTrips(page)
  await openWorkspace(page, '가계부')
  await ledgerTab(page, '정산')
  await expect(page.getByLabel('송금 금액', { exact: true })).toHaveValue('100')
  await page.getByRole('button', { name: '송금 기록 취소' }).click()
  expect((await state(page)).settlementPayments).toEqual([payment()])
})

test('예산 통화 변경은 기존 금액을 새 통화로 조용히 재해석하지 않음', async ({
  page,
}) => {
  await seed(page)
  await ledgerTab(page, '예산')
  await page.getByLabel('기준 통화', { exact: true }).selectOption('JPY')
  await expect(page.getByLabel('전체 여행 예산', { exact: true })).toHaveValue(
    '',
  )
  await page.getByLabel('전체 여행 예산', { exact: true }).fill('9000')
  await page.getByRole('button', { name: '환율·전체 예산 저장' }).click()
  const saved = await state(page)
  expect(saved.baseCurrency).toBe('JPY')
  expect(saved.totalBudget).toBe(9000)
  expect(saved.exchangeRates).toEqual({})
  await expect(page.locator('.money-overview')).toContainText('JP¥2,500')
})

test('환율 미입력과 0 예산은 가짜 환산 합계·NaN 사용률을 표시하지 않음', async ({
  page,
}) => {
  const trip = fixture()
  trip.exchangeRates = {}
  trip.totalBudget = 0
  await seed(page, trip)
  await expect(page.locator('.money-overview')).toContainText(
    '통화별 사용 금액',
  )
  await expect(page.locator('.money-overview')).toContainText(
    '환율 입력 후 비교',
  )
  await ledgerTab(page, '예산')
  await page.getByLabel('환율 통화').selectOption('JPY')
  await page.getByLabel('환율 값').fill('10')
  await page.getByRole('button', { name: '환율·전체 예산 저장' }).click()
  await expect(page.locator('.money-overview')).toContainText('예산 초과')
  await expect(page.locator('.money-overview')).not.toContainText(
    /NaN|Infinity/,
  )
})

test('Android CSV는 시스템 파일 저장 브리지로 전달하고 취소·실패에서 원본 보존', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.exports = []
    w.csvFailure = false
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'TravelBackup',
          methods: [{ name: 'saveDocument', rtype: 'promise' }],
        },
      ],
      nativePromise: (plugin: string, method: string, options: any) => {
        w.exports.push({ plugin, method, options })
        return w.csvFailure
          ? Promise.reject(new Error('save failed'))
          : Promise.resolve({ cancelled: true })
      },
    }
  })
  await seed(page)
  const before = await state(page)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  await ledgerTab(page, '통계')
  await page.getByRole('button', { name: 'CSV 저장', exact: true }).click()
  await expect(
    page.getByText('CSV 저장을 취소했어요.', { exact: true }),
  ).toBeVisible()
  const calls = await page.evaluate(() => (window as any).exports)
  expect(calls[0]).toMatchObject({
    plugin: 'TravelBackup',
    method: 'saveDocument',
    options: { format: 'csv' },
  })
  expect(calls[0].options.text).toContain('저녁 식사')
  await page.evaluate(() => {
    ;(window as any).csvFailure = true
  })
  await page.getByRole('button', { name: 'CSV 저장', exact: true }).click()
  await expect(page.getByText(/파일 저장을 열지 못했어요/)).toBeVisible()
  expect(await state(page)).toEqual(before)
})

test('320px 큰 글자·긴 이름·큰 금액에서도 네 화면·폼·기록에 가로 넘침 없음', async ({
  page,
}, info) => {
  const trip = fixture()
  trip.members![1].name = '아주 긴 이름을 가진 동행자'
  trip.expenses![0].title =
    '아주 오래 기억하고 싶은 교토에서 동행자와 함께한 저녁 식사'
  trip.settlementPayments = [payment()]
  trip.expenses![0].amount = 1e9
  trip.expenses![0].splits = splitEvenly(1e9, 'JPY', ['me', 'friend'])
  await seed(page, trip)
  await page.setViewportSize({ width: 320, height: 740 })
  await page.addStyleTag({
    content: 'button,input,select,textarea {font-size:18px !important}',
  })
  for (const name of ['지출', '통계', '예산', '정산']) {
    await ledgerTab(page, name)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false)
  }
  await page.getByRole('button', { name: '송금 기록 추가' }).click()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
  await page.getByRole('button', { name: '송금 기록 취소' }).click()
  await page.setViewportSize({ width: 393, height: 852 })
  await ledgerTab(page, '지출')
  await page.locator('.expense-manager').scrollIntoViewIfNeeded()
  await page.screenshot({ path: info.outputPath('expenses-upgraded.png') })
})

test('ZIP 백업도 실제 송금·지출·일정 원본을 보존하고 손상된 송금 참조를 거부', async () => {
  const trip = { ...fixture(), settlementPayments: [payment()] }
  const manifest = fullManifest([trip])
  const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
  const preview = await inspectFullBackup(
    new File([new Uint8Array(zip)], 'money.zip'),
  )
  expect(preview?.manifest.trips[0].settlementPayments).toEqual(
    trip.settlementPayments,
  )
  expect(preview?.manifest.trips[0].expenses).toEqual(trip.expenses)
  expect(preview?.manifest.trips[0].days[0][0].note).toBe('일정 메모')
  manifest.trips[0].settlementPayments![0].to = 'missing-member'
  const bad = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
  await expect(
    inspectFullBackup(new File([new Uint8Array(bad)], 'bad-money.zip')),
  ).rejects.toThrow()
})

test('같은 여행지의 마지막 결제수단을 빠른 기록과 상세 입력에서 기억', async ({
  page,
}) => {
  await seed(page)
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  let dialog = page.getByRole('dialog', { name: '빠른 지출 기록' })
  await dialog.getByLabel('금액', { exact: true }).fill('300')
  await dialog.getByText('더 입력하기', { exact: true }).click()
  await dialog.getByLabel('결제 수단').selectOption('현금')
  await dialog.getByRole('button', { name: '지출 저장', exact: true }).click()
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  dialog = page.getByRole('dialog', { name: '빠른 지출 기록' })
  await dialog.getByLabel('금액', { exact: true }).fill('400')
  await dialog.getByRole('button', { name: '지출 저장', exact: true }).click()
  expect((await state(page)).expenses.at(-1).paymentMethod).toBe('현금')
  await openExpenseTools(page)
  await page.getByRole('button', { name: '자세히 기록', exact: true }).click()
  await expect(page.getByLabel('결제 수단', { exact: true })).toHaveValue(
    '현금',
  )
})

test('과거 결제수단 미지정 지출의 메모를 수정해도 카드 결제로 바꾸지 않음', async ({
  page,
}) => {
  const trip = fixture()
  delete trip.expenses![0].paymentMethod
  await seed(page, trip)
  await page
    .getByRole('button', { name: '저녁 식사 지출 수정', exact: true })
    .click()
  await expect(page.getByLabel('결제 수단', { exact: true })).toHaveValue('')
  await page.getByText('지출 메모', { exact: true }).click()
  await page.getByLabel('경비 메모').fill('수정한 메모')
  await page
    .getByRole('button', { name: '지출 수정 저장', exact: true })
    .click()
  const saved = (await state(page)).expenses.find(
    (item: any) => item.id === 'dinner',
  )
  expect(saved.paymentMethod).toBeUndefined()
  expect(saved.note).toBe('수정한 메모')
})
