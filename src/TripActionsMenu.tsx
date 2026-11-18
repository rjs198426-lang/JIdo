import { useEffect, useRef, type ReactNode } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

export default function TripActionsMenu({
  onEdit,
  onDelete,
  children,
}: {
  onEdit: () => void
  onDelete: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ref.current?.open) {
        ref.current.open = false
        ref.current.querySelector('summary')?.focus()
        event.stopPropagation()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [])
  return (
    <details className="trip-actions-menu" ref={ref}>
      <summary aria-label="여행 더보기">
        <MoreHorizontal size={21} />
      </summary>
      <div
        className="trip-menu-items"
        onClickCapture={(event) => {
          if ((event.target as Element).closest('button') && ref.current) {
            ref.current.open = false
            ref.current.querySelector('summary')?.focus()
          }
        }}
      >
        <button className="text-button" onClick={onEdit}>
          <Pencil size={17} />
          여행 정보 수정
        </button>
        {children}
        <button className="text-button danger-action" onClick={onDelete}>
          <Trash2 size={17} />
          여행 삭제
        </button>
      </div>
    </details>
  )
}
