import { customPlaceKinds } from './place-categories'
import PlaceSearchResults, {
  PlaceSearchService,
  usePlaceSearch,
} from './PlaceSearch'
import type { SearchPlace } from './place-search'
import { places, type Place } from './catalog'
import { matchesSearch } from './search'
import { placeCoordinates, placeMapQuery } from './place-location'
import { mapsSearch, parseMapsShare } from './google-maps'
import { useEffect, useState, type FormEvent } from 'react'
import {
  destinationForDay,
  customPlaceSchema,
  tripDestinations,
  stopName,
  type Stop,
  type Trip,
  type CustomPlace,
} from './travel-model'

export default function CustomStopForm({
  trip,
  day,
  stop,
  onSave,
  onBrowse,
  initialName = '',
}: {
  trip: Trip
  day: number
  stop?: Stop
  onBrowse?: () => void
  initialName?: string
  onSave: (stop: Stop) => void
}) {
  const [name, setName] = useState(stop ? stopName(stop) : initialName)
  const [kind, setKind] = useState<CustomPlace['kind']>(
    stop?.custom?.kind || '관광',
  )
  const [address, setAddress] = useState(stop?.custom?.address || '')
  const [link, setLink] = useState(stop?.custom?.link || '')
  const [destinationId, setDestinationId] = useState(
    stop?.custom?.destinationId || destinationForDay(trip, day).id,
  )
  const [time, setTime] = useState(stop?.time || '10:00')
  const [note, setNote] = useState(stop?.note || '')
  const [error, setError] = useState('')
  const [share, setShare] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const google = usePlaceSearch()
  const [googlePlaceId, setGooglePlaceId] = useState(
    stop?.custom?.googlePlaceId,
  )
  const [coordinates, setCoordinates] = useState(stop?.custom?.coordinates)
  const [osmPlaceId, setOsmPlaceId] = useState(stop?.custom?.osmPlaceId)
  const [catalogPlaceId, setCatalogPlaceId] = useState(
    stop?.custom?.catalogPlaceId,
  )
  function clearSelection() {
    setGooglePlaceId(undefined)
    setOsmPlaceId(undefined)
    setCatalogPlaceId(undefined)
    setCoordinates(undefined)
    setLink('')
  }
  function chooseGoogle(place: SearchPlace) {
    setCatalogPlaceId(undefined)
    setName(place.name)
    setAddress(place.address)
    setLink(place.link)
    setKind(place.kind)
    setGooglePlaceId(place.provider === 'google' ? place.id : undefined)
    setOsmPlaceId(place.provider === 'osm' ? place.id : undefined)
    setCoordinates(place.coordinates)
    setResults([])
    google.reset()
  }
  function findPlace(source: 'auto' | 'google' = 'auto') {
    if (!name.trim()) return
    const destination = tripDestinations(trip).find(
      (item) => item.id === destinationId,
    )!
    const found =
      source === 'google'
        ? []
        : places.filter(
            (place) =>
              place.cityId === destination.guideCityId &&
              matchesSearch(name, place.name, place.english, place.address),
          )
    setResults(found)
    google.reset()
    if (!found.length) void google.search(name.trim(), destination)
  }
  function choosePlace(place: Place) {
    setCatalogPlaceId(place.id)
    setGooglePlaceId(undefined)
    setOsmPlaceId(undefined)
    setCoordinates(placeCoordinates(place))
    setName(place.name)
    setAddress(place.address)
    setLink(mapsSearch(placeMapQuery(place)))
    setKind(place.category)
    setResults([])
  }
  const draftKey = `jdo-place-draft:${trip.id}:${day}:${stop?.id || 'new'}${!stop && initialName ? ':' + initialName : ''}`
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || 'null')
      if (draft) {
        if (typeof draft.name === 'string') setName(draft.name)
        if (typeof draft.link === 'string') setLink(draft.link)
        const parsed = customPlaceSchema.safeParse(draft)
        if (parsed.success) {
          setGooglePlaceId(parsed.data.googlePlaceId)
          setOsmPlaceId(parsed.data.osmPlaceId)
          setCoordinates(parsed.data.coordinates)
        }
        if (typeof draft.address === 'string') setAddress(draft.address)
        // Keep valid coordinates from older manual-position drafts. Partial or
        // invalid drafts must not become a hidden validation error or (0, 0).
        if (!parsed.success || !parsed.data.coordinates) {
          const latitude =
            typeof draft.latitude === 'string' ? draft.latitude.trim() : ''
          const longitude =
            typeof draft.longitude === 'string' ? draft.longitude.trim() : ''
          const legacy = customPlaceSchema.shape.coordinates.safeParse(
            latitude && longitude
              ? { lat: Number(latitude), lng: Number(longitude) }
              : undefined,
          )
          if (legacy.success && legacy.data) setCoordinates(legacy.data)
        }
        if (typeof draft.note === 'string') setNote(draft.note)
        if (typeof draft.catalogPlaceId === 'string')
          setCatalogPlaceId(draft.catalogPlaceId)
        if (customPlaceKinds.some((kind) => kind === draft.kind))
          setKind(draft.kind)
        if (
          tripDestinations(trip).some((item) => item.id === draft.destinationId)
        )
          setDestinationId(draft.destinationId)
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) setTime(draft.time)
      }
    } catch {
      /* Drafts are optional. */
    }
    setLoaded(true)
  }, [draftKey])
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          name,
          link,
          address,
          note,
          time,
          kind,
          destinationId,
          googlePlaceId,
          osmPlaceId,
          coordinates,
          catalogPlaceId,
        }),
      )
    } catch {
      /* Main save reports storage failures. */
    }
  }, [
    loaded,
    draftKey,
    name,
    link,
    address,
    note,
    time,
    kind,
    destinationId,
    googlePlaceId,
    osmPlaceId,
    coordinates,
    catalogPlaceId,
  ])
  function applyShare() {
    try {
      const place = parseMapsShare(share)
      setLink(place.link)
      setGooglePlaceId(undefined)
      setOsmPlaceId(undefined)
      setCatalogPlaceId(undefined)
      setCoordinates(undefined)
      setAddress('')
      if (place.name) setName(place.name)
      setError('')
      setShare('')
    } catch (error) {
      setError((error as Error).message)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!stop && trip.days[day].length >= 200)
      return setError('하루 일정은 최대 200곳까지 담을 수 있어요.')
    const parsed = customPlaceSchema.safeParse({
      name,
      kind,
      address,
      link,
      destinationId,
      googlePlaceId,
      osmPlaceId,
      coordinates,
      catalogPlaceId,
    })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    try {
      localStorage.removeItem(draftKey)
    } catch {
      /* Optional draft. */
    }
    onSave({
      ...stop,
      id: stop?.id || crypto.randomUUID(),
      placeId: stop?.placeId || `custom-${crypto.randomUUID()}`,
      time,
      note,
      custom: parsed.data,
    })
  }
  return (
    <form className="create-form" onSubmit={submit}>
      <label className="field">
        장소 또는 일정 이름
        <span className="place-find-row">
          <input
            required
            maxLength={160}
            value={name}
            onChange={(event) => {
              setAddress('')
              clearSelection()
              setName(event.target.value)
              setResults([])
              google.reset()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                findPlace()
              }
            }}
            placeholder="장소 이름 입력"
          />
          <button
            className="button primary"
            type="button"
            disabled={!name.trim() || google.loading}
            onClick={() => findPlace()}
          >
            {google.loading ? '찾는 중' : '찾기'}
          </button>
        </span>
      </label>
      <PlaceSearchService search={google} />
      {results.length > 0 && (
        <button
          type="button"
          className="text-button"
          disabled={google.loading}
          onClick={() => findPlace('google')}
        >
          {google.service === 'google'
            ? '구글 지도에서 찾기'
            : '무료 지도에서 찾기'}
        </button>
      )}
      {results.length > 0 && (
        <div className="place-find-results" aria-label="장소 검색 결과">
          {results.map((place) => (
            <button
              type="button"
              key={place.id}
              onClick={() => choosePlace(place)}
            >
              <strong>{place.name}</strong>
              <span>{place.address}</span>
            </button>
          ))}
        </div>
      )}
      <PlaceSearchResults
        search={google}
        onSelect={chooseGoogle}
        selectedId={googlePlaceId || osmPlaceId}
      />
      {(googlePlaceId || osmPlaceId || catalogPlaceId) && (
        <p className="maps-applied" role="status">
          선택한 장소 · {name}
        </p>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-button"
        >
          지도에서 확인 ↗
        </a>
      )}
      {!stop && (
        <details className="maps-import">
          <summary>지도 공유 링크로 지정</summary>
          <label className="field">
            공유 링크 또는 공유 텍스트
            <textarea
              value={share}
              onChange={(event) => setShare(event.target.value)}
              placeholder="구글 지도 → 공유 → 링크 복사 후 붙여넣기"
              maxLength={4000}
              rows={2}
            />
          </label>
          <button
            className="button outline full"
            type="button"
            disabled={!share.trim()}
            onClick={applyShare}
          >
            이 장소 적용
          </button>
          {link && (
            <p className="maps-applied" role="status">
              지도 링크 적용됨{!name && ' · 장소 이름을 입력하세요'}
            </p>
          )}
        </details>
      )}
      {onBrowse && !stop && (
        <button className="text-button" type="button" onClick={onBrowse}>
          등록된 가볼 곳에서 선택
        </button>
      )}
      <div className="form-row">
        <label className="field">
          일정 유형
          <select
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as CustomPlace['kind'])
            }
          >
            {customPlaceKinds.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field">
          방문 시간
          <input
            required
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        메모
        <textarea
          aria-label="메모"
          maxLength={2000}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="체크인 시간, 이동편, 준비할 것 등"
        />
      </label>
      {tripDestinations(trip).length > 1 && (
        <label className="field">
          일정의 도시
          <select
            value={destinationId}
            onChange={(event) => {
              clearSelection()
              setAddress('')
              setDestinationId(event.target.value)
              setResults([])
              google.reset()
            }}
          >
            {tripDestinations(trip).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.country}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary full" type="submit">
        {stop ? '저장' : '일정에 추가'}
      </button>
    </form>
  )
}
