import { Search, ArrowRight } from 'lucide-react'
import { stopDetails, type Stop, type Trip } from './travel-model'
import {
  emptyScheduleFilter,
  scheduleSummary,
  type ScheduleFilter,
  type ScheduleStatus,
} from './schedule-list'
export default function ScheduleToolbar({
  trip,
  day,
  filter,
  onFilter,
  visible,
  onNext,
}: {
  trip: Trip
  day: number
  filter: ScheduleFilter
  onFilter: (filter: ScheduleFilter) => void
  visible: number
  onNext: (stop: Stop) => void
}) {
  const summary = scheduleSummary(trip, day)
  const stops = trip.days[day]
  const categories = [
    ...new Set(stops.map((stop) => stopDetails(stop).category)),
  ]
  const filtered =
    filter.query.trim() || filter.status !== 'all' || filter.category !== '전체'
  return (
    <section className="schedule-tools" aria-label="하루 일정 찾기">
      <div className="schedule-day-summary">
        <div>
          <strong>
            {summary.firstTime
              ? `${summary.firstTime} — ${summary.lastTime}`
              : '활성 일정 없음'}
          </strong>
          <span>
            예정 {summary.planned} · 완료 {summary.done} · 제외{' '}
            {summary.excluded}
          </span>
        </div>
        {summary.next && (
          <button
            className="schedule-next"
            onClick={() => onNext(summary.next!)}
            aria-label={`다음 예정 ${stopDetails(summary.next).name} 일정으로 이동`}
          >
            <small>다음 예정 · {summary.next.time}</small>
            <strong>{stopDetails(summary.next).name}</strong>
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="schedule-find">
        <label className="input-search">
          <Search size={17} />
          <input
            aria-label="이날 일정 검색"
            placeholder="장소·메모·예약·자료 검색"
            value={filter.query}
            onChange={(event) =>
              onFilter({ ...filter, query: event.target.value })
            }
          />
        </label>
        <select
          aria-label="일정 분류"
          value={filter.category}
          onChange={(event) =>
            onFilter({ ...filter, category: event.target.value })
          }
        >
          <option value="전체">모든 분류</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </div>
      <div
        className="schedule-status-filters"
        role="group"
        aria-label="일정 상태 필터"
      >
        {(
          [
            ['all', '전체', stops.length],
            ['planned', '예정', summary.planned],
            ['done', '완료', summary.done],
            ['excluded', '제외', summary.excluded],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            aria-pressed={filter.status === value}
            onClick={() =>
              onFilter({ ...filter, status: value as ScheduleStatus })
            }
          >
            {label} {count}
          </button>
        ))}
      </div>
      {!!filtered && (
        <div className="schedule-filter-result" role="status">
          <span>
            {visible}/{stops.length}개 일정
          </span>
          <button
            className="text-button"
            onClick={() => onFilter({ ...emptyScheduleFilter })}
          >
            필터 초기화
          </button>
        </div>
      )}
    </section>
  )
}
