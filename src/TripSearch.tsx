import { useEffect, useRef, useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { searchTrip, tripSearchCategories } from './trip-search'
import type { Trip } from './travel-model'
import type { JourneyTarget } from './trip-readiness'
export default function TripSearch({
  trip,
  onLocate,
  onClose,
}: {
  trip: Trip
  onLocate: (target: JourneyTarget) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState('전체'),
    [limit, setLimit] = useState(30)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      element = dialog.current
    element?.showModal()
    return () => {
      element?.close()
      previous?.focus()
    }
  }, [])
  const results = searchTrip(trip, query, category)
  return (
    <dialog
      ref={dialog}
      className="trip-search-dialog"
      aria-label="여행 내 찾기"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="travel-dialog-heading">
        <h3>여행 내 찾기</h3>
        <button
          className="icon-button"
          aria-label="여행 검색 닫기"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <label className="field">
        찾을 내용
        <input
          autoFocus
          maxLength={200}
          type="search"
          placeholder="장소·예약 번호·메모·파일 이름"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setLimit(30)
          }}
        />
      </label>
      <div
        className="journey-filter-row"
        role="group"
        aria-label="여행 검색 분류"
      >
        {tripSearchCategories.map((name) => (
          <button
            key={name}
            className="button outline small"
            aria-pressed={category === name}
            onClick={() => {
              setCategory(name)
              setLimit(30)
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <p className="trip-search-count" role="status">
        {query.trim() ? `${results.length}건` : '이 여행의 기록을 검색하세요.'}
      </p>
      <div className="trip-search-results">
        {results.slice(0, limit).map((item) => (
          <button
            key={item.key}
            onClick={() => {
              onClose()
              onLocate(item.target)
            }}
          >
            <span>
              <small>{item.category}</small>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
      {query.trim() && !results.length && <p>일치하는 기록이 없어요.</p>}
      {results.length > limit && (
        <button
          className="button outline full"
          onClick={() => setLimit(limit + 30)}
        >
          결과 더 보기
        </button>
      )}
    </dialog>
  )
}
