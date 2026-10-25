import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Trip } from './travel-model'
import { dateAt, formatDate } from './store'
export default function DayNavigation({
  trip,
  day,
  onDay,
}: {
  trip: Trip
  day: number
  onDay: (day: number) => void
}) {
  const tabs = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const selected = tabs.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    )
    if (selected && tabs.current)
      tabs.current.scrollTo({
        left:
          selected.offsetLeft -
          (tabs.current.clientWidth - selected.offsetWidth) / 2,
        behavior: 'instant',
      })
  }, [day, trip.id])
  return (
    <>
      <label className="day-jump">
        날짜{' '}
        <select
          aria-label="일정 날짜 바로 이동"
          value={day}
          onChange={(e) => onDay(Number(e.target.value))}
        >
          {trip.days.map((_, i) => (
            <option key={i} value={i}>
              {formatDate(dateAt(trip.startDate, i), true)}
            </option>
          ))}
        </select>
      </label>
      <div className="day-navigation">
        <button
          className="icon-button"
          aria-label="이전 여행일"
          disabled={day === 0}
          onClick={() => onDay(day - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <div
          className="day-tabs"
          role="tablist"
          aria-label="여행 날짜"
          ref={tabs}
        >
          {trip.days.map((_, i) => (
            <button
              role="tab"
              aria-label={`DAY ${i + 1} · ${formatDate(dateAt(trip.startDate, i), true)}`}
              aria-selected={i === day}
              aria-controls="day-panel"
              id={`day-tab-${i}`}
              className={`day-tab ${i === day ? 'active' : ''}`}
              key={i}
              tabIndex={i === day ? 0 : -1}
              onClick={() => onDay(i)}
              onKeyDown={(e) => {
                const next =
                  e.key === 'ArrowRight'
                    ? Math.min(trip.days.length - 1, i + 1)
                    : e.key === 'ArrowLeft'
                      ? Math.max(0, i - 1)
                      : e.key === 'Home'
                        ? 0
                        : e.key === 'End'
                          ? trip.days.length - 1
                          : undefined
                if (next !== undefined) {
                  e.preventDefault()
                  onDay(next)
                  tabs.current
                    ?.querySelector<HTMLButtonElement>(`#day-tab-${next}`)
                    ?.focus({ preventScroll: true })
                }
              }}
            >
              <span>{formatDate(dateAt(trip.startDate, i), true)}</span>
            </button>
          ))}
        </div>
        <button
          className="icon-button"
          aria-label="다음 여행일"
          disabled={day === trip.days.length - 1}
          onClick={() => onDay(day + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </>
  )
}
