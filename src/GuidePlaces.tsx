import PlacePhoto from './PlacePhoto'
import { useState } from 'react'
import {
  ChevronRight,
  MapPin,
  Utensils,
  Coffee,
  BedDouble,
  Music,
} from 'lucide-react'
import { places, categoryOptions, type Place } from './catalog'
const icons = {
  관광: MapPin,
  맛집: Utensils,
  카페: Coffee,
  숙소: BedDouble,
  '바·공연': Music,
}
export default function GuidePlaces({
  cityId,
  onOpen,
}: {
  cityId: string
  onOpen: (id: string) => void
}) {
  const [category, setCategory] =
    useState<(typeof categoryOptions)[number]>('전체')
  const [query, setQuery] = useState('')
  const all = places.filter((place) => place.cityId === cityId)
  const filtered = all.filter(
    (place) =>
      (category === '전체' || place.category === category) &&
      `${place.name} ${place.address}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  )
  return (
    <section className="guide-places" aria-label="가이드 가볼 만한 곳">
      <div className="detail-section-heading">
        <h3>이 도시에서 꼭 가볼 곳</h3>
        <span aria-live="polite">
          {category === '전체'
            ? `${all.length}곳`
            : `${filtered.length}/${all.length}곳`}
        </span>
      </div>
      <div
        className="category-row guide-place-categories"
        role="group"
        aria-label="가볼 만한 곳 분류"
      >
        {categoryOptions.map((item) => {
          const count =
            item === '전체'
              ? all.length
              : all.filter((place) => place.category === item).length
          return (
            <button
              key={item}
              type="button"
              className={category === item ? 'active' : ''}
              aria-label={item}
              aria-pressed={category === item}
              disabled={!count && item !== '전체'}
              onClick={() => setCategory(item)}
            >
              {item}
              <span aria-hidden="true">{count}</span>
            </button>
          )
        })}
      </div>
      <label className="field guide-place-search">
        이 도시의 장소 찾기
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="장소 이름·주소"
        />
      </label>
      <div className="detail-place-list">
        {filtered.map((place: Place) => {
          const Icon = icons[place.category]
          return (
            <div key={place.id}>
              {place.image ? (
                <PlacePhoto
                  place={place}
                  className="guide-place-thumb"
                  alt={place.name}
                />
              ) : (
                <span className="detail-place-icon">
                  <Icon size={18} />
                </span>
              )}
              <button onClick={() => onOpen(place.id)}>
                <strong>{place.name}</strong>
                <span>
                  {place.category} · {place.duration}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label={`${place.name} 자세히 보기`}
                onClick={() => onOpen(place.id)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )
        })}
      </div>
      {!filtered.length && (
        <p className="guide-places-empty">등록된 장소가 없어요.</p>
      )}
    </section>
  )
}
