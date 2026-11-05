import { Pencil, Plus, Trash2 } from 'lucide-react'
import PlacePhoto from './PlacePhoto'
import type { RegisteredPlace } from './registered-places'
export default function PersonalPlaceCard({
  entry,
  onOpen,
  onAdd,
  onEdit,
  onDelete,
}: {
  entry: RegisteredPlace
  onOpen: () => void
  onAdd: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const stop = { id: '', placeId: '', time: '', note: '', custom: entry.custom }
  return (
    <article
      className="place-card personal-place-card"
      aria-label={`${entry.custom.name} ${entry.custom.kind}`}
    >
      <div className="place-photo">
        <button
          className="photo-button"
          onClick={onOpen}
          aria-label={`${entry.custom.name} 자세히 보기`}
        >
          <PlacePhoto stop={stop} alt={entry.custom.name} />
        </button>
      </div>
      <button type="button" className="place-card-copy" onClick={onOpen}>
        <span className="place-location">
          {entry.destination.name} · {entry.custom.kind}
        </span>
        <strong>{entry.custom.name}</strong>
        <span className="place-description">
          {entry.description || `내가 추가한 ${entry.custom.kind}`}
        </span>
        {entry.custom.address && (
          <span className="place-meta">{entry.custom.address}</span>
        )}
      </button>
      <button
        type="button"
        className="icon-button place-card-add"
        onClick={onAdd}
        aria-label={`${entry.custom.name} 일정에 추가`}
      >
        <Plus size={20} />
      </button>
      {onEdit && (
        <div className="place-library-card-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onEdit}
            aria-label={`${entry.custom.name} 장소 편집`}
          >
            <Pencil size={20} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={onDelete}
            aria-label={`${entry.custom.name} 목록에서 삭제`}
          >
            <Trash2 size={20} />
          </button>
        </div>
      )}
    </article>
  )
}
