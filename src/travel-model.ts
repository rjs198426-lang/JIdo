import { attachmentSchema } from './attachment-schema'
import { z } from 'zod'
import { getCity, getPlace } from './catalog'
import type { City } from './data'

const label = z.string().trim().min(1).max(160)
const id = z.string().min(1).max(100)
export const safeLink = z
  .string()
  .max(1500)
  .refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && !url.username && !url.password
    } catch {
      return false
    }
  }, 'https://로 시작하는 링크를 입력하세요.')
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    )
  })
export const destinationSchema = z.object({
  id,
  name: label,
  country: label,
  guideCityId: id.optional(),
})
export const customPlaceSchema = z.object({
  name: label,
  kind: z.enum(['관광', '맛집', '카페', '숙소', '이동', '기타']),
  address: z.string().trim().max(500),
  link: safeLink,
  destinationId: id,
  googlePlaceId: z.string().min(1).max(300).optional(),
  osmPlaceId: z
    .string()
    .max(100)
    .regex(/^(node|way|relation)\/\d+$/)
    .optional(),
  catalogPlaceId: id.optional(),
  coordinates: z
    .object({
      lat: z.number().finite().min(-90).max(90),
      lng: z.number().finite().min(-180).max(180),
    })
    .optional(),
})
export const stopSchema = z.object({
  id,
  placeId: id,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  note: z.string().max(2000),
  custom: customPlaceSchema.optional(),
  reservationId: id.optional(),
  photoId: z.string().uuid().optional(),
  status: z.enum(['planned', 'done', 'skipped']).optional(),
  durationMinutes: z.number().int().min(5).max(1440).optional(),
})
export const checklistCategories = [
  '서류',
  '예약',
  '통신·환전',
  '짐',
  '기타',
] as const
export const memberSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80),
})
export const checklistSchema = z.object({
  id,
  title: label,
  done: z.boolean(),
  category: z.enum(checklistCategories).optional(),
  dueDate: dateSchema.optional(),
  assigneeId: id.optional(),
  note: z.string().max(500).optional(),
})
export const currencies = [
  'KRW',
  'EUR',
  'USD',
  'JPY',
  'GBP',
  'THB',
  'VND',
  'TWD',
  'CNY',
  'AUD',
  'IDR',
  'CAD',
  'CHF',
  'SGD',
  'HKD',
  'MYR',
  'PHP',
  'NZD',
  'AED',
  'INR',
  'TRY',
  'MXN',
  'BRL',
  'MOP',
  'CZK',
  'PLN',
  'SEK',
  'NOK',
  'DKK',
  'HUF',
] as const
export function currencyStep(currency: string) {
  return ['KRW', 'JPY', 'VND', 'IDR'].includes(currency) ? 1 : 0.01
}
export const expenseSchema = z
  .object({
    id,
    title: label,
    amount: z.number().finite().positive().max(1e9),
    currency: z.enum(currencies),
    date: dateSchema,
    category: z.enum(['식비', '교통', '숙박', '관광', '쇼핑', '기타']),
    payer: z.string().trim().max(80),
    payerId: id.optional(),
    direction: z.enum(['expense', 'refund']).optional(),
    paymentMethod: z.enum(['카드', '현금', '기타']).optional(),
    splits: z
      .array(
        z.object({
          memberId: id,
          amount: z.number().finite().nonnegative().max(1e9),
        }),
      )
      .min(1)
      .max(10)
      .optional(),
    reservationId: id.optional(),
    stopId: id.optional(),
    note: z.string().max(1000).optional(),
  })
  .refine(
    (item) =>
      currencyStep(item.currency) === 1
        ? Number.isInteger(item.amount)
        : Math.abs(item.amount * 100 - Math.round(item.amount * 100)) < 0.0001,
    '통화에 맞는 소수 자릿수를 입력하세요.',
  )
export const reservationSchema = z
  .object({
    id,
    title: label,
    kind: z.enum(['항공', '숙소', '교통', '체험', '기타']),
    date: dateSchema,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    reference: z.string().trim().max(200),
    address: z.string().trim().max(500),
    link: safeLink,
    note: z.string().trim().max(2000),
    status: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
    endDate: dateSchema.optional(),
    cost: z.number().finite().positive().max(1e9).optional(),
    currency: z.enum(currencies).optional(),
    paymentDate: dateSchema.optional(),
  })
  .superRefine((item, ctx) => {
    if (item.endDate && item.endDate < item.date)
      ctx.addIssue({
        code: 'custom',
        message: '이용 종료일은 시작일 이후로 입력하세요.',
      })
    if ((item.cost === undefined) !== (item.currency === undefined))
      ctx.addIssue({
        code: 'custom',
        message: '예약 비용과 통화를 함께 입력하세요.',
      })
    if (
      item.cost !== undefined &&
      item.currency &&
      !validCurrencyAmount(item.cost, item.currency)
    )
      ctx.addIssue({
        code: 'custom',
        message: '통화에 맞는 예약 비용을 입력하세요.',
      })
  })
export function validCurrencyAmount(amount: number, currency: Currency) {
  const scaled = amount / currencyStep(currency)
  return Math.abs(scaled - Math.round(scaled)) < 0.0001
}
export const tripSchema = z
  .object({
    id,
    title: label,
    cityId: id,
    startDate: dateSchema,
    endDate: dateSchema,
    travelers: z.number().int().min(1).max(10),
    days: z.array(z.array(stopSchema).max(200)).min(1).max(21),
    destinations: z.array(destinationSchema).min(1).max(30).optional(),
    dayDestinationIds: z.array(id).max(21).optional(),
    checklist: z.array(checklistSchema).max(500).optional(),
    expenses: z.array(expenseSchema).max(10000).optional(),
    budgets: z
      .partialRecord(
        z.enum(currencies),
        z.number().finite().nonnegative().max(1e12),
      )
      .optional(),
    reservations: z.array(reservationSchema).max(1000).optional(),
    attachments: z.array(attachmentSchema).max(300).optional(),
    members: z.array(memberSchema).min(1).max(10).optional(),
    baseCurrency: z.enum(currencies).optional(),
    totalBudget: z.number().finite().nonnegative().max(1e12).optional(),
    exchangeRates: z
      .partialRecord(
        z.enum(currencies),
        z.number().finite().positive().min(0.00000001).max(1e8),
      )
      .optional(),
    travelInfo: z
      .object({
        emergencyPhone: z.string().max(80),
        insurancePhone: z.string().max(80),
        embassyContact: z.string().max(500),
        lodgingAddress: z.string().max(500),
        note: z.string().max(2000),
      })
      .optional(),
  })
  .superRefine((trip, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message })
    const length =
      Math.round(
        (Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000,
      ) + 1
    if (trip.days.length !== length)
      fail('여행 날짜와 일정 수가 일치하지 않아요.')
    const destinations = tripDestinations(trip)
    const ids = new Set(destinations.map((item) => item.id))
    if (ids.size !== destinations.length) fail('도시 ID가 중복되었어요.')
    if (
      trip.dayDestinationIds &&
      (trip.dayDestinationIds.length !== length ||
        trip.dayDestinationIds.some((id) => !ids.has(id)))
    )
      fail('날짜별 여행 도시를 확인하세요.')
    if (!getCity(trip.cityId) && !trip.destinations?.length)
      fail('여행 도시를 찾을 수 없어요.')
    const members = trip.members || []
    const memberIds = new Set(members.map((member) => member.id))
    if (
      memberIds.size !== members.length ||
      new Set(members.map((member) => member.name.toLocaleLowerCase())).size !==
        members.length
    )
      fail('동행인 이름과 ID가 중복되었어요.')
    if (members.length > trip.travelers)
      fail('동행인 수보다 여행 인원이 적어요.')
    for (const item of trip.checklist || [])
      if (item.assigneeId && !memberIds.has(item.assigneeId))
        fail('준비물 담당자를 확인하세요.')
    for (const expense of trip.expenses || []) {
      if (expense.payerId && !memberIds.has(expense.payerId))
        fail('지출 결제자를 확인하세요.')
      if (expense.splits) {
        if (!expense.payerId) fail('공동 경비의 결제자를 지정하세요.')
        if (
          new Set(expense.splits.map((split) => split.memberId)).size !==
            expense.splits.length ||
          expense.splits.some(
            (split) =>
              !memberIds.has(split.memberId) ||
              !validCurrencyAmount(split.amount, expense.currency),
          )
        )
          fail('동행인별 부담 금액을 확인하세요.')
        const unit = currencyStep(expense.currency)
        if (
          expense.splits.reduce(
            (sum, split) => sum + Math.round(split.amount / unit),
            0,
          ) !== Math.round(expense.amount / unit)
        )
          fail('부담 금액 합계가 지출 금액과 달라요.')
      }
    }
    if (
      trip.totalBudget !== undefined &&
      !validCurrencyAmount(trip.totalBudget, trip.baseCurrency || 'KRW')
    )
      fail('통화에 맞는 전체 예산을 입력하세요.')
    const allStops = trip.days.flat()
    if (new Set(allStops.map((stop) => stop.id)).size !== allStops.length)
      fail('일정 ID가 중복되었어요.')
    for (const stop of allStops) {
      if (
        stop.custom
          ? !ids.has(stop.custom.destinationId)
          : !getPlace(stop.placeId)
      )
        fail('일정의 장소를 찾을 수 없어요.')
    }
    for (const collection of [
      trip.checklist,
      trip.expenses,
      trip.reservations,
      trip.attachments,
    ]) {
      if (
        collection &&
        new Set(collection.map((item) => item.id)).size !== collection.length
      )
        fail('항목 ID가 중복되었어요.')
    }
  })
export type Destination = z.infer<typeof destinationSchema>
export type CustomPlace = z.infer<typeof customPlaceSchema>
export type Stop = z.infer<typeof stopSchema>
export type Trip = z.infer<typeof tripSchema>
export type Expense = z.infer<typeof expenseSchema>
export type Reservation = z.infer<typeof reservationSchema>
export type Currency = (typeof currencies)[number]
export function tripDestinations(trip: {
  cityId: string
  destinations?: Destination[]
}): Destination[] {
  const city = getCity(trip.cityId)
  return (
    trip.destinations || [
      {
        id: trip.cityId,
        name: city?.name || '여행지',
        country: city?.country || '국가 미지정',
        guideCityId: city?.id,
      },
    ]
  )
}
export function destinationForDay(trip: Trip, day: number) {
  const destinations = tripDestinations(trip)
  return (
    destinations.find((item) => item.id === trip.dayDestinationIds?.[day]) ||
    destinations[0]
  )
}
export function tripCity(trip: Trip): City {
  return (
    getCity(trip.cityId) || {
      id: trip.cityId,
      name: tripDestinations(trip)[0].name,
      country: tripDestinations(trip)[0].country,
      english: 'MY JOURNEY',
      image: '/images/guide-placeholder.svg',
      region: '기타',
      tagline: '직접 만드는 여행',
      description: '',
      tags: [],
      flight: '',
      currency: '',
      timeDifference: '',
      season: '',
      accent: '#087b70',
    }
  )
}
export function stopDetails(stop: Stop) {
  const place = getPlace(stop.placeId)
  if (!stop.custom && place) return place
  return {
    id: stop.placeId,
    name: stop.custom?.name || '장소',
    category: stop.custom?.kind || '기타',
    address: stop.custom?.address || '주소를 추가해 보세요',
    image: '/images/guide-placeholder.svg',
    duration: '직접 추가한 일정',
    lat: undefined,
    lng: undefined,
  }
}
export function mapQuery(stop: Stop, trip: Trip) {
  if (!stop.custom) {
    const place = getPlace(stop.placeId)
    return place ? `${place.lat},${place.lng}` : ''
  }
  if (stop.custom.coordinates)
    return `${stop.custom.coordinates.lat},${stop.custom.coordinates.lng}`
  const destination = tripDestinations(trip).find(
    (item) => item.id === stop.custom!.destinationId,
  )
  return [
    stop.custom.name,
    stop.custom.address,
    destination?.name,
    destination?.country,
  ]
    .filter(Boolean)
    .join(' ')
}
export function money(value: number, currency: Currency) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    maximumFractionDigits:
      currency === 'KRW' ||
      currency === 'JPY' ||
      currency === 'VND' ||
      currency === 'IDR'
        ? 0
        : 2,
  }).format(value)
}
