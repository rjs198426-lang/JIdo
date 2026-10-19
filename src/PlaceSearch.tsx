import { useCallback, useEffect, useRef, useState } from 'react'
import {
  findPlaces,
  searchService,
  saveSearchService,
  type PlaceSearchService,
  type SearchPlace,
  type SearchContext,
} from './place-search'
export function usePlaceSearch() {
  const [service, setService] = useState(searchService)
  const [results, setResults] = useState<SearchPlace[]>([])
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [searched, setSearched] = useState(false)
  const request = useRef(0)
  const reset = useCallback(() => {
    request.current++
    setResults([])
    setError('')
    setLoading(false)
    setSearched(false)
  }, [])
  useEffect(
    () => () => {
      request.current++
    },
    [],
  )
  const changeService = (value: PlaceSearchService) => {
    reset()
    setService(value)
    saveSearchService(value)
  }
  const search = useCallback(
    async (query: string, context?: SearchContext) => {
      const current = ++request.current
      setResults([])
      setError('')
      setLoading(true)
      setSearched(false)
      try {
        const found = await findPlaces(query, service, context)
        if (current === request.current) {
          setResults(found)
          setSearched(true)
        }
      } catch (error) {
        if (current === request.current)
          setError(
            error instanceof Error &&
              /^(무료|구글|인터넷|검색)/.test(error.message)
              ? error.message
              : '장소 검색에 연결할 수 없습니다. 다시 찾거나 장소 이름으로 추가하세요.',
          )
      } finally {
        if (current === request.current) setLoading(false)
      }
    },
    [service],
  )
  return {
    service,
    changeService,
    results,
    loading,
    error,
    searched,
    reset,
    search,
  }
}
export function PlaceSearchService({
  search,
}: {
  search: ReturnType<typeof usePlaceSearch>
}) {
  return (
    <label className="search-service">
      검색{' '}
      <select
        aria-label="장소 검색 서비스"
        value={search.service}
        onChange={(event) =>
          search.changeService(event.target.value as PlaceSearchService)
        }
      >
        <option value="osm">무료 · OpenStreetMap</option>
        <option value="google">Google · 과금 가능</option>
      </select>
    </label>
  )
}
export default function PlaceSearchResults({
  search,
  onSelect,
  selectedId,
}: {
  search: ReturnType<typeof usePlaceSearch>
  onSelect: (place: SearchPlace) => void
  selectedId?: string
}) {
  return (
    <div
      className="google-place-results"
      aria-live="polite"
      aria-busy={search.loading}
    >
      {search.loading && <p role="status">장소 찾는 중…</p>}
      {search.error && (
        <p className="form-error" role="alert">
          {search.error}
        </p>
      )}
      {search.searched && !search.results.length && (
        <p role="status">
          검색 결과가 없습니다. 영문·현지명 또는 주소로 찾아보세요.
        </p>
      )}
      {!!search.results.length && (
        <>
          <div
            className="place-find-results"
            aria-label={
              search.service === 'google'
                ? '구글 장소 검색 결과'
                : '무료 장소 검색 결과'
            }
          >
            {search.results.map((place) => (
              <div key={place.id}>
                <button
                  type="button"
                  aria-label={`${place.name} 선택`}
                  aria-pressed={selectedId === place.id}
                  onClick={() => onSelect(place)}
                >
                  <strong>
                    {place.name}
                    {selectedId === place.id && ' ✓'}
                  </strong>
                  {place.originalName && place.originalName !== place.name && (
                    <span className="local-place-name">
                      {place.originalName}
                    </span>
                  )}
                  <span>{place.address}</span>
                </button>
                {place.attributions.map((item, index) => (
                  <small className="place-provider" key={index}>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.provider}
                      </a>
                    ) : (
                      item.provider
                    )}
                  </small>
                ))}
              </div>
            ))}
          </div>
          {search.service === 'google' && (
            <div className="google-attribution">
              <img
                src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                alt="Powered by Google"
                width="120"
                height="14"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
