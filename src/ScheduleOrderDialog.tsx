import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, X } from 'lucide-react'
import { stopDetails, type Trip } from './travel-model'
import type { ScheduleOrder } from './schedule-list'
export default function ScheduleOrderDialog({
  trip,
  day,
  onApply,
  onClose,
}: {
  trip: Trip
  day: number
  onApply: (change: ScheduleOrder) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [before] = useState(() => trip.days[day].map((stop) => stop.id))
  const [ids, setIds] = useState(before)
  const [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement as HTMLElement | null
    element?.showModal()
    return () => {
      element?.close()
      previous?.focus()
    }
  }, [])
  function move(index: number, target: number) {
    if (target < 0 || target >= ids.length) return
    setIds((items) => {
      const next = [...items]
      const [id] = next.splice(index, 1)
      next.splice(target, 0, id)
      return next
    })
  }
  return (
    <dialog
      ref={dialog}
      className="day-adjust-dialog schedule-order-dialog"
      aria-label="방문 순서 편집"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="travel-dialog-heading">
        <h3>방문 순서 편집</h3>
        <button
          className="icon-button"
          aria-label="순서 편집 닫기"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <p>DAY {day + 1} · 방문 시각은 그대로 유지됩니다.</p>
      <ol className="schedule-order-list">
        {ids.map((id, index) => {
          const stop = trip.days[day].find((item) => item.id === id)
          if (!stop) return <li key={id}>삭제된 일정</li>
          const name = stopDetails(stop).name
          return (
            <li key={id}>
              <div>
                <small>
                  {stop.time}
                  {stop.reservationId ? ' · 예약 연결' : ''}
                </small>
                <strong>{name}</strong>
              </div>
              <label>
                <select
                  aria-label={`${name} 방문 순번`}
                  value={index}
                  onChange={(event) => move(index, Number(event.target.value))}
                >
                  {ids.map((_, n) => (
                    <option value={n} key={n}>
                      {n + 1}번
                    </option>
                  ))}
                </select>
              </label>
              <div className="schedule-order-arrows">
                <button
                  className="icon-button"
                  aria-label={`${name} 순서 앞으로`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`${name} 순서 뒤로`}
                  disabled={index === ids.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={18} />
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="travel-dialog-actions">
        <button className="button outline" onClick={onClose}>
          취소
        </button>
        <button
          className="button primary"
          disabled={JSON.stringify(ids) === JSON.stringify(before)}
          onClick={() => {
            try {
              onApply({ day, before, after: ids })
              onClose()
            } catch (reason) {
              setError((reason as Error).message)
            }
          }}
        >
          순서 적용
        </button>
      </div>
    </dialog>
  )
}
