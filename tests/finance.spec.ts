import { test, expect } from '@playwright/test'
import {
  convertedTotal,
  currencyTotals,
  splitEvenly,
  settlements,
  expensesCsv,
  syncReservation,
  reservationNote,
} from '../src/finance'
import {
  tripSchema,
  type Trip,
  type Expense,
  type Reservation,
} from '../src/travel-model'
import { timeConflicts } from '../src/journey-progress'
const trip = (): Trip => ({
  id: 'finance-trip',
  title: '정산 여행',
  cityId: 'personal-paris',
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  travelers: 3,
  days: [[], [], []],
  destinations: [{ id: 'paris', name: '파리', country: '프랑스' }],
  dayDestinationIds: ['paris', 'paris', 'paris'],
  members: [
    { id: 'a', name: '민수' },
    { id: 'b', name: '지수' },
    { id: 'c', name: '수진' },
  ],
})
const expense = (
  id: string,
  amount: number,
  patch: Partial<Expense> = {},
): Expense => ({
  id,
  title: id,
  amount,
  currency: 'EUR',
  date: '2026-11-01',
  category: '식비',
  payer: '',
  ...patch,
})

test('동행인 균등 분담은 센트·원·엔 단위의 합계와 공평한 나머지를 보존', () => {
  expect(
    splitEvenly(10.01, 'EUR', ['a', 'b', 'c']).map((item) => item.amount),
  ).toEqual([3.34, 3.34, 3.33])
  expect(
    splitEvenly(100, 'JPY', ['a', 'b', 'c']).map((item) => item.amount),
  ).toEqual([34, 33, 33])
  for (const [currency, units] of [
    ['EUR', 100],
    ['USD', 100],
    ['KRW', 1],
    ['JPY', 1],
  ] as const)
    for (const amount of [1, 7, 31, 1001])
      for (let people = 1; people <= 10; people++) {
        const shares = splitEvenly(
          amount / units,
          currency,
          Array.from({ length: people }, (_, index) => String(index)),
        ).map((item) => Math.round(item.amount * units))
        expect(shares.reduce((sum, value) => sum + value, 0)).toBe(amount)
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1)
      }
})
test('환불과 여러 결제자를 반영하고 개인 경비를 제외하며 통화별 정산 분리', () => {
  const source = trip()
  source.expenses = [
    expense('dinner', 90, {
      payerId: 'a',
      splits: splitEvenly(90, 'EUR', ['a', 'b', 'c']),
    }),
    expense('taxi', 30, {
      payerId: 'b',
      splits: splitEvenly(30, 'EUR', ['a', 'b', 'c']),
    }),
    expense('refund', 30, {
      direction: 'refund',
      payerId: 'a',
      splits: splitEvenly(30, 'EUR', ['a', 'b', 'c']),
    }),
    expense('personal', 20),
    expense('train', 100, {
      currency: 'JPY',
      payerId: 'a',
      splits: splitEvenly(100, 'JPY', ['a', 'b', 'c']),
    }),
  ]
  expect(tripSchema.safeParse(source).success).toBeTruthy()
  const result = settlements(source)
  expect(result.excluded).toBe(1)
  expect(
    result.groups.find((group) => group.currency === 'EUR')?.transfers,
  ).toEqual([{ from: 'c', to: 'a', amount: 30 }])
  expect(
    result.groups.find((group) => group.currency === 'JPY')?.transfers,
  ).toEqual([
    { from: 'b', to: 'a', amount: 33 },
    { from: 'c', to: 'a', amount: 33 },
  ])
  for (const group of result.groups)
    expect(group.balances.reduce((sum, item) => sum + item.amount, 0)).toBe(0)
  expect(
    currencyTotals(source.expenses).find((item) => item.currency === 'EUR')
      ?.total,
  ).toBe(110)
})
test('환산은 입력된 환율만 사용하고 미입력 통화와 전액 환불을 정확히 처리', () => {
  const source = trip()
  source.expenses = [
    expense('meal', 30),
    expense('train', 1000, { currency: 'JPY' }),
    expense('hotel', 50000, { currency: 'KRW' }),
    expense('partial-refund', 100, { currency: 'JPY', direction: 'refund' }),
  ]
  source.exchangeRates = { EUR: 1500 }
  expect(convertedTotal(source)).toEqual({
    currency: 'KRW',
    total: 95000,
    missing: ['JPY'],
  })
  source.exchangeRates.JPY = 9.2
  expect(convertedTotal(source)).toEqual({
    currency: 'KRW',
    total: 103280,
    missing: [],
  })
  source.expenses = [
    expense('cancelled', 50),
    expense('refund', 50, { direction: 'refund' }),
  ]
  source.exchangeRates = {}
  expect(convertedTotal(source)).toEqual({
    currency: 'KRW',
    total: 0,
    missing: [],
  })
})
test('분담 합계 오류·없는 동행인·중복 분담·잘못된 예산은 백업에서 거부', () => {
  const source = trip()
  const good = expense('meal', 10.01, {
    payerId: 'a',
    splits: [
      { memberId: 'a', amount: 3.34 },
      { memberId: 'b', amount: 3.34 },
      { memberId: 'c', amount: 3.33 },
    ],
  })
  source.expenses = [good]
  expect(tripSchema.safeParse(source).success).toBeTruthy()
  for (const splits of [
    [{ memberId: 'a', amount: 10 }],
    [{ memberId: 'missing', amount: 10.01 }],
    [
      { memberId: 'a', amount: 5 },
      { memberId: 'a', amount: 5.01 },
    ],
    [{ memberId: 'a', amount: 10.001 }],
  ])
    expect(
      tripSchema.safeParse({ ...source, expenses: [{ ...good, splits }] })
        .success,
    ).toBeFalsy()
  expect(
    tripSchema.safeParse({ ...source, totalBudget: 0.5, baseCurrency: 'KRW' })
      .success,
  ).toBeFalsy()
  expect(
    tripSchema.safeParse({ ...source, members: source.members!.slice(0, 2) })
      .success,
  ).toBeFalsy()
})
test('예약 수정은 연결 일정의 날짜를 옮기고 사용자 메모·방문 상태를 보존', () => {
  const source = trip(),
    old: Reservation = {
      id: 'hotel',
      title: '파리 숙소',
      kind: '숙소',
      date: '2026-11-01',
      time: '15:00',
      reference: 'BOOK-42',
      address: 'Old address',
      link: 'https://example.com/hotel',
      note: '원래 예약 메모',
      status: 'confirmed',
    }
  source.reservations = [old]
  source.days[0] = [
    {
      id: 'hotel-stop',
      placeId: 'custom-hotel',
      time: old.time,
      note: reservationNote(old),
      reservationId: old.id,
      status: 'done',
      durationMinutes: 60,
      custom: {
        name: old.title,
        kind: '숙소',
        address: old.address,
        link: old.link,
        destinationId: 'paris',
      },
    },
  ]
  const next = {
    ...old,
    date: '2026-11-03',
    time: '16:00',
    address: 'New address',
    note: '새 체크인 안내',
  }
  const result = syncReservation(source, old, next)
  expect(result.days[0]).toEqual([])
  expect(result.days[2][0]).toMatchObject({
    time: '16:00',
    note: '예약 번호: BOOK-42\n새 체크인 안내',
    status: 'done',
    durationMinutes: 60,
    custom: { address: 'New address' },
  })
  expect(
    syncReservation(source, old, { ...next, kind: '교통' }).days[2][0].custom
      ?.kind,
  ).toBe('이동')
  source.days[0][0].note = '사용자가 직접 남긴 메모'
  source.days[0][0].time = '17:00'
  expect(syncReservation(source, old, next).days[2][0]).toMatchObject({
    time: '17:00',
    note: '사용자가 직접 남긴 메모',
  })
})
test('겹치는 일정은 입력된 체류 시간으로만 계산하고 완료·건너뜀·취소는 제외', () => {
  const source = trip()
  source.days[0] = ['a', 'b', 'c'].map((id, index) => ({
    id,
    placeId: 'custom-' + id,
    time: index === 0 ? '10:00' : '10:30',
    note: '',
    durationMinutes: index === 2 ? undefined : index === 0 ? 60 : 30,
    custom: {
      name: id,
      kind: '관광',
      address: '',
      link: '',
      destinationId: 'paris',
    },
  }))
  expect(timeConflicts(source, 0)).toEqual([{ first: 'a', second: 'b' }])
  source.days[0][0].status = 'done'
  expect(timeConflicts(source, 0)).toEqual([])
  source.days[0][0].status = 'planned'
  source.days[0][1].status = 'skipped'
  expect(timeConflicts(source, 0)).toEqual([])
})
test('CSV는 한글과 따옴표를 보존하고 스프레드시트 수식 실행을 막음', () => {
  const source = trip()
  source.expenses = [
    expense('formula', 10, {
      title: '=SUM(1,2)',
      payer: '\t+HYPERLINK()',
      note: '메모, "영수증"',
    }),
  ]
  const text = expensesCsv(source)
  expect(text.startsWith('\ufeff')).toBeTruthy()
  expect(text).toContain("'=SUM(1,2)")
  expect(text).toContain("'\t+HYPERLINK()")
  expect(text).toContain('"메모, ""영수증"""')
})

test('자유 도시 여행의 AED·SGD·CHF 경비도 저장하고 입력 환율로 환산', () => {
  const source = trip()
  source.expenses = [
    expense('dubai', 100, { currency: 'AED' }),
    expense('singapore', 20.5, { currency: 'SGD' }),
    expense('swiss', 10.25, { currency: 'CHF' }),
  ]
  source.exchangeRates = { AED: 350, SGD: 1000, CHF: 1600 }
  expect(tripSchema.safeParse(source).success).toBeTruthy()
  expect(convertedTotal(source)).toEqual({
    currency: 'KRW',
    total: 71900,
    missing: [],
  })
})
