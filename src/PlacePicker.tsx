import { useContext, useState } from 'react'
import { Search, Plus, Check, MapPin } from 'lucide-react'
import PlaceSearchResults, {
  PlaceSearchService,
  usePlaceSearch,
} from './PlaceSearch'
import { PlaceLibraryContext } from './PlaceLibraryContext'
import {
  registeredPlaces,
  sameDestination,
  matchesRegisteredPlace,
  registeredPlaceKey,
} from './registered-places'
import { destinationForDay, type CustomPlace, type Trip } from './travel-model'
import { dateAt, formatDate } from './store'

export default function PlacePicker({
  trip,
  trips,
  day,
  onCustom,
  onReuse,
  onDone,
}: {
  trip: Trip
  trips: Trip[]
  day: number
  onCustom: (name: string) => void
  onReuse: (place: CustomPlace) => void
  onDone: () => void
  onAdd?: (id: string) => void
  onOpen?: (id: string) => void
}) {
  const [query, setQuery] = useState(''),
    [initialIds] = useState(
      () => new Set(trip.days[day].map((stop) => stop.id)),
    )
  const remote = usePlaceSearch(),
    library = useContext(PlaceLibraryContext),
    destination = destinationForDay(trip, day)
  const saved = (
    library?.entries || registeredPlaces(trips, destination)
  ).filter(
    (entry) =>
      sameDestination(entry.destination, destination) &&
      matchesRegisteredPlace(entry, query),
  )
  const added = trip.days[day].filter((stop) => !initialIds.has(stop.id))
  const find = () => {
    if (query.trim() && !remote.loading)
      void remote.search(query.trim(), destination)
  }
  return (
    <div className="modal-body place-picker-body">
      <p className="muted picker-description">
        {destination.name} · {formatDate(dateAt(trip.startDate, day))}
      </p>
      <div className="input-search">
        <Search size={18} />
        <input
          aria-label="일정에 추가할 장소 검색"
          placeholder="장소 이름 또는 주소"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            remote.reset()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              find()
            }
          }}
        />
        <button
          className="button primary small"
          type="button"
          onClick={find}
          disabled={!query.trim() || remote.loading}
        >
          {remote.loading
            ? '찾는 중…'
            : remote.service === 'google'
              ? 'Google 검색'
              : '지도 검색'}
        </button>
      </div>
      <button
        className="button outline full custom-stop-cta"
        onClick={() => onCustom(query.trim())}
      >
        <Plus size={17} />
        {query.trim() ? `‘${query.trim()}’ 직접 입력` : '직접 일정 입력'}
      </button>
      <PlaceSearchResults
        search={remote}
        actionLabel="일정에 추가"
        isAdded={(place) =>
          trip.days[day].some((stop) =>
            place.provider === 'osm'
              ? stop.custom?.osmPlaceId === place.id
              : stop.custom?.googlePlaceId === place.id,
          )
        }
        onSelect={(place) =>
          onReuse({
            name: place.name,
            kind: place.kind,
            address: place.address,
            link: place.link,
            destinationId: destination.id,
            coordinates: place.coordinates,
            ...(place.provider === 'osm'
              ? { osmPlaceId: place.id }
              : { googlePlaceId: place.id }),
          })
        }
      />
      <PlaceSearchService search={remote} />
      <section className="picker-list" aria-label="내가 등록한 장소">
        <h3>내가 등록한 장소</h3>
        {saved.length ? (
          saved.map((entry) => {
            const exists = trip.days[day].some(
              (stop) =>
                stop.custom &&
                registeredPlaceKey(stop.custom) ===
                  registeredPlaceKey(entry.custom),
            )
            return (
              <div className="picker-item" key={entry.key}>
                <MapPin size={21} />
                <button
                  className="picker-place-name"
                  disabled={exists}
                  onClick={() => onReuse(entry.custom)}
                >
                  <strong>{entry.custom.name}</strong>
                  <small>
                    {entry.custom.kind} ·{' '}
                    {entry.custom.address || destination.name}
                  </small>
                </button>
                <button
                  className="icon-button"
                  disabled={exists}
                  aria-label={`${entry.custom.name} ${exists ? '추가됨' : '일정에 추가'}`}
                  onClick={() => onReuse(entry.custom)}
                >
                  {exists ? <Check size={20} /> : <Plus size={20} />}
                </button>
              </div>
            )
          })
        ) : (
          <p className="muted">
            지도에서 찾거나 이름만 직접 입력해 시작하세요. 시간은 나중에 정할 수
            있어요.
          </p>
        )}
      </section>
      <div className="picker-confirm" aria-label="이날 담은 장소">
        <div role="status">
          <strong>일정 {trip.days[day].length}곳</strong>
          <span>
            {added.length
              ? `이번에 ${added.length}곳 추가했어요`
              : '정한 순서대로 담아보세요'}
          </span>
        </div>
        <button className="button primary full" onClick={onDone}>
          일정으로 돌아가기
        </button>
      </div>
    </div>
  )
}
