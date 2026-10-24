import { destinationForDay, type Trip, type Stop } from './travel-model'
import type { Place } from './data'
import { courseDays, type CourseSelection } from './practical-guides'

type PlaceLookup = (id: string) => Place | undefined
export function eligibleCourseDays(trip: Trip, course: CourseSelection) {
  const length = courseDays(course).length
  return trip.days
    .map((_, index) => index)
    .filter(
      (index) =>
        index + length <= trip.days.length &&
        Array.from(
          { length },
          (_, offset) =>
            destinationForDay(trip, index + offset).guideCityId ===
            course.cityId,
        ).every(Boolean),
    )
}
export function appendGuideSelection(
  trip: Trip,
  course: CourseSelection,
  startDay: number,
  startTime: string,
  lookup: PlaceLookup,
): { trip: Trip; added: number } {
  const days = courseDays(course)
  if (!days.length || !eligibleCourseDays(trip, course).includes(startDay))
    throw new Error(
      days.length > 1
        ? `${days.length}일 연속으로 이 도시에 머무는 시작 날짜를 선택해 주세요.`
        : '이 도시로 지정한 여행 날짜를 선택해 주세요.',
    )
  let next = trip
  let added = 0
  for (const [offset, day] of days.entries()) {
    try {
      const result = appendGuideCourse(
        next,
        course.cityId,
        day.placeIds,
        startDay + offset,
        startTime,
        lookup,
      )
      next = result.trip
      added += result.added
    } catch (error) {
      throw new Error(
        days.length > 1
          ? `DAY ${offset + 1}: ${(error as Error).message}`
          : (error as Error).message,
      )
    }
  }
  return { trip: next, added }
}
export function newCoursePlaceIds(stops: Stop[], ids: string[]) {
  const existing = new Set(
    stops.map((stop) => stop.custom?.catalogPlaceId || stop.placeId),
  )
  return [...new Set(ids)].filter((id) => !existing.has(id))
}
export function courseStartTime(stops: Stop[], ids: string[]) {
  const count = newCoursePlaceIds(stops, ids).length
  const latest = Math.max(
    7 * 60,
    ...stops.map(
      (stop) => Number(stop.time.slice(0, 2)) * 60 + Number(stop.time.slice(3)),
    ),
  )
  const next = latest + 120
  return next + Math.max(0, count - 1) * 120 < 1440
    ? `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}`
    : '09:00'
}
export function appendGuideCourse(
  trip: Trip,
  cityId: string,
  placeIds: string[],
  day: number,
  startTime: string,
  lookup: PlaceLookup,
): { trip: Trip; added: number } {
  if (
    !Number.isInteger(day) ||
    !trip.days[day] ||
    destinationForDay(trip, day).guideCityId !== cityId
  )
    throw new Error('이 도시로 지정한 여행 날짜를 선택해 주세요.')
  if (!placeIds.length || placeIds.some((id) => lookup(id)?.cityId !== cityId))
    throw new Error('이 도시에서 확인할 수 있는 코스 장소가 아닙니다.')
  const ids = newCoursePlaceIds(trip.days[day], placeIds)
  if (!ids.length) return { trip, added: 0 }
  if (trip.days[day].length + ids.length > 200)
    throw new Error('하루 일정은 최대 200곳까지 담을 수 있어요.')
  if (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
    throw new Error('첫 방문 시간을 확인해 주세요.')
  const first = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3))
  if (startTime && first + (ids.length - 1) * 120 >= 1440)
    throw new Error('코스가 다음 날로 넘어가요. 첫 방문 시간을 앞당겨 주세요.')
  const times = ids.map((_, index) => {
    if (!startTime) return ''
    const minutes = first + index * 120
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  })
  if (
    startTime &&
    times.some((time) => trip.days[day].some((stop) => stop.time === time))
  )
    throw new Error(
      '기존 일정과 시작 시간이 겹쳐요. 첫 방문 시간을 바꿔 주세요.',
    )
  const stops = ids.map((id, index): Stop => ({
    id: crypto.randomUUID(),
    placeId: id,
    time: times[index],
    note: '',
  }))
  return {
    trip: {
      ...trip,
      days: trip.days.map((items, index) =>
        index === day ? [...items, ...stops] : items,
      ),
    },
    added: stops.length,
  }
}
