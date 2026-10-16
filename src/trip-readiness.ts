import { dateAt, today } from './store'
import { stopDetails, type Trip } from './travel-model'
import { routePoints } from './route-map-model'
import { cancelledReservation, timeConflicts } from './journey-progress'
import { dayTransferLegs } from './transfer-planning'
import { reservationConflicts } from './reservation-conflicts'

export type JourneyTarget = {
  workspace: string
  day?: number
  stopId?: string
  reservationId?: string
  checklistId?: string
  attachmentId?: string
  expenseId?: string
}
export type ReadinessIssue = {
  id: string
  category: '일정' | '예약' | '준비물'
  text: string
  urgent: boolean
  target: JourneyTarget
}
export function tripReadiness(trip: Trip, date = today()): ReadinessIssue[] {
  const issues: ReadinessIssue[] = []
  for (const conflict of reservationConflicts(trip)) {
    const reservation = trip.reservations?.find(
      (item) => item.id === conflict.reservationId,
    )
    if (reservation && (reservation.endDate || reservation.date) < date)
      continue
    if (conflict.day !== undefined) {
      const stop = trip.days[conflict.day]?.find(
        (item) => item.id === conflict.stopId,
      )
      if (
        !stop ||
        stop.status === 'done' ||
        stop.status === 'skipped' ||
        dateAt(trip.startDate, conflict.day) < date
      )
        continue
    }
    issues.push({
      id: conflict.id,
      category: '예약',
      text: conflict.text,
      urgent: true,
      target: {
        workspace: 'reservations',
        reservationId: conflict.reservationId,
      },
    })
  }
  for (const reservation of trip.reservations || []) {
    if (
      reservation.status === 'cancelled' ||
      reservation.status === 'confirmed' ||
      (reservation.endDate || reservation.date) < date
    )
      continue
    issues.push({
      id: `pending-${reservation.id}`,
      category: '예약',
      text: `${reservation.title} · 예약 확정 확인`,
      urgent: true,
      target: { workspace: 'reservations', reservationId: reservation.id },
    })
  }
  trip.days.forEach((stops, day) => {
    if (dateAt(trip.startDate, day) < date) return
    const pending = stops.filter(
      (stop) =>
        stop.status !== 'done' &&
        stop.status !== 'skipped' &&
        !cancelledReservation(trip, stop),
    )
    for (const stop of pending) {
      if (!routePoints([stop]).length)
        issues.push({
          id: `location-${stop.id}`,
          category: '일정',
          text: `DAY ${day + 1} · ${stopDetails(stop).name} · 지도 위치 미지정`,
          urgent: false,
          target: { workspace: 'schedule', day, stopId: stop.id },
        })
      if (
        stop.reservationId &&
        !trip.reservations?.some((item) => item.id === stop.reservationId)
      )
        issues.push({
          id: `missing-booking-${stop.id}`,
          category: '예약',
          text: `${stopDetails(stop).name} · 연결한 예약이 없음`,
          urgent: true,
          target: { workspace: 'schedule', day, stopId: stop.id },
        })
    }
    const conflicts = timeConflicts(trip, day)
    if (conflicts.length)
      issues.push({
        id: `overlap-${day}`,
        category: '일정',
        text: `DAY ${day + 1} · 체류시간 겹침 ${conflicts.length}건`,
        urgent: true,
        target: { workspace: 'schedule', day },
      })
    for (const leg of dayTransferLegs(trip, day)) {
      if (!pending.some((stop) => stop.id === leg.stop.id) || !leg.lateMinutes)
        continue
      issues.push({
        id: `late-${leg.stop.id}`,
        category: '일정',
        text: `DAY ${day + 1} · ${stopDetails(leg.stop).name} 도착 ${leg.lateMinutes}분 부족`,
        urgent: true,
        target: { workspace: 'transfers', day, stopId: leg.stop.id },
      })
    }
  })
  const remaining = (trip.checklist || []).filter((item) => !item.done)
  const overdue = remaining.filter(
    (item) => item.dueDate && item.dueDate < date,
  )
  for (const item of overdue)
    issues.push({
      id: `checklist-${item.id}`,
      category: '준비물',
      text: `${item.title} · 기한 지남`,
      urgent: true,
      target: { workspace: 'checklist', checklistId: item.id },
    })
  if (remaining.length > overdue.length)
    issues.push({
      id: 'checklist',
      category: '준비물',
      text: `기타 준비물·할 일 ${remaining.length - overdue.length}개 남음`,
      urgent: false,
      target: { workspace: 'checklist' },
    })
  return issues.sort((a, b) => Number(b.urgent) - Number(a.urgent))
}
