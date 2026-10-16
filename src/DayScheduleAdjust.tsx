import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  canAdjustStop,
  previewTimeAdjustment,
  type TimeAdjustment,
} from './schedule-adjust'
import { stopDetails, type Trip } from './travel-model'
import { dateAt, formatDate } from './store'
import { timeConflicts } from './journey-progress'
import { applyTimeAdjustment } from './schedule-adjust'
export default function DayScheduleAdjust({
  trip,
  day,
  onApply,
  onClose,
}: {
  trip: Trip
  day: number
  onApply: (value: TimeAdjustment) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [minutes, setMinutes] = useState('30'),
    [ids, setIds] = useState(() =>
      trip.days[day]
        .filter((stop) => canAdjustStop(trip, stop))
        .map((stop) => stop.id),
    ),
    [error, setError] = useState('')
  useEffect(() => {
    const element = dialog.current,
      previous = document.activeElement as HTMLElement | null
    element?.showModal()
    return () => {
      element?.close()
      previous?.focus()
    }
  }, [])
  let preview: TimeAdjustment | undefined,
    problem = ''
  try {
    preview = previewTimeAdjustment(trip, day, Number(minutes), ids)
  } catch (reason) {
    problem = (reason as Error).message
  }
  const conflicts = preview
    ? timeConflicts(applyTimeAdjustment(trip, preview), day)
    : []
  return (
    <dialog
      ref={dialog}
      className="day-adjust-dialog"
      aria-label="일정 시간 일괄 변경"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div className="travel-dialog-heading">
        <h3>일정 시간 변경</h3>
        <button
          className="icon-button"
          aria-label="시간 변경 닫기"
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </div>
      <p>
        DAY {day + 1} · {formatDate(dateAt(trip.startDate, day))}
      </p>
      <label className="field">
        변경할 시간 · 분
        <input
          type="number"
          inputMode="text"
          min={-720}
          max={720}
          step={1}
          value={minutes}
          onChange={(event) => {
            setMinutes(event.target.value)
            setError('')
          }}
        />
      </label>
      <div className="journey-filter-row">
        {[-30, 15, 30, 60].map((value) => (
          <button
            className="button outline small"
            key={value}
            onClick={() => setMinutes(String(value))}
          >
            {value > 0 ? '+' : ''}
            {value}분
          </button>
        ))}
      </div>
      <div className="adjust-stop-list">
        {trip.days[day].map((stop) => {
          const eligible = canAdjustStop(trip, stop),
            change = preview?.changes.find((item) => item.id === stop.id)
          return (
            <label key={stop.id}>
              <input
                type="checkbox"
                aria-label={`${stopDetails(stop).name} 시간 변경 선택`}
                disabled={!eligible}
                checked={ids.includes(stop.id)}
                onChange={(event) =>
                  setIds(
                    event.target.checked
                      ? [...ids, stop.id]
                      : ids.filter((id) => id !== stop.id),
                  )
                }
              />
              <span>
                <strong>{stopDetails(stop).name}</strong>
                <small>
                  {stop.time}
                  {change ? ` → ${change.after}` : ''}
                  {!eligible
                    ? stop.reservationId
                      ? ' · 예약 연결'
                      : ' · 완료·건너뜀'
                    : ''}
                </small>
              </span>
            </label>
          )
        })}
      </div>
      {!!conflicts.length && (
        <p className="transfer-warning" role="status">
          변경 후 체류시간이 겹치는 일정 {conflicts.length}건
        </p>
      )}
      {(problem || error) && (
        <p className="form-error" role="alert">
          {error || problem}
        </p>
      )}
      <div className="travel-dialog-actions">
        <button className="button outline" onClick={onClose}>
          취소
        </button>
        <button
          className="button primary"
          disabled={!preview}
          onClick={() => {
            if (!preview) return
            try {
              onApply(preview)
              onClose()
            } catch (reason) {
              setError((reason as Error).message)
            }
          }}
        >
          {ids.length}곳 변경 적용
        </button>
      </div>
    </dialog>
  )
}
