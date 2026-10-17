import { balancedPlaces } from './category-balance'
import { useState } from 'react'
import { Check, Plus, Search, MapPin, Clock3 } from 'lucide-react'
import { places, categoryOptions, getCity } from './catalog'
import { destinationForDay, type Trip, type CustomPlace } from './travel-model'
import { dateAt, formatDate } from './store'
import { matchesPlace, matchesSearch } from './search'
import PlacePhoto from './PlacePhoto'
import {
  registeredPlaces,
  registeredPlaceKey,
  matchesRegisteredPlace,
} from './registered-places'
import { sameStopPlace } from './stop-identity'

export default function PlacePicker({
  trip,
  trips,
  day,
  onAdd,
  onOpen,
  onCustom,
  onReuse,
}: {
  trip: Trip
  trips: Trip[]
  day: number
  onAdd: (placeId: string) => void
  onOpen: (placeId: string) => void
  onCustom: (name: string) => void
  onReuse: (place: CustomPlace) => void
}) {
  const [category, setCategory] = useState('전체')
  const [query, setQuery] = useState('')
  const destination = destinationForDay(trip, day)
  const known = places.filter(
    (place) =>
      place.cityId === destination.guideCityId &&
      (matchesPlace(place, getCity(place.cityId)!, query) ||
        matchesSearch(query, place.name, place.english, place.address)),
  )
  const saved = registeredPlaces(trips, destination).filter((place) =>
    matchesRegisteredPlace(place, query),
  )
  const available = (
    category === '전체' ? balancedPlaces(known) : known
  ).filter((place) => category === '전체' || place.category === category)
  const reused = saved.filter(
    (place) => category === '전체' || place.custom.kind === category,
  )
  return (
    <div className="modal-body">
      <p className="muted picker-description">
        DAY {day + 1} · {formatDate(dateAt(trip.startDate, day))}
      </p>
      <div className="input-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setCategory('전체')
          }}
          placeholder="등록된 장소 이름·주소 검색"
          aria-label="일정에 추가할 장소 검색"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              setCategory('전체')
            }
          }}
        />
        <button
          className="button primary small"
          type="button"
          disabled={!query.trim()}
          onClick={() => setCategory('전체')}
        >
          찾기
        </button>
      </div>
      <div className="filter-row">
        {[...categoryOptions, '이동', '기타'].map((item) => (
          <button
            type="button"
            key={item}
            className={`filter ${item === category ? 'active' : ''}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="picker-list" aria-label="등록된 가볼 곳">
        {reused.map((entry) => {
          const added = trip.days[day].some(
            (stop) =>
              stop.custom &&
              registeredPlaceKey(stop.custom) ===
                registeredPlaceKey(entry.custom),
          )
          return (
            <div key={entry.key} className="picker-item">
              <span className="registered-place-icon">
                <MapPin size={22} />
              </span>
              <button
                type="button"
                className="picker-place-name"
                disabled={added}
                onClick={() => onReuse(entry.custom)}
              >
                <small>{entry.custom.kind} · 직접 등록</small>
                <strong>{entry.custom.name}</strong>
                <span>{entry.custom.address || destination.name}</span>
              </button>
              <button
                type="button"
                className={`icon-button ${added ? 'added' : 'add-stop'}`}
                disabled={added}
                aria-label={`${entry.custom.name} ${added ? '추가됨' : '일정에 추가'}`}
                onClick={() => onReuse(entry.custom)}
              >
                {added ? <Check size={20} /> : <Plus size={20} />}
              </button>
            </div>
          )
        })}
        {available.map((place) => {
          const added = trip.days[day].some((stop) =>
            sameStopPlace(stop, {
              id: 'candidate',
              placeId: place.id,
              time: '10:00',
              note: '',
            }),
          )
          return (
            <div key={place.id} className="picker-item">
              <PlacePhoto
                place={place}
                alt={place.name}
                className="picker-place-photo"
              />
              <button
                type="button"
                className="picker-place-name"
                onClick={() => onOpen(place.id)}
              >
                <small>{place.category}</small>
                <strong>{place.name}</strong>
                <span>
                  <Clock3 size={12} />
                  {place.duration}
                </span>
              </button>
              <button
                type="button"
                className={`icon-button ${added ? 'added' : 'add-stop'}`}
                disabled={added}
                aria-label={`${place.name} ${added ? '추가됨' : '일정에 추가'}`}
                onClick={() => onAdd(place.id)}
              >
                {added ? <Check size={20} /> : <Plus size={20} />}
              </button>
            </div>
          )
        })}
      </div>
      {!available.length && !reused.length && (
        <p className="no-results">등록된 장소가 없어요.</p>
      )}
      {!available.length &&
        !reused.length &&
        known.length + saved.length > 0 && (
          <button
            type="button"
            className="button outline full"
            onClick={() => setCategory('전체')}
          >
            전체 분류에서 보기
          </button>
        )}
      <button
        type="button"
        className={`button ${known.length + saved.length ? 'outline' : 'primary'} full custom-stop-cta`}
        onClick={() => onCustom(query.trim())}
      >
        <Plus size={17} />
        {query.trim() && !known.length && !saved.length
          ? `‘${query.trim()}’ 새 장소 추가`
          : '새 장소 추가'}
      </button>
    </div>
  )
}
