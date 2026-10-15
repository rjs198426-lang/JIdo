import { useState } from 'react'
import { getCity, getPlace } from './catalog'
import { tripDestinations, destinationForDay, type Trip } from './travel-model'
import { dateAt, formatDate } from './store'
import {
  courseStartTime,
  newCoursePlaceIds,
  appendGuideCourse,
} from './guide-course'
import type { CourseSelection } from './practical-guides'

export default function GuideCourseForm({
  course,
  trips,
  activeTripId,
  activeDay,
  onApply,
  onCreate,
  onOpenTrip,
}: {
  course: CourseSelection
  trips: Trip[]
  activeTripId: string
  activeDay: number
  onApply: (tripId: string, day: number, time: string) => void
  onCreate: () => void
  onOpenTrip: (tripId: string) => void
}) {
  const matching = trips.filter((trip) =>
    tripDestinations(trip).some(
      (destination) => destination.guideCityId === course.cityId,
    ),
  )
  const [selected, setSelected] = useState(
    matching.find((trip) => trip.id === activeTripId)?.id ||
      matching[0]?.id ||
      '',
  )
  const trip = matching.find((trip) => trip.id === selected) || matching[0]
  const eligible =
    trip?.days
      .map((_, index) => index)
      .filter(
        (index) => destinationForDay(trip, index).guideCityId === course.cityId,
      ) || []
  const [day, setDay] = useState(
    eligible.includes(activeDay) ? activeDay : (eligible[0] ?? 0),
  )
  const effectiveDay = eligible.includes(day) ? day : eligible[0]
  const [time, setTime] = useState(
    trip && effectiveDay !== undefined
      ? courseStartTime(trip.days[effectiveDay], course.placeIds)
      : '09:00',
  )
  const [error, setError] = useState('')
  const ids =
    trip && effectiveDay !== undefined
      ? newCoursePlaceIds(trip.days[effectiveDay], course.placeIds)
      : []
  return (
    <form
      className="modal-body course-add-form"
      onSubmit={(event) => {
        event.preventDefault()
        setError('')
        if (!trip || effectiveDay === undefined) return
        try {
          appendGuideCourse(
            trip,
            course.cityId,
            course.placeIds,
            effectiveDay,
            time,
            getPlace,
          )
          onApply(trip.id, effectiveDay, time)
        } catch (error) {
          setError((error as Error).message)
        }
      }}
    >
      <small>
        {getCity(course.cityId)?.name} · {course.pace}
      </small>
      <h3>{course.title}</h3>
      <ol>
        {course.placeIds.map((id) => (
          <li key={id}>
            {getPlace(id)?.name}
            {trip && effectiveDay !== undefined && !ids.includes(id) && (
              <small> · 이날 이미 포함</small>
            )}
          </li>
        ))}
      </ol>
      {trip ? (
        <>
          <label className="field">
            코스를 담을 여행
            <select
              value={trip.id}
              onChange={(event) => {
                const next = matching.find(
                  (item) => item.id === event.target.value,
                )!
                const nextDay = next.days.findIndex(
                  (_, index) =>
                    destinationForDay(next, index).guideCityId ===
                    course.cityId,
                )
                setSelected(next.id)
                setDay(Math.max(0, nextDay))
                setTime(
                  nextDay >= 0
                    ? courseStartTime(next.days[nextDay], course.placeIds)
                    : '09:00',
                )
                setError('')
              }}
            >
              {matching.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          {eligible.length ? (
            <>
              <label className="field">
                코스를 담을 날짜
                <select
                  value={effectiveDay}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setDay(next)
                    setTime(courseStartTime(trip.days[next], course.placeIds))
                    setError('')
                  }}
                >
                  {eligible.map((index) => (
                    <option key={index} value={index}>
                      DAY {index + 1} ·{' '}
                      {formatDate(dateAt(trip.startDate, index))}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                첫 방문 시간
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(event) => {
                    setTime(event.target.value)
                    setError('')
                  }}
                />
              </label>
              <p className="detail-footnote">
                기존 일정 뒤에 중복 없이 추가합니다. 방문 시간은 2시간 간격의
                편집 가능한 계획값이며 이동·대기시간을 계산한 값은 아닙니다.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button primary full"
                type="submit"
                disabled={!ids.length}
              >
                {ids.length
                  ? `${ids.length}곳 일정에 추가`
                  : '이날 이미 모두 담았어요'}
              </button>
            </>
          ) : (
            <>
              <p>
                이 도시로 지정한 여행 날짜가 없습니다. 내 여행에서 날짜별 체류
                도시를 먼저 정해 주세요.
              </p>
              <button
                type="button"
                className="button outline full"
                onClick={() => onOpenTrip(trip.id)}
              >
                내 여행에서 날짜 지정
              </button>
            </>
          )}
        </>
      ) : (
        <p>이 도시가 포함된 여행을 만들면 첫날에 선택한 코스를 담습니다.</p>
      )}
      <button
        type="button"
        className={trip ? 'text-button' : 'button primary full'}
        onClick={onCreate}
      >
        이 코스로 새 여행 만들기
      </button>
    </form>
  )
}
