import { useState } from 'react'
import { Search, ExternalLink } from 'lucide-react'
import {
  cities,
  places,
  getCity,
  getPlace,
  type City,
  type Place,
} from './catalog'
import { tripCity, tripDestinations, type Trip } from './travel-model'

export default function PhotoCredits({
  trips,
  savedCities,
  savedPlaces,
}: {
  trips: Trip[]
  savedCities: string[]
  savedPlaces: string[]
}) {
  const [query, setQuery] = useState('')
  const sources: (City | Place | undefined)[] = [
    ...cities,
    ...places,
    ...savedCities.map(getCity),
    ...savedPlaces.map(getPlace),
    ...trips.flatMap((trip) => [
      tripCity(trip),
      ...tripDestinations(trip).map((item) => getCity(item.guideCityId || '')),
      ...trip.days
        .flat()
        .map((stop) =>
          getPlace(
            stop.custom ? stop.custom.catalogPlaceId || '' : stop.placeId,
          ),
        ),
    ]),
  ]
  const entries = new Map<
    string,
    { source: City | Place; names: Set<string> }
  >()
  for (const source of sources) {
    const credit = source?.photoCredit
    if (!source || !credit || source.image !== credit.file) continue
    const key = `${credit.file}|${credit.sourceUrl}|${credit.author}|${credit.licenseUrl}`
    const entry = entries.get(key)
    if (entry) entry.names.add(source.name)
    else entries.set(key, { source, names: new Set([source.name]) })
  }
  const filtered = [...entries.values()].filter(({ source, names }) =>
    [...names, source.photoCredit!.author]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  )
  return (
    <div className="modal-body photo-credits-panel">
      <label className="input-search">
        <Search size={18} />
        <input
          aria-label="사진 출처 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="도시, 장소, 촬영자"
        />
      </label>
      <div className="photo-credits-list">
        {filtered.map(({ source, names }) => {
          const credit = source.photoCredit!
          return (
            <article
              className="photo-credit-entry"
              key={`${credit.file}|${credit.sourceUrl}|${credit.author}|${credit.licenseUrl}`}
            >
              <img src={source.image} alt="" loading="lazy" />
              <div>
                <h3>{[...names].join(' · ')}</h3>
                <p>{credit.author || '작자 미상'}</p>
                <div className="photo-credit-links">
                  <a
                    href={credit.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    사진 원본
                    <ExternalLink size={12} />
                  </a>
                  <a
                    href={credit.licenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {credit.license}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {!filtered.length && (
        <p className="photo-credits-empty">일치하는 사진이 없어요.</p>
      )}
    </div>
  )
}
