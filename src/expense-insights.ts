import { currencyTotals } from './finance'
import type { Expense, Trip } from './travel-model'
export type ExpenseFilters = {
  date: string
  category: string
  currency: string
  query: string
  payment: string
  payer: string
  direction: string
}
export function filterExpenses(trip: Trip, filters: ExpenseFilters) {
  const words = filters.query
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  return (trip.expenses || []).filter((item) => {
    const payer =
      trip.members?.find((person) => person.id === item.payerId)?.name ||
      item.payer
    const text = [
      item.title,
      item.note,
      payer,
      item.category,
      item.currency,
      String(item.amount),
    ]
      .join(' ')
      .toLocaleLowerCase()
    return (
      (!filters.date || item.date === filters.date) &&
      (filters.category === '전체' || item.category === filters.category) &&
      (filters.currency === '전체' || item.currency === filters.currency) &&
      (filters.payment === '전체' ||
        (filters.payment === '미지정'
          ? !item.paymentMethod
          : item.paymentMethod === filters.payment)) &&
      (filters.payer === '전체' ||
        (filters.payer === '미지정'
          ? !item.payerId
          : item.payerId === filters.payer)) &&
      (filters.direction === '전체' ||
        (item.direction || 'expense') === filters.direction) &&
      words.every((word) => text.includes(word))
    )
  })
}
export function expenseBreakdown(
  expenses: Expense[],
  groupBy: 'date' | 'category' | 'paymentMethod',
) {
  const groups = new Map<string, Expense[]>()
  for (const item of expenses) {
    const key =
      groupBy === 'paymentMethod'
        ? item.paymentMethod || '미지정'
        : item[groupBy]
    const group = groups.get(key) || []
    group.push(item)
    groups.set(key, group)
  }
  return [...groups].map(([label, items]) => ({
    label,
    count: items.length,
    totals: currencyTotals(items),
  }))
}
export function memberSpending(trip: Trip, memberId: string) {
  const paid: Expense[] = [],
    share: Expense[] = [],
    unassigned: Expense[] = []
  for (const item of trip.expenses || []) {
    if (item.payerId === memberId) paid.push(item)
    if (item.splits) {
      const split = item.splits.find((part) => part.memberId === memberId)
      if (split && split.amount > 0)
        share.push({ ...item, amount: split.amount })
    } else if (item.payerId === memberId) share.push(item)
    else if (!item.payerId) unassigned.push(item)
  }
  return {
    paid: currencyTotals(paid),
    share: currencyTotals(share),
    unassigned: unassigned.length,
  }
}
export function categoryRows(trip: Trip) {
  return expenseBreakdown(trip.expenses || [], 'category').flatMap((group) =>
    group.totals.map((item) => ({ category: group.label, ...item })),
  )
}
