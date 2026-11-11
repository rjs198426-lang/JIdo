import { companionBackup } from '../src/journey-personal'
import { test, expect } from '@playwright/test'
import { tripSchema } from '../src/travel-model'
import { planTravelReminders, reminderDefaults } from '../src/travel-reminders'
const flight = () =>
  tripSchema.parse({
    id: 'f',
    title: '괌',
    cityId: 'guam',
    startDate: '2026-12-22',
    endDate: '2026-12-23',
    travelers: 1,
    days: [[], []],
    reservations: [
      {
        id: 'booking',
        title: '나의 비행',
        kind: '항공',
        date: '2026-12-22',
        time: '20:00',
        reference: 'PRIVATE-SYNTHETIC',
        address: '',
        link: '',
        note: 'PRIVATE-NOTE',
        flight: {
          departureTimeZone: 'Asia/Seoul',
          arrivalTimeZone: 'Pacific/Guam',
          arrivalDate: '2026-12-23',
          arrivalTime: '02:00',
        },
      },
    ],
  })
test('explicit airport time zones drive departure reminders without exposing booking identifiers', () => {
  const plan = planTravelReminders(
    [flight()],
    { ...reminderDefaults, enabled: true, reservations: true },
    new Date('2026-12-22T09:30:00Z'),
  )
  const item = plan.find((p) => p.key === 'f:reservation:booking')
  expect(item?.at.toISOString()).toBe('2026-12-22T10:00:00.000Z')
  expect(JSON.stringify(plan)).not.toContain('PRIVATE-SYNTHETIC')
  expect(JSON.stringify(plan)).not.toContain('PRIVATE-NOTE')
})
test('unknown departure time or airport time zone never creates a guessed midnight reminder', () => {
  const trip = flight()
  trip.reservations![0].time = ''
  expect(
    planTravelReminders(
      [trip],
      { ...reminderDefaults, enabled: true, reservations: true },
      new Date('2026-12-22T09:30:00Z'),
    ).some((p) => p.key === 'f:reservation:booking'),
  ).toBe(false)
  trip.reservations![0].time = '20:00'
  trip.reservations![0].flight = undefined
  expect(
    planTravelReminders(
      [trip],
      { ...reminderDefaults, enabled: true, reservations: true },
      new Date('2026-12-22T09:30:00Z'),
    ).some((p) => p.key === 'f:reservation:booking'),
  ).toBe(false)
})

test('companion export excludes flight seats, hotel contacts and booking secrets while protecting blank-time compatibility', () => {
  const trip = flight()
  trip.reservations![0].flight!.seat = 'PRIVATE-SEAT'
  trip.reservations!.push({
    id: 'hotel',
    title: '함께 갈 호텔',
    kind: '숙소',
    date: '2026-12-22',
    endDate: '2026-12-23',
    time: '',
    reference: 'PRIVATE-REF',
    address: '호텔 주소',
    link: '',
    note: 'PRIVATE-NOTE',
    stay: { contact: 'PRIVATE-CONTACT', guestName: 'PRIVATE-GUEST' },
  })
  const text = companionBackup(trip)
  expect(text).not.toContain('PRIVATE-')
  const result = JSON.parse(text)
  expect(result.version).toBe(2)
  expect(result.minBuild).toBe(84)
  expect(
    result.trips[0].reservations.every(
      (r: any) => !r.flight && !r.stay && !r.reference,
    ),
  ).toBe(true)
  expect(tripSchema.safeParse(result.trips[0]).success).toBe(true)
})
