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
  const [latitude, setLatitude] = useState(
    stop?.custom?.coordinates ? String(stop.custom.coordinates.lat) : '',
  )
  const [longitude, setLongitude] = useState(
    stop?.custom?.coordinates ? String(stop.custom.coordinates.lng) : '',
  )
  const [catalogPlaceId, setCatalogPlaceId] = useState(
    stop?.custom?.catalogPlaceId,
  )
  function setPosition(value: CustomPlace['coordinates']) {
    setCoordinates(value)
    setLatitude(value ? String(value.lat) : '')
    setLongitude(value ? String(value.lng) : '')
  }
  function clearSelection() {
    setGooglePlaceId(undefined)
    setOsmPlaceId(undefined)
    setCatalogPlaceId(undefined)
    setPosition(undefined)
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
    setPosition(place.coordinates)
    setResults([])
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
    setPosition(placeCoordinates(place))
    setName(place.name)
    setAddress(place.address)
    setLink(mapsSearch(placeMapQuery(place)))
    setKind(
      place.category === '맛집' ||
        place.category === '카페' ||
        place.category === '숙소'
        ? place.category
        : place.category === '바·공연'
          ? '기타'
          : '관광',
    )
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
          setPosition(parsed.data.coordinates)
        }
        if (typeof draft.address === 'string') setAddress(draft.address)
        if (typeof draft.latitude === 'string' && draft.latitude.length <= 30)
          setLatitude(draft.latitude)
        if (typeof draft.longitude === 'string' && draft.longitude.length <= 30)
          setLongitude(draft.longitude)
        if (typeof draft.note === 'string') setNote(draft.note)
        if (typeof draft.catalogPlaceId === 'string')
          setCatalogPlaceId(draft.catalogPlaceId)
        if (
          ['관광', '맛집', '카페', '숙소', '이동', '기타'].includes(draft.kind)
        )
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
          latitude,
          longitude,
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
    latitude,
    longitude,
    catalogPlaceId,
  ])
  function applyShare() {
    try {
      const place = parseMapsShare(share)
      setLink(place.link)
      setGooglePlaceId(undefined)
      setOsmPlaceId(undefined)
      setCatalogPlaceId(undefined)
      setPosition(undefined)
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
    const position =
      latitude.trim() || longitude.trim()
        ? { lat: Number(latitude), lng: Number(longitude) }
        : undefined
    if (
      position &&
      (!latitude.trim() ||
        !longitude.trim() ||
        !Number.isFinite(position.lat) ||
        !Number.isFinite(position.lng) ||
        Math.abs(position.lat) > 90 ||
        Math.abs(position.lng) > 180)
    )
      return setError('위도와 경도를 모두 올바르게 입력하세요.')
    const parsed = customPlaceSchema.safeParse({
      name,
      kind,
      address,
      link,
      destinationId,
      googlePlaceId,
      osmPlaceId,
      coordinates: position,
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
              if (googlePlaceId || osmPlaceId || catalogPlaceId || coordinates)
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
            {['관광', '맛집', '카페', '숙소', '이동', '기타'].map((item) => (
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
      <details>
        <summary>주소·링크·메모</summary>
        <label className="field">
          주소
          <input
            maxLength={500}
            value={address}
            onChange={(event) => {
              clearSelection()
              setAddress(event.target.value)
            }}
            placeholder="지도에서 찾을 수 있는 주소"
          />
        </label>
        <label className="field">
          관련 링크
          <input
            type="url"
            maxLength={1500}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://"
          />
        </label>
        <label className="field">
          메모
          <textarea
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="체크인 시간, 이동편, 예약 정보 등"
          />
        </label>
      </details>
      <details className="manual-position">
        <summary>
          위치 직접 지정{latitude && longitude ? ' · 좌표 있음' : ''}
        </summary>
        <div className="form-row">
          <label className="field">
            위도
            <input
              aria-label="장소 위도"
              type="number"
              min="-90"
              max="90"
              step="any"
              value={latitude}
              onChange={(event) => {
                setLatitude(event.target.value)
                setGooglePlaceId(undefined)
                setOsmPlaceId(undefined)
                setCatalogPlaceId(undefined)
                setCoordinates(undefined)
                setLink('')
              }}
            />
          </label>
          <label className="field">
            경도
            <input
              aria-label="장소 경도"
              type="number"
              min="-180"
              max="180"
              step="any"
              value={longitude}
              onChange={(event) => {
                setLongitude(event.target.value)
                setGooglePlaceId(undefined)
                setOsmPlaceId(undefined)
                setCatalogPlaceId(undefined)
                setCoordinates(undefined)
                setLink('')
              }}
            />
          </label>
        </div>
      </details>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="button primary full" type="submit">
        {stop ? '직접 추가한 일정 수정' : '내 일정에 추가'}
      </button>
    </form>
  )
}
