import { test, expect } from '@playwright/test'
import { tripSchema } from '../src/travel-model'
import {
  planTravelReminders,
  reminderDefaults,
  reminderInstant,
  reminderLimit,
} from '../src/travel-reminders'
import { reconcileReminders, alarmIdStart } from '../src/reminder-service'
const now = new Date('2026-10-25T00:00:00Z')
const fixture = () =>
  tripSchema.parse({
    id: 'reminder-trip',
    title: '교토 여행',
    cityId: 'kyoto',
    startDate: '2026-11-10',
    endDate: '2026-11-11',
    travelers: 1,
    days: [
      [
        {
          id: 'temple',
          placeId: 'kiyomizu',
          time: '10:00',
          note: 'SECRET-STOP-NOTE',
        },
        { id: 'untimed', placeId: 'fushimi', time: '', note: '' },
      ],
      [],
    ],
    checklist: [{ id: 'passport', title: '여권', done: false }],
    reservations: [
      {
        id: 'flight',
        title: '출발 항공',
        kind: '항공',
        date: '2026-11-10',
        time: '10:00',
        address: 'SECRET-ADDRESS',
        reference: 'SECRET-REFERENCE',
        note: 'SECRET-RESERVATION-NOTE',
        link: '',
        status: 'confirmed',
      },
      {
        id: 'stay',
        title: '숙소 체크인',
        kind: '숙소',
        date: '2026-11-10',
        endDate: '2026-11-11',
        time: '15:00',
        address: '',
        reference: '',
        note: '',
        link: '',
        status: 'pending',
      },
    ],
  })
const enabled = () => ({ ...reminderDefaults, enabled: true, flightZones: {} })
test('D-7부터 D-day까지 8회, 오전 9시·미래만 예약하고 사용 전에는 예약하지 않음', () => {
  const trip = fixture(),
    plan = planTravelReminders([trip], enabled(), now)
  expect(plan).toHaveLength(8)
  expect(plan.map((i) => i.title)).toEqual([
    '여행 출발 D-7',
    '여행 출발 D-6',
    '여행 출발 D-5',
    '여행 출발 D-4',
    '여행 출발 D-3',
    '여행 출발 D-2',
    '여행 출발 D-1',
    '오늘 여행을 떠나요',
  ])
  expect(plan.every((i) => i.at.getHours() === 9 && +i.at > +now)).toBe(true)
  expect(planTravelReminders([trip], reminderDefaults, now)).toEqual([])
  expect(
    planTravelReminders([trip], enabled(), new Date('2026-11-12T00:00Z')),
  ).toEqual([])
})
test('준비물은 미완료가 있을 때 전날 18시에만 알리고 기록을 바꾸지 않음', () => {
  const trip = fixture(),
    before = structuredClone(trip),
    prefs = { ...enabled(), countdown: false, preparation: true }
  const plan = planTravelReminders([trip], prefs, now)
  expect(plan).toHaveLength(1)
  expect(plan[0].at.getHours()).toBe(18)
  expect(plan[0].at.getDate()).toBe(9)
  expect(trip).toEqual(before)
  trip.checklist![0].done = true
  expect(planTravelReminders([trip], prefs, now)).toEqual([])
})
test('빈 시간·완료·건너뜀·취소를 제외하고 여행지 현지 시각 30분 전에 방문 알림', () => {
  const trip = fixture(),
    prefs = { ...enabled(), countdown: false, visits: true }
  const plan = planTravelReminders([trip], prefs, now)
  expect(plan).toHaveLength(1)
  expect(plan[0].at.toISOString()).toBe('2026-11-10T00:30:00.000Z')
  for (const status of ['done', 'skipped'] as const) {
    trip.days[0][0].status = status
    expect(planTravelReminders([trip], prefs, now)).toEqual([])
  }
  trip.days[0][0].status = 'planned'
  trip.days[0][0].reservationId = 'stay'
  trip.reservations![1].status = 'cancelled'
  expect(planTravelReminders([trip], prefs, now)).toEqual([])
})
test('항공 시간대를 추측하지 않고 출발지 선택 후 예약을 알리며 연결 일정은 중복 알림하지 않음', () => {
  const trip = fixture(),
    prefs = {
      ...enabled(),
      countdown: false,
      reservations: true,
      visits: true,
      flightZones: {} as Record<string, string>,
    }
  trip.days[0][0].reservationId = 'stay'
  let plan = planTravelReminders([trip], prefs, now)
  expect(plan).toHaveLength(1)
  expect(plan[0].at.toISOString()).toBe('2026-11-10T05:00:00.000Z')
  prefs.flightZones['reminder-trip:flight'] = 'Asia/Seoul'
  plan = planTravelReminders([trip], prefs, now)
  expect(plan).toHaveLength(2)
  expect(plan.find((i) => i.key.endsWith('flight'))!.at.toISOString()).toBe(
    '2026-11-10T00:00:00.000Z',
  )
  const text = JSON.stringify(plan)
  for (const secret of [
    'SECRET-ADDRESS',
    'SECRET-REFERENCE',
    'SECRET-RESERVATION-NOTE',
    'SECRET-STOP-NOTE',
  ])
    expect(text).not.toContain(secret)
  trip.reservations![0].status = 'cancelled'
  expect(planTravelReminders([trip], prefs, now)).toHaveLength(1)
})
test('DST·잘못된 시각과 시간대를 검증하고 존재하지 않는 현지 시각은 예약하지 않음', () => {
  expect(
    reminderInstant('2027-03-14', '02:30', 'America/New_York'),
  ).toBeUndefined()
  expect(
    reminderInstant('2026-11-01', '01:30', 'America/New_York'),
  ).toBeInstanceOf(Date)
  expect(
    reminderInstant('2026-11-10', '09:00', 'Asia/Tokyo')!.toISOString(),
  ).toBe('2026-11-10T00:00:00.000Z')
  expect(reminderInstant('2026-99-99', '09:00', 'Asia/Tokyo')).toBeUndefined()
  expect(reminderInstant('2026-11-10', '', 'Asia/Tokyo')).toBeUndefined()
  expect(reminderInstant('2026-11-10', '25:30', 'Asia/Tokyo')).toBeUndefined()
  expect(reminderInstant('2026-11-10', '09:00', 'Bad/Zone')).toBeUndefined()
})
test('원래 여행 알림만 취소·갱신하고 정확한 알람 특수 권한을 요청하지 않으며 120개로 제한', async () => {
  const cancelled: any[] = [],
    scheduled: any[] = [],
    channels: any[] = []
  const api = {
    checkPermissions: async () => ({ display: 'granted' }),
    getPending: async () => ({
      notifications: [
        { id: alarmIdStart },
        { id: alarmIdStart + 3 },
        { id: 77 },
      ],
    }),
    cancel: async (o: any) => {
      cancelled.push(o)
    },
    createChannel: async (o: any) => {
      channels.push(o)
    },
    schedule: async (o: any) => {
      scheduled.push(o)
      return { notifications: [] }
    },
  } as unknown as Parameters<typeof reconcileReminders>[0]
  const base = planTravelReminders([fixture()], enabled(), now)[0],
    plan = Array.from({ length: 150 }, (_, i) => ({
      ...base,
      key: `entry-${i}`,
    }))
  const status = await reconcileReminders(api, plan, true)
  expect(status.count).toBe(reminderLimit)
  expect(cancelled[0].notifications).toEqual([
    { id: alarmIdStart },
    { id: alarmIdStart + 3 },
  ])
  expect(channels[0].visibility).toBe(0)
  expect(
    scheduled[0].notifications.every(
      (n: any) =>
        n.isExactNotification === false &&
        n.channelId === 'jido-travel-reminders-v1' &&
        n.extra.tripId === 'reminder-trip',
    ),
  ).toBe(true)
  expect(new Set(scheduled[0].notifications.map((n: any) => n.id)).size).toBe(
    reminderLimit,
  )
  await reconcileReminders(api, plan, false)
  expect(scheduled).toHaveLength(1)
  const denied = {
    ...api,
    checkPermissions: async () => ({ display: 'denied' }),
  } as Parameters<typeof reconcileReminders>[0]
  expect((await reconcileReminders(denied, plan, true)).count).toBe(0)
  expect(scheduled).toHaveLength(1)
})
