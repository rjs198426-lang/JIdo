import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { tripReadiness, type JourneyTarget } from './trip-readiness'
import type { Trip } from './travel-model'
export default function TripReadiness({
  trip,
  onLocate,
}: {
  trip: Trip
  onLocate: (target: JourneyTarget) => void
}) {
  const [category, setCategory] = useState('전체'),
    [expanded, setExpanded] = useState(false)
  const issues = tripReadiness(trip),
    filtered = issues.filter(
      (item) => category === '전체' || item.category === category,
    )
  const hasRecords =
    trip.days.some((stops) => stops.length) ||
    !!trip.reservations?.length ||
    !!trip.checklist?.length
  return (
    <section className="trip-readiness" aria-label="여행 점검">
      <div className="tool-heading">
        <h4>여행 점검</h4>
        <span>
          {issues.length
            ? `${issues.length}건 확인`
            : hasRecords
              ? '등록한 기록에서 발견한 문제 없음'
              : '아직 점검할 기록이 없어요'}
        </span>
      </div>
      <p className="readiness-scope">
        등록한 일정·예약·준비물만 점검해요. 입국 조건과 실제 예약 상태는 별도로
        확인해 주세요.
      </p>
      {!hasRecords && (
        <div className="readiness-list">
          {[
            ['가고 싶은 장소 담기', 'schedule'],
            ['예약한 항공·숙소 기록하기', 'reservations'],
            ['여권·통신 등 준비물 확인하기', 'checklist'],
          ].map(([label, workspace]) => (
            <button key={workspace} onClick={() => onLocate({ workspace })}>
              <span>{label}</span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      )}
      {issues.length > 0 && (
        <>
          <div
            className="readiness-filters"
            role="group"
            aria-label="점검 분류"
          >
            {['전체', '일정', '예약', '준비물'].map((name) => (
              <button
                className="button outline small"
                key={name}
                aria-pressed={category === name}
                onClick={() => {
                  setCategory(name)
                  setExpanded(false)
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="readiness-list">
            {filtered.slice(0, expanded ? filtered.length : 4).map((item) => (
              <button
                key={item.id}
                className={item.urgent ? 'readiness-urgent' : ''}
                onClick={() => onLocate(item.target)}
              >
                <span>
                  <small>{item.category}</small>
                  {item.text}
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
          {!filtered.length && <p>이 분류에 확인할 항목이 없어요.</p>}
          {filtered.length > 4 && (
            <button
              className="button outline small full"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '접기' : `전체 ${filtered.length}건 보기`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
