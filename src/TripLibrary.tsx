import { useEffect, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import CityPhoto from './CityPhoto'
import { journeyPhase } from './home-journey'
import { tripCity, tripDestinations, type Trip } from './travel-model'
import { formatDate } from './store'
export default function TripLibrary({
  trips,
  onOpen,
}: {
  trips: Trip[]
  onOpen: (trip: Trip) => void
}) {
  const [query, setQuery] = useState(''),
    [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])
  const selected = trips.filter((trip) =>
    [trip.title, ...tripDestinations(trip).flatMap((d) => [d.name, d.country])]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  )
  const states = selected.map((trip) => ({ trip, ...journeyPhase(trip, now) }))
  return (
    <div className="trip-library" aria-label="전체 여행">
      <label className="input-search">
        <Search size={18} />
        <input
          aria-label="내 여행 검색"
          placeholder="여행 이름·도시로 찾기"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {(['ongoing', 'upcoming', 'past'] as const).map((phase) => {
        const items = states
          .filter((s) => s.phase === phase)
          .sort((a, b) =>
            phase === 'past'
              ? b.trip.endDate.localeCompare(a.trip.endDate)
              : a.trip.startDate.localeCompare(b.trip.startDate),
          )
        if (!items.length) return null
        const title =
          phase === 'ongoing'
            ? '여행 중'
            : phase === 'upcoming'
              ? '다가오는 여행'
              : '지난 여행'
        const cards = (
          <div className="trip-library-cards">
            {items.map(({ trip, until }) => (
              <button
                className="trip-library-card"
                key={trip.id}
                data-trip-id={trip.id}
                onClick={() => onOpen(trip)}
                aria-label={`${trip.title} 열기`}
              >
                <CityPhoto city={tripCity(trip)} alt="" />
                <span className="trip-library-copy">
                  <small>
                    {tripDestinations(trip)
                      .map((d) => d.name)
                      .join(' · ')}
                    {phase === 'upcoming' && ` · D-${until}`}
                  </small>
                  <strong>{trip.title}</strong>
                  <span>
                    {trip.startDate.slice(0, 4)}년 {formatDate(trip.startDate)}{' '}
                    – {formatDate(trip.endDate)}
                  </span>
                  <small>
                    {trip.days.length}일 · {trip.days.flat().length}곳
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )
        return phase === 'past' ? (
          <details
            className="trip-library-past"
            key={phase}
            open={query.trim() ? true : undefined}
          >
            <summary>
              {title} {items.length}
            </summary>
            {cards}
          </details>
        ) : (
          <section key={phase} aria-label={title}>
            <h2>
              {title} <span>{items.length}</span>
            </h2>
            {cards}
          </section>
        )
      })}
      {!selected.length && (
        <p className="no-results">일치하는 여행이 없어요.</p>
      )}
    </div>
  )
}
