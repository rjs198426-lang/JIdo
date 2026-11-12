import { useEffect, useState } from 'react'
import { Bookmark, Plus, Pencil, Trash2, Search, Check } from 'lucide-react'
import type { Trip } from './travel-model'
import { destinationForDay } from './travel-model'
import { dateAt, formatDate } from './store'
import {
  sameDestination,
  matchesRegisteredPlace,
  stopMatchesCustom,
  type RegisteredPlace,
} from './registered-places'

export default function SavedPlaces({
  trip,
  day,
  entries,
  onCreate,
  onEdit,
  onDelete,
  onAdd,
  onDone,
}: {
  trip: Trip
  day: number
  entries: RegisteredPlace[]
  onCreate: (day: number, query: string) => void
  onEdit: (entry: RegisteredPlace, day: number) => void
  onDelete: (entry: RegisteredPlace, day: number) => void
  onAdd: (entry: RegisteredPlace, day: number) => void
  onDone: (day: number) => void
}) {
  const [selected, setSelected] = useState(Math.min(day, trip.days.length - 1))
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(30)
  const [reusedOpen, setReusedOpen] = useState(false)
  const target = Math.min(selected, trip.days.length - 1)
  const destination = destinationForDay(trip, target)
  const candidates = entries.filter(
    (entry) =>
      sameDestination(entry.destination, destination) &&
      matchesRegisteredPlace(entry, query),
  )
  const own = candidates.filter((entry) => entry.personalId).reverse()
  const reused = candidates.filter((entry) => !entry.personalId)
  useEffect(() => setLimit(30), [query, target])
  const row = (entry: RegisteredPlace) => {
    const added = trip.days[target].some((stop) =>
      stopMatchesCustom(stop, entry.custom),
    )
    return (
      <article className="saved-place-row" key={entry.key}>
        <div>
          <small>
            {entry.custom.kind} · {entry.destination.name}
          </small>
          <h3>{entry.custom.name}</h3>
          {entry.description && <p>{entry.description}</p>}
        </div>
        <div className="saved-place-actions">
          <button
            className="button outline small"
            disabled={added}
            onClick={() => onAdd(entry, target)}
            aria-label={`${entry.custom.name} ${added ? '추가됨' : '선택한 날짜에 추가'}`}
          >
            {added ? <Check size={16} /> : <Plus size={16} />}
            {added ? '추가됨' : '일정에 넣기'}
          </button>
          <button
            className="icon-button"
            aria-label={`${entry.custom.name} 보관 정보 수정`}
            onClick={() => onEdit(entry, target)}
          >
            <Pencil size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={`${entry.custom.name} 보관함에서 삭제`}
            onClick={() => onDelete(entry, target)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </article>
    )
  }
  return (
    <div className="modal-body saved-places">
      <p className="muted">
        방문할 날짜를 정하기 전에도 가고 싶은 곳을 모아두세요. 넣을 때만 일정에
        추가돼요.
      </p>
      <label className="input-search">
        <Search size={18} />
        <input
          aria-label="보관한 장소 검색"
          placeholder="장소·메모 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <button
        className="button primary full"
        onClick={() => onCreate(target, query.trim())}
      >
        <Bookmark size={18} />
        장소 보관하기
      </button>
      <label className="field">
        일정에 넣을 날짜
        <select
          aria-label="보관한 장소를 넣을 날짜"
          value={target}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {trip.days.map((_, i) => (
            <option value={i} key={i}>
              {formatDate(dateAt(trip.startDate, i), true)} ·{' '}
              {destinationForDay(trip, i).name}
            </option>
          ))}
        </select>
      </label>
      <h3>
        {destination.name} 보관함 <span>{own.length}</span>
      </h3>
      {own.length ? (
        own.slice(0, limit).map(row)
      ) : (
        <p className="workspace-empty">
          {query
            ? '찾는 장소가 없어요. 새로 보관해 보세요.'
            : '아직 보관한 장소가 없어요. 이름만 적어도 저장할 수 있어요.'}
        </p>
      )}
      {own.length > limit && (
        <button
          className="button outline full"
          onClick={() => setLimit((value) => value + 30)}
        >
          보관한 장소 더 보기 · {own.length - limit}곳
        </button>
      )}
      {reused.length > 0 && (
        <details
          className="simple-options"
          onToggle={(event) => setReusedOpen(event.currentTarget.open)}
        >
          <summary>이전 일정의 장소 다시 쓰기 · {reused.length}</summary>
          {reusedOpen && (
            <>
              {reused.slice(0, limit).map(row)}
              {reused.length > limit && (
                <button
                  className="button outline full"
                  onClick={() => setLimit((value) => value + 30)}
                >
                  이전 장소 더 보기 · {reused.length - limit}곳
                </button>
              )}
            </>
          )}
        </details>
      )}
      <button
        className="button outline full saved-places-done"
        onClick={() => onDone(target)}
      >
        선택한 날짜의 일정 보기
      </button>
    </div>
  )
}
