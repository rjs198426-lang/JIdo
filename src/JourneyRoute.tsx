import { activeDayStops } from './transfer-planning'
import { cancelledReservation } from './journey-progress'
import { googleMapsLink } from './google-maps'
import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, MapPin, Plus, Trash2, ExternalLink } from 'lucide-react'
import { cities } from './catalog'
import {
  destinationForDay,
  mapQuery,
  stopDetails,
  tripDestinations,
  type Trip,
} from './travel-model'
import { routePoints } from './route-map-model'
const ItineraryMap = lazy(() => import('./ItineraryMap'))

export default function JourneyRoute({
  trip,
  day,
  onUpdate,
}: {
  trip: Trip
  day: number
  onUpdate: (trip: Trip) => void
}) {
  const [adding, setAdding] = useState(false)
  const [guideId, setGuideId] = useState('custom')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [error, setError] = useState('')
  const destinations = tripDestinations(trip)
  const selected = destinationForDay(trip, day)
  const assignments = trip.days.map(
    (_, index) => destinationForDay(trip, index).id,
  )
  function add(event: FormEvent) {
    event.preventDefault()
    const city = cities.find((city) => city.id === guideId)
    const next = {
      id: crypto.randomUUID(),
      name: city?.name || name.trim(),
      country: city?.country || country.trim(),
      ...(city ? { guideCityId: city.id } : {}),
    }
    if (!next.name || !next.country)
      return setError('도시와 국가를 입력해 주세요.')
    if (
      destinations.some(
        (item) =>
          item.name.toLowerCase() === next.name.toLowerCase() &&
          item.country.toLowerCase() === next.country.toLowerCase(),
      )
    )
      return setError('이미 여행 경로에 있는 도시예요.')
    if (destinations.length >= 30)
      return setError('한 여행에 최대 30개 도시를 담을 수 있어요.')
    onUpdate({
      ...trip,
      destinations: [...destinations, next],
      dayDestinationIds: assignments.map((id, index) =>
        index === day ? next.id : id,
      ),
    })
    setAdding(false)
    setName('')
    setCountry('')
    setError('')
  }
  return (
    <section className="journey-route" aria-label="여행 도시 경로">
      <div className="journey-city-controls">
        <label className="day-destination">
          <MapPin size={17} aria-hidden="true" />
          <select
            aria-label="이날의 체류 도시"
            value={selected.id}
            onChange={(event) =>
              onUpdate({
                ...trip,
                destinations,
                dayDestinationIds: assignments.map((id, index) =>
                  index === day ? event.target.value : id,
                ),
              })
            }
          >
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name} · {destination.country}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button outline small"
          aria-expanded={adding}
          onClick={() => setAdding(!adding)}
        >
          <Plus size={16} />
          도시 추가
        </button>
      </div>
      <details className="city-details">
        <summary>전체 도시 관리 · {destinations.length}개</summary>
        <div className="destination-chips">
          {destinations.map((destination, index) => (
            <div
              key={destination.id}
              className={destination.id === selected.id ? 'selected' : ''}
            >
              <span>
                <small>{destination.country}</small>
                <strong>{destination.name}</strong>
              </span>
              {index > 0 && (
                <button
                  className="icon-button"
                  aria-label={`${destination.name} 경로에서 삭제`}
                  disabled={
                    assignments.includes(destination.id) ||
                    trip.days
                      .flat()
                      .some(
                        (stop) => stop.custom?.destinationId === destination.id,
                      )
                  }
                  onClick={() =>
                    onUpdate({
                      ...trip,
                      destinations: destinations.filter(
                        (item) => item.id !== destination.id,
                      ),
                      dayDestinationIds: assignments,
                    })
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
              {index < destinations.length - 1 && (
                <ArrowRight className="destination-arrow" size={16} />
              )}
            </div>
          ))}
        </div>
      </details>
      {adding && (
        <form className="inline-form" onSubmit={add}>
          <label className="field">
            추가할 여행지
            <select
              value={guideId}
              onChange={(event) => setGuideId(event.target.value)}
            >
              <option value="custom">도시 직접 입력</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} · {city.country}
                </option>
              ))}
            </select>
          </label>
          {guideId === 'custom' && (
            <div className="form-row">
              <label className="field">
                도시 이름
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="예: 로마"
                />
              </label>
              <label className="field">
                국가
                <input
                  required
                  maxLength={80}
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder="예: 이탈리아"
                />
              </label>
            </div>
          )}
          <p className="muted">
            추가한 도시는 현재 DAY {day + 1}의 체류 도시로 설정돼요. 기존 장소는
            유지돼요.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="button primary" type="submit">
            경로에 도시 추가
          </button>
        </form>
      )}
    </section>
  )
}

export function DayRoute({
  trip,
  day,
  onUpdate,
  onEdit,
  onAdd,
  selectedId,
  onSelect,
  onShowStop,
}: {
  trip: Trip
  day: number
  onUpdate: (trip: Trip) => void
  onEdit: (id: string) => void
  onAdd: () => void
  selectedId?: string
  onSelect: (id: string) => void
  onShowStop: (id: string) => void
}) {
  const stops = trip.days[day]
  const points = useMemo(() => routePoints(stops), [stops])
  const selectedIndex = Math.max(
    0,
    stops.findIndex((stop) => stop.id === selectedId),
  )
  const selected = stops[selectedIndex]
  const selectedPoint = points.find((point) => point.stopId === selected?.id)
  function move(direction: number) {
    const next = selectedIndex + direction
    if (next < 0 || next >= stops.length) return
    const ordered = [...stops]
    ;[ordered[selectedIndex], ordered[next]] = [
      ordered[next],
      ordered[selectedIndex],
    ]
    onUpdate({
      ...trip,
      days: trip.days.map((items, index) => (index === day ? ordered : items)),
    })
  }
  const activeStops = activeDayStops(trip, day)
  const queries = activeStops.slice(0, 5).map((stop) => mapQuery(stop, trip))
  const params = new URLSearchParams({
    api: '1',
    origin: queries[0] || '',
    destination: queries.at(-1) || '',
    travelmode: 'transit',
  })
  // Google Maps transit does not accept waypoints; use walking for a multi-stop city route.
  if (queries.length > 2) {
    params.set('travelmode', 'walking')
    params.set('waypoints', queries.slice(1, -1).join('|'))
  }
  return (
    <div className="route-view">
      <div className="tool-heading">
        <div>
          <h3>오늘의 동선</h3>
        </div>
        <button className="button outline small" onClick={onAdd}>
          <Plus size={16} />
          장소 추가
        </button>
      </div>
      {stops.length < 1 && <p className="workspace-empty">일정이 없습니다.</p>}
      {!!stops.length && (
        <>
          <Suspense
            fallback={
              <div className="map-loading" role="status">
                지도 여는 중…
              </div>
            }
          >
            <ItineraryMap
              key={`${trip.id}:${day}`}
              points={points}
              selectedId={selected?.id}
              onSelect={onSelect}
            />
          </Suspense>
          <div className="map-sequence-controls" aria-label="장소 순서 이동">
            <button
              className="button outline small"
              disabled={selectedIndex === 0}
              onClick={() => onSelect(stops[selectedIndex - 1].id)}
            >
              이전 장소
            </button>
            <strong>
              {selectedIndex + 1} / {stops.length}
            </strong>
            <button
              className="button outline small"
              disabled={selectedIndex === stops.length - 1}
              onClick={() => onSelect(stops[selectedIndex + 1].id)}
            >
              다음 장소
            </button>
          </div>
          <article
            className="map-selected-place"
            aria-label="지도에서 선택한 장소"
          >
            <span className="map-place-number">{selectedIndex + 1}</span>
            <div>
              <small>{selected.time}</small>
              <h3>{stopDetails(selected).name}</h3>
              {(selected.status === 'skipped' ||
                cancelledReservation(trip, selected)) && (
                <small className="route-stop-status">
                  {cancelledReservation(trip, selected)
                    ? '예약 취소'
                    : '건너뜀'}{' '}
                  · 길찾기 제외
                </small>
              )}
              <p>
                {selected.custom?.address ||
                  (!selected.custom
                    ? stopDetails(selected).address
                    : '주소 미입력')}
              </p>
              {!selectedPoint && (
                <button
                  className="text-button"
                  onClick={() => onEdit(selected.id)}
                >
                  위치 추가
                </button>
              )}
            </div>
            <div className="map-reorder">
              <button
                className="icon-button"
                aria-label="선택한 장소 순서 앞으로"
                disabled={selectedIndex === 0}
                onClick={() => move(-1)}
              >
                ↑
              </button>
              <button
                className="icon-button"
                aria-label="선택한 장소 순서 뒤로"
                disabled={selectedIndex === stops.length - 1}
                onClick={() => move(1)}
              >
                ↓
              </button>
            </div>
          </article>
          <button
            className="button outline full"
            onClick={() => onShowStop(selected.id)}
          >
            선택한 장소 일정 보기
          </button>
          {points.length < stops.length && (
            <p className="map-missing-count">
              위치 미지정 {stops.length - points.length}곳
            </p>
          )}
        </>
      )}
      <ol className="route-stops">
        {stops.map((stop, index) => (
          <li key={stop.id}>
            <button
              className={`route-place-select ${selected?.id === stop.id ? 'selected' : ''}`}
              aria-label={`${index + 1}번 ${stopDetails(stop).name} 지도에서 선택`}
              aria-pressed={selected?.id === stop.id}
              onClick={() => onSelect(stop.id)}
            >
              {index + 1}
            </button>
            <div>
              <small>{stop.time}</small>
              <strong>{stopDetails(stop).name}</strong>
              {(stop.status === 'skipped' ||
                cancelledReservation(trip, stop)) && (
                <small className="route-stop-status">
                  {cancelledReservation(trip, stop) ? '예약 취소' : '건너뜀'} ·
                  길찾기 제외
                </small>
              )}
              <p>
                {stop.custom?.address ||
                  (!stop.custom
                    ? stopDetails(stop).address
                    : '주소 미입력 · 이름으로 검색해요')}
              </p>
            </div>
            <a
              aria-label={`${stopDetails(stop).name} 지도 검색`}
              href={
                (stop.custom && googleMapsLink(stop.custom.link)) ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(stop, trip))}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={18} />
            </a>
          </li>
        ))}
      </ol>
      {queries.length > 1 && (
        <a
          className="button primary full"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.google.com/maps/dir/?${params}`}
        >
          {activeStops.length > 5 ? '앞의 5곳' : '이 순서로'} 지도에서 길찾기{' '}
          <ExternalLink size={16} />
        </a>
      )}
    </div>
  )
}
