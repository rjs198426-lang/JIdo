import { useState } from 'react'
import {
  Plus,
  Search,
  Plane,
  BedDouble,
  Wallet,
  Paperclip,
  ListPlus,
} from 'lucide-react'
import { useDraftFields } from './form-draft'
import { dateAt, formatDate } from './store'
import {
  destinationForDay,
  stopDetails,
  type Trip,
  type Reservation,
} from './travel-model'
import { parsePlanText, type PlanLine } from './plan-paste'

export default function QuickPlan({
  trip,
  day,
  onSave,
  onAction,
}: {
  trip: Trip
  day: number
  onSave: (day: number, lines: PlanLine[]) => boolean
  onAction: (
    action: 'place' | 'expense' | 'files' | Reservation['kind'],
    day: number,
  ) => void
}) {
  const [target, setTarget] = useState(Math.min(day, trip.days.length - 1))
  const draft = useDraftFields(`jido-draft:quick-plan:${trip.id}`, { text: '' })
  const [text, setText] = draft.field('text')
  const [unchecked, setUnchecked] = useState<number[]>([]),
    [error, setError] = useState('')
  const validDay = Math.min(target, trip.days.length - 1)
  const lines = parsePlanText(
    text,
    trip.days[validDay].map((stop) => stopDetails(stop).name),
  )
  const chosen = lines.filter(
    (line) => !line.error && !unchecked.includes(line.line) && !line.duplicate,
  )
  return (
    <div className="modal-body quick-plan">
      <p className="sheet-intro">
        {trip.title} <span>· 원하는 날짜에 바로 추가해요</span>
      </p>
      <label className="field">
        추가할 날짜
        <select
          aria-label="빠른 추가 날짜"
          value={validDay}
          onChange={(e) => {
            setTarget(Number(e.target.value))
            setError('')
          }}
        >
          {trip.days.map((_, i) => (
            <option key={i} value={i}>
              {formatDate(dateAt(trip.startDate, i), true)} ·{' '}
              {destinationForDay(trip, i).name}
            </option>
          ))}
        </select>
      </label>
      <div className="quick-action-grid" aria-label="빠른 추가 종류">
        <button onClick={() => onAction('place', validDay)}>
          <Search size={21} />
          <span>장소 찾기</span>
        </button>
        <button onClick={() => onAction('항공', validDay)}>
          <Plane size={21} />
          <span>항공 예약</span>
        </button>
        <button onClick={() => onAction('숙소', validDay)}>
          <BedDouble size={21} />
          <span>숙소 예약</span>
        </button>
        <button onClick={() => onAction('expense', validDay)}>
          <Wallet size={21} />
          <span>지출 기록</span>
        </button>
        <button onClick={() => onAction('files', validDay)}>
          <Paperclip size={21} />
          <span>자료 첨부</span>
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          if (lines.length > 50)
            return setError('한 번에 50개까지 담을 수 있어요.')
          if (onSave(validDay, chosen)) draft.clear()
        }}
      >
        <h3>
          <ListPlus size={21} /> 일정 모아 넣기
        </h3>
        <label className="field">
          가고 싶은 곳을 한 줄에 하나씩
          <textarea
            aria-label="일정 여러 개 붙여넣기"
            rows={5}
            maxLength={15000}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setUnchecked([])
              setError('')
            }}
            placeholder={
              '투몬 비치\n맛집: 저녁 식사 후보\n카페: 쉬어 갈 카페 | 테라스 자리 확인'
            }
          />
        </label>
        <p className="muted">
          메모해 둔 목록을 그대로 붙여넣어도 돼요. 시간은 나중에 정해요.
        </p>
        {lines.length > 0 && (
          <div className="paste-preview" aria-label="추가할 일정 미리보기">
            {lines.slice(0, 50).map((line) => (
              <label key={line.line}>
                <input
                  type="checkbox"
                  checked={chosen.includes(line)}
                  disabled={!!line.error || line.duplicate}
                  onChange={(e) =>
                    setUnchecked((items) =>
                      e.target.checked
                        ? items.filter((i) => i !== line.line)
                        : [...items, line.line],
                    )
                  }
                />
                <span>
                  <strong>{line.name}</strong>
                  <small>
                    {line.error ||
                      (line.duplicate
                        ? '이미 있는 이름 · 이번 추가에서 제외'
                        : `${line.kind} · ${line.time || '시간 미정'}${line.note ? ` · ${line.note}` : ''}`)}
                  </small>
                </span>
              </label>
            ))}
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {lines.length > 50 && (
          <p className="form-error" role="alert">
            한 번에 50개까지 담을 수 있어요. 나누어 추가해 주세요.
          </p>
        )}
        <button
          type="submit"
          className="button primary full"
          disabled={!chosen.length || lines.length > 50}
        >
          <Plus size={18} />
          {chosen.length
            ? `${chosen.length}개 일정 한 번에 추가`
            : '일정 한 번에 추가'}
        </button>
      </form>
    </div>
  )
}
