import { dayCount } from './store'
import {
  currencies,
  destinationForDay,
  type Currency,
  type Expense,
  type Stop,
  type Trip,
  stopDetails,
} from './travel-model'
const countryCurrencies: Record<string, Currency> = {
  일본: 'JPY',
  Japan: 'JPY',
  한국: 'KRW',
  대한민국: 'KRW',
  프랑스: 'EUR',
  이탈리아: 'EUR',
  스페인: 'EUR',
  그리스: 'EUR',
  독일: 'EUR',
  포르투갈: 'EUR',
  네덜란드: 'EUR',
  오스트리아: 'EUR',
  벨기에: 'EUR',
  아일랜드: 'EUR',
  핀란드: 'EUR',
  영국: 'GBP',
  미국: 'USD',
  '미국령 괌': 'USD',
  괌: 'USD',
  '북마리아나 제도': 'USD',
  사이판: 'USD',
  태국: 'THB',
  베트남: 'VND',
  대만: 'TWD',
  홍콩: 'HKD',
  중국: 'CNY',
  싱가포르: 'SGD',
  인도네시아: 'IDR',
  말레이시아: 'MYR',
  필리핀: 'PHP',
  호주: 'AUD',
  뉴질랜드: 'NZD',
  캐나다: 'CAD',
  스위스: 'CHF',
  아랍에미리트: 'AED',
  튀르키예: 'TRY',
  체코: 'CZK',
  헝가리: 'HUF',
  덴마크: 'DKK',
  스웨덴: 'SEK',
  노르웨이: 'NOK',
}
const preferenceKey = (trip: Trip, day: number) =>
  `jido-expense-pref:${trip.id}:${destinationForDay(trip, day).id}`
export function expensePreferences(trip: Trip, day: number) {
  let saved: { currency?: Currency; payerId?: string } = {}
  try {
    saved =
      JSON.parse(localStorage.getItem(preferenceKey(trip, day)) || '{}') || {}
  } catch {
    /* Optional preference. */
  }
  return {
    currency: currencies.includes(saved.currency as Currency)
      ? saved.currency!
      : (Object.hasOwn(countryCurrencies, destinationForDay(trip, day).country)
          ? countryCurrencies[destinationForDay(trip, day).country]
          : undefined) ||
        trip.baseCurrency ||
        'KRW',
    payerId:
      trip.members?.find((member) => member.id === saved.payerId)?.id ||
      trip.members?.[0]?.id ||
      '',
  }
}
export function rememberExpense(trip: Trip, expense: Expense) {
  const day = Math.max(
    0,
    Math.min(trip.days.length - 1, dayCount(trip.startDate, expense.date) - 1),
  )
  try {
    localStorage.setItem(
      preferenceKey(trip, day),
      JSON.stringify({ currency: expense.currency, payerId: expense.payerId }),
    )
  } catch {
    /* The expense itself has already been saved. */
  }
}
export function expenseCategoryFor(stop?: Stop): Expense['category'] {
  const category = stop && stopDetails(stop).category
  return category === '맛집' || category === '카페'
    ? '식비'
    : category === '숙소'
      ? '숙박'
      : category === '이동'
        ? '교통'
        : category === '관광'
          ? '관광'
          : '기타'
}
