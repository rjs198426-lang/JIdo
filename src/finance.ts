import {
  currencies,
  currencyStep,
  type Currency,
  type Expense,
  type Trip,
  type Reservation,
} from './travel-model'

export const netExpense = (expense: Expense) =>
  (expense.direction === 'refund' ? -1 : 1) * expense.amount
export const expenseCategoryOptions = [
  '식비',
  '교통',
  '숙박',
  '관광',
  '쇼핑',
  '기타',
] as const
export function splitEvenly(
  amount: number,
  currency: Currency,
  memberIds: string[],
) {
  if (!memberIds.length) return []
  const unit = currencyStep(currency),
    units = Math.round(amount / unit)
  const share = Math.floor(units / memberIds.length),
    remainder = units % memberIds.length
  return memberIds.map((memberId, index) => ({
    memberId,
    amount:
      Math.round((share + (index < remainder ? 1 : 0)) * unit * 100) / 100,
  }))
}
export function currencyTotals(expenses: Expense[]) {
  return currencies.flatMap((currency) => {
    const items = expenses.filter((item) => item.currency === currency)
    if (!items.length) return []
    const unit = currencyStep(currency)
    const total =
      items.reduce(
        (sum, item) =>
          sum +
          Math.round(item.amount / unit) *
            (item.direction === 'refund' ? -1 : 1),
        0,
      ) * unit
    return [{ currency, total: Math.round(total * 100) / 100 }]
  })
}
export function convertedTotal(trip: Trip, expenses = trip.expenses || []) {
  const base = trip.baseCurrency || 'KRW'
  const missing = new Set<Currency>()
  let total = 0
  for (const { currency, total: spent } of currencyTotals(expenses)) {
    if (spent === 0) continue
    const rate = currency === base ? 1 : trip.exchangeRates?.[currency]
    if (!rate) {
      missing.add(currency)
      continue
    }
    total += spent * rate
  }
  const unit = currencyStep(base)
  return {
    currency: base,
    total: Math.round(Math.round(total / unit) * unit * 100) / 100,
    missing: [...missing],
  }
}
export function settlements(trip: Trip) {
  const members = trip.members || []
  let excluded = 0
  const eligible = (trip.expenses || []).filter((item) => {
    const good =
      item.payerId &&
      members.some((member) => member.id === item.payerId) &&
      item.splits?.length &&
      item.splits.every((split) =>
        members.some((member) => member.id === split.memberId),
      )
    if (!good) excluded++
    return good
  })
  const groups = [
    ...new Set([
      ...eligible.map((item) => item.currency),
      ...(trip.settlementPayments || []).map((item) => item.currency),
    ]),
  ].map((currency) => {
    const unit = currencyStep(currency)
    const balances = new Map(members.map((member) => [member.id, 0]))
    for (const item of eligible.filter((item) => item.currency === currency)) {
      const sign = item.direction === 'refund' ? -1 : 1
      balances.set(
        item.payerId!,
        balances.get(item.payerId!)! + Math.round(item.amount / unit) * sign,
      )
      for (const split of item.splits!)
        balances.set(
          split.memberId,
          balances.get(split.memberId)! -
            Math.round(split.amount / unit) * sign,
        )
    }
    for (const payment of (trip.settlementPayments || []).filter(
      (item) => item.currency === currency,
    )) {
      const units = Math.round(payment.amount / unit)
      balances.set(payment.from, (balances.get(payment.from) || 0) + units)
      balances.set(payment.to, (balances.get(payment.to) || 0) - units)
    }
    const creditors = [...balances]
      .filter(([, units]) => units > 0)
      .map(([id, units]) => ({ id, units }))
      .sort((a, b) => b.units - a.units || a.id.localeCompare(b.id))
    const debtors = [...balances]
      .filter(([, units]) => units < 0)
      .map(([id, units]) => ({ id, units: -units }))
      .sort((a, b) => b.units - a.units || a.id.localeCompare(b.id))
    const transfers: { from: string; to: string; amount: number }[] = []
    for (const debtor of debtors)
      for (const creditor of creditors) {
        const units = Math.min(debtor.units, creditor.units)
        if (!units) continue
        transfers.push({
          from: debtor.id,
          to: creditor.id,
          amount: Math.round(units * unit * 100) / 100,
        })
        debtor.units -= units
        creditor.units -= units
      }
    return {
      currency,
      balances: [...balances].map(([memberId, units]) => ({
        memberId,
        amount: Math.round(units * unit * 100) / 100,
      })),
      transfers,
    }
  })
  return { groups, excluded }
}
export function expensesCsv(trip: Trip) {
  const quote = (value: string | number) =>
    '"' +
    String(value)
      .replace(/^[\s]*[=+\-@]/, "'$&")
      .replaceAll('"', '""') +
    '"'
  const rows = [
    [
      '날짜',
      '이름',
      '유형',
      '금액',
      '통화',
      '분류',
      '결제자',
      '결제수단',
      '메모',
    ],
    ...(trip.expenses || []).map((item) => [
      item.date,
      item.title,
      item.direction === 'refund' ? '환불' : '지출',
      item.amount,
      item.currency,
      item.category,
      trip.members?.find((member) => member.id === item.payerId)?.name ||
        item.payer,
      item.paymentMethod || '',
      item.note || '',
    ]),
  ]
  return '\ufeff' + rows.map((row) => row.map(quote).join(',')).join('\r\n')
}
export function reservationPlaceKind(kind: Reservation['kind']) {
  return kind === '숙소'
    ? '숙소'
    : kind === '항공' || kind === '교통'
      ? '이동'
      : kind === '체험'
        ? '관광'
        : '기타'
}
export function reservationNote(item: Reservation) {
  return [item.reference ? `예약 번호: ${item.reference}` : '', item.note]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000)
}
export function syncReservation(
  trip: Trip,
  previous: Reservation | undefined,
  next: Reservation,
): Trip {
  const reservations = (trip.reservations || []).some(
    (item) => item.id === next.id,
  )
    ? trip.reservations!.map((item) => (item.id === next.id ? next : item))
    : [...(trip.reservations || []), next]
  if (!previous) return { ...trip, reservations }
  const oldDay = Math.round(
    (Date.parse(previous.date) - Date.parse(trip.startDate)) / 86400000,
  )
  const newDay = Math.round(
    (Date.parse(next.date) - Date.parse(trip.startDate)) / 86400000,
  )
  const days = trip.days.map(() => [] as Trip['days'][number])
  trip.days.forEach((items, day) =>
    items.forEach((stop) => {
      if (stop.reservationId !== next.id) {
        days[day].push(stop)
        return
      }
      const targetDay =
        day === oldDay && newDay >= 0 && newDay < days.length ? newDay : day
      days[targetDay].push({
        ...stop,
        time: stop.time === previous.time ? next.time : stop.time,
        note:
          stop.note === reservationNote(previous)
            ? reservationNote(next)
            : stop.note,
        custom: stop.custom
          ? {
              ...stop.custom,
              kind:
                stop.custom.kind === reservationPlaceKind(previous.kind)
                  ? reservationPlaceKind(next.kind)
                  : stop.custom.kind,
              name:
                stop.custom.name === previous.title
                  ? next.title
                  : stop.custom.name,
              address:
                stop.custom.address === previous.address
                  ? next.address
                  : stop.custom.address,
              link:
                stop.custom.link === previous.link
                  ? next.link
                  : stop.custom.link,
            }
          : stop.custom,
      })
    }),
  )
  return { ...trip, reservations, days }
}
