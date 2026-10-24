import { useState } from 'react'
import { getCity, getPlace } from './catalog'
import { tripDestinations, type Trip } from './travel-model'
import { dateAt, formatDate } from './store'
import {
  newCoursePlaceIds,
  appendGuideSelection,
  eligibleCourseDays,
} from './guide-course'
import { courseDays, type CourseSelection } from './practical-guides'
import CoursePreview from './CoursePreview'

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
  const days = courseDays(course)
  const multiDay = days.length > 1
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
  const eligible = trip ? eligibleCourseDays(trip, course) : []
  const [day, setDay] = useState(
    eligible.includes(activeDay) ? activeDay : (eligible[0] ?? 0),
  )
  const effectiveDay = eligible.includes(day) ? day : eligible[0]
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const added =
    trip && effectiveDay !== undefined
      ? days.reduce(
          (total, item, offset) =>
            total +
            newCoursePlaceIds(trip.days[effectiveDay + offset], item.placeIds)
              .length,
          0,
        )
      : 0
  return (
    <form
      className="modal-body course-add-form"
      onSubmit={(event) => {
        event.preventDefault()
        setError('')
        if (!trip || effectiveDay === undefined) return
        try {
          appendGuideSelection(trip, course, effectiveDay, time, getPlace)
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
      <CoursePreview
        course={course}
        existingDays={
          trip && effectiveDay !== undefined
            ? trip.days.slice(effectiveDay, effectiveDay + days.length)
            : undefined
        }
      />
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
                const nextDay = eligibleCourseDays(next, course)[0]
                setSelected(next.id)
                setDay(nextDay ?? 0)
                setTime('')
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
                {multiDay ? '코스를 시작할 날짜' : '코스를 담을 날짜'}
                <select
                  value={effectiveDay}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setDay(next)
                    setTime('')
                    setError('')
                  }}
                >
                  {eligible.map((index) => (
                    <option key={index} value={index}>
                      DAY {index + 1} ·{' '}
                      {formatDate(dateAt(trip.startDate, index))}
                      {multiDay
                        ? ` ~ ${formatDate(dateAt(trip.startDate, index + days.length - 1))}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {multiDay ? '매일 첫 방문 시간' : '첫 방문 시간'}
                <input
                  type="time"
                  value={time}
                  onChange={(event) => {
                    setTime(event.target.value)
                    setError('')
                  }}
                />
              </label>
              <p className="detail-footnote">
                {multiDay
                  ? `${days.length}일에 나누어 기존 장소를 보존하며 추가합니다. `
                  : '기존 일정 뒤에 중복 없이 추가합니다. '}
                시간 없이 담고 나중에 일정 편집에서 정할 수 있어요.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button primary full"
                type="submit"
                disabled={!added}
              >
                {added
                  ? `${added}곳 일정에 추가`
                  : multiDay
                    ? '모든 날짜에 이미 담았어요'
                    : '이날 이미 모두 담았어요'}
              </button>
            </>
          ) : (
            <>
              <p>
                {multiDay
                  ? `${days.length}일 연속으로 이 도시에 머무는 날짜가 없습니다. 여행 기간과 날짜별 도시를 확인해 주세요.`
                  : '이 도시로 지정한 여행 날짜가 없습니다. 내 여행에서 날짜별 체류 도시를 먼저 정해 주세요.'}
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
        <p>
          {multiDay
            ? `선택한 ${days.length}일 코스로 새 여행을 만듭니다.`
            : '이 도시가 포함된 여행을 만들면 첫날에 선택한 코스를 담습니다.'}
        </p>
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
