import { useMemo, useState } from 'react'
import { CalendarDays, Search, ChevronRight, ChevronDown } from 'lucide-react'
import { destinationForDay, stopDetails, type Trip } from './travel-model'
import { reservationsForDay } from './field-reservations'
import { cancelledReservation } from './journey-progress'
import { dateAt, formatDate } from './store'
export default function TripOverview({
  trip,
  onDay,
}: {
  trip: Trip
  onDay: (day: number) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <details
      className="trip-overview"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <CalendarDays size={17} />
        전체 일정{' '}
        <span>
          {trip.days.length}일 ·{' '}
          {trip.days.reduce((total, day) => total + day.length, 0)}곳
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      {open && <OverviewDays trip={trip} onDay={onDay} />}
    </details>
  )
}
function OverviewDays({
  trip,
  onDay,
}: {
  trip: Trip
  onDay: (day: number) => void
}) {
  const [query, setQuery] = useState('')
  const days = useMemo(
    () =>
      trip.days.map((stops, index) => {
        const reservations = reservationsForDay(trip, index)
        return {
          stops,
          index,
          reservations,
          city: destinationForDay(trip, index).name,
          untimed: stops.filter(
            (stop) =>
              !stop.time &&
              stop.status !== 'skipped' &&
              stop.status !== 'done' &&
              !cancelledReservation(trip, stop),
          ).length,
          search: [
            dateAt(trip.startDate, index),
            `DAY ${index + 1}`,
            destinationForDay(trip, index).name,
            ...stops.flatMap((stop) => [
              stopDetails(stop).name,
              stop.note,
              stopDetails(stop).address,
            ]),
            ...reservations.map((item) => item.title),
          ]
            .join(' ')
            .toLocaleLowerCase(),
        }
      }),
    [trip],
  )
  const needle = query.trim().toLocaleLowerCase()
  const filtered = days.filter((day) => !needle || day.search.includes(needle))
  return (
    <>
      <label className="input-search">
        <Search size={16} />
        <input
          aria-label="여행 전체 일정 검색"
          placeholder="날짜·장소·예약·메모 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="trip-overview-days">
        {filtered.map(({ stops, index, city, reservations, untimed }) => (
          <button
            key={index}
            type="button"
            aria-label={`DAY ${index + 1} ${city} 일정 열기`}
            onClick={() => onDay(index)}
          >
            <span>
              <strong>
                DAY {index + 1} · {city}
              </strong>
              <small>
                {formatDate(dateAt(trip.startDate, index), true)} ·{' '}
                {stops.length}곳{untimed > 0 && ` · 시간 미정 ${untimed}곳`}
              </small>
              <span>
                {stops.length
                  ? stops
                      .slice(0, 3)
                      .map((stop) => stopDetails(stop).name)
                      .join(' · ')
                  : '아직 정한 일정 없음 · 장소 추가하기'}
              </span>
              {reservations.length > 0 && (
                <small className="overview-bookings">
                  예약 {reservations.length}건 ·{' '}
                  {reservations
                    .slice(0, 2)
                    .map((item) => item.title)
                    .join(' · ')}
                </small>
              )}
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      {!filtered.length && <p role="status">일치하는 일정이 없어요.</p>}
    </>
  )
}
