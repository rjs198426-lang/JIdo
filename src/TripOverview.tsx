import { useState } from 'react'
import { CalendarDays, Search, ChevronRight, ChevronDown } from 'lucide-react'
import { destinationForDay, stopDetails, type Trip } from './travel-model'
import { dateAt, formatDate } from './store'
export default function TripOverview({
  trip,
  onDay,
}: {
  trip: Trip
  onDay: (day: number) => void
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase()
  const days = trip.days
    .map((stops, index) => ({
      stops,
      index,
      city: destinationForDay(trip, index).name,
    }))
    .filter(
      ({ stops, city, index }) =>
        !needle ||
        `${city} DAY ${index + 1} ${dateAt(trip.startDate, index)}`
          .toLocaleLowerCase()
          .includes(needle) ||
        stops.some((stop) =>
          `${stopDetails(stop).name} ${stop.note} ${stopDetails(stop).address}`
            .toLocaleLowerCase()
            .includes(needle),
        ),
    )
  return (
    <details className="trip-overview">
      <summary>
        <CalendarDays size={17} />
        전체 일정{' '}
        <span>
          {trip.days.length}일 · {trip.days.flat().length}곳
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <label className="input-search">
        <Search size={16} />
        <input
          aria-label="여행 전체 일정 검색"
          placeholder="장소·도시·메모 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="trip-overview-days">
        {days.map(({ stops, index, city }) => (
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
                {formatDate(dateAt(trip.startDate, index))} · {stops.length}곳 ·{' '}
                {stops.filter((stop) => stop.status === 'done').length}곳 완료
              </small>
              <span>
                {stops.length
                  ? stops
                      .filter(
                        (stop) =>
                          !needle ||
                          `${stopDetails(stop).name} ${stop.note}`
                            .toLocaleLowerCase()
                            .includes(needle),
                      )
                      .slice(0, 3)
                      .map((stop) => stopDetails(stop).name)
                      .join(' · ') ||
                    stops
                      .slice(0, 3)
                      .map((stop) => stopDetails(stop).name)
                      .join(' · ')
                  : '장소 추가하기'}
              </span>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
      {!days.length && <p role="status">일치하는 일정이 없어요.</p>}
    </details>
  )
}
