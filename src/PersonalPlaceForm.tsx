import { useState, type FormEvent } from 'react'
import {
  customPlaceSchema,
  type CustomPlace,
  type Destination,
} from './travel-model'
import { customPlaceKinds, placeCategories } from './place-categories'
import type { RegisteredPlace } from './registered-places'
import type { PersonalPlace } from './personal-place-library'
import PlaceSearchResults, {
  PlaceSearchService,
  usePlaceSearch,
} from './PlaceSearch'
import { useDraftFields } from './form-draft'
import { places } from './catalog'
import { sameDestination, matchesRegisteredPlace } from './registered-places'
import { matchesSearch } from './search'
import { placeCoordinates, placeMapQuery } from './place-location'
import { mapsSearch } from './google-maps'

export default function PersonalPlaceForm({
  entry,
  destinations,
  initialCityId,
  initialName = '',
  initialKind = '관광',
  draftId,
  knownEntries = [],
  onSave,
}: {
  entry?: RegisteredPlace
  destinations: Destination[]
  initialCityId?: string
  initialName?: string
  initialKind?: string
  draftId?: string
  knownEntries?: RegisteredPlace[]
  onSave: (value: PersonalPlace) => boolean
}) {
  const [id] = useState(entry?.personalId || crypto.randomUUID())
  const choices = [
    ...new Map(
      [...(entry ? [entry.destination] : []), ...destinations].map(
        (destination) => [destination.id, destination],
      ),
    ).values(),
  ]
  const defaults = {
    name: entry?.custom.name || initialName,
    cityId: entry?.destination.id || initialCityId || '',
    kind:
      entry?.custom.kind ||
      (customPlaceKinds.includes(initialKind as CustomPlace['kind'])
        ? (initialKind as CustomPlace['kind'])
        : ('관광' as const)),
    description: entry?.description || '',
    selection: entry?.custom || (null as CustomPlace | null),
    originKey: entry?.key || '',
    kindChosen: Boolean(
      entry || (initialKind !== '관광' && initialKind !== '전체'),
    ),
  }
  const draft = useDraftFields(
    `jido-place-library-draft:${draftId || entry?.personalId || entry?.key || initialCityId || 'new'}`,
    defaults,
    {
      kind: (value) => customPlaceKinds.some((kind) => kind === value),
      selection: (value) =>
        value === null || customPlaceSchema.safeParse(value).success,
    },
  )
  const [name, setName] = draft.field('name'),
    [cityId, setCityId] = draft.field('cityId'),
    [kind, setKind] = draft.field('kind'),
    [description, setDescription] = draft.field('description'),
    [selection, setSelection] = draft.field('selection')
  const [originKey] = draft.field('originKey')
  const [kindChosen, setKindChosen] = draft.field('kindChosen')
  const [error, setError] = useState('')
  const remote = usePlaceSearch()
  const [localResults, setLocalResults] = useState<RegisteredPlace[]>([])
  const destination = choices.find((item) => item.id === cityId)
  const clear = () => {
    setSelection(null)
    setLocalResults([])
    remote.reset()
  }
  function find() {
    if (!destination || !name.trim()) return
    const own = knownEntries.filter(
      (item) =>
        sameDestination(item.destination, destination) &&
        matchesRegisteredPlace(item, name),
    )
    const catalog = places
      .filter(
        (place) =>
          place.cityId === destination.guideCityId &&
          matchesSearch(name, place.name, place.english, place.address),
      )
      .map((place) => ({
        key: `catalog:${place.id}`,
        destination,
        custom: {
          name: place.name,
          kind: place.category,
          address: place.address,
          link: mapsSearch(placeMapQuery(place)),
          destinationId: destination.id,
          catalogPlaceId: place.id,
          coordinates: placeCoordinates(place),
        },
      }))
    const found = [...own, ...catalog].slice(0, 20)
    setLocalResults(found)
    remote.reset()
    if (!found.length) void remote.search(name.trim(), destination)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!destination) return setError('도시를 선택해 주세요.')
    const selected =
      selection?.name === name && selection.destinationId === destination.id
        ? selection
        : undefined
    const parsed = customPlaceSchema.safeParse({
      ...selected,
      name,
      kind,
      destinationId: destination.id,
      address: selected?.address || '',
      link: selected?.link || '',
    })
    if (!parsed.success || !name.trim() || description.length > 1000)
      return setError('장소 이름과 소개를 확인해 주세요.')
    try {
      if (
        onSave({
          id,
          custom: parsed.data,
          destination,
          description,
          sourceKeys: originKey ? [originKey] : [],
        }) === false
      )
        return
      draft.clear()
    } catch {
      setError(
        '장소 목록을 저장하지 못했어요. 최대 1,000곳까지 저장할 수 있으며 입력 내용과 저장 공간을 확인해 주세요.',
      )
    }
  }
  return (
    <form className="modal-body personal-place-form" onSubmit={submit}>
      <label className="field">
        도시
        <select
          aria-label="장소의 도시"
          value={cityId}
          onChange={(e) => {
            setCityId(e.target.value)
            clear()
          }}
        >
          <option value="">도시 선택</option>
          {choices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} · {item.country}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        장소 이름
        <div className="input-with-button">
          <input
            aria-label="장소 이름"
            maxLength={160}
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              clear()
            }}
          />
          <button
            className="button outline"
            type="button"
            disabled={!name.trim() || !destination || remote.loading}
            onClick={find}
          >
            찾기
          </button>
        </div>
      </label>
      {localResults.length > 0 && (
        <div className="local-place-results" aria-label="저장된 장소 찾기">
          {localResults.map((item) => (
            <button
              type="button"
              className="button outline full"
              key={item.key}
              onClick={() => {
                if (!destination) return
                setName(item.custom.name)
                setSelection({ ...item.custom, destinationId: destination.id })
                if (!kindChosen) setKind(item.custom.kind)
                if (!description && item.description)
                  setDescription(item.description)
                setLocalResults([])
              }}
            >
              {item.custom.name} · {item.custom.kind}
            </button>
          ))}
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setLocalResults([])
              if (destination) void remote.search(name.trim(), destination)
            }}
          >
            지도에서도 찾기
          </button>
        </div>
      )}
      <PlaceSearchResults
        search={remote}
        onSelect={(place) => {
          if (!destination) return
          setName(place.name)
          setSelection({
            name: place.name,
            kind,
            destinationId: destination.id,
            address: place.address,
            link: place.link,
            coordinates: place.coordinates,
            ...(place.provider === 'google'
              ? { googlePlaceId: place.id }
              : { osmPlaceId: place.id }),
          })
          if (!kindChosen) setKind(place.kind)
          remote.reset()
        }}
      />
      <PlaceSearchService search={remote} />
      {selection && (
        <p className="selected-place">선택한 장소 · {selection.name}</p>
      )}
      <label className="field">
        분류
        <select
          aria-label="장소 분류"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as CustomPlace['kind'])
            setKindChosen(true)
          }}
        >
          {[...new Set([...placeCategories, kind])].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="field">
        간단한 소개
        <input
          aria-label="장소 소개"
          maxLength={1000}
          value={description}
          placeholder="예: 수영장이 있는 가족 숙소"
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" type="submit">
        {entry ? '장소 수정 저장' : '장소 목록에 저장'}
      </button>
    </form>
  )
}
