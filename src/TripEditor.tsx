import { useState, type FormEvent } from 'react'
import { CalendarDays } from 'lucide-react'
import { dayCount, type Trip } from './store'
import { destinationForDay } from './travel-model'

export default function TripEditor({
  trip,
  onSave,
}: {
  trip: Trip
  onSave: (trip: Trip) => void
}) {
  const [title, setTitle] = useState(trip.title)
  const [start, setStart] = useState(trip.startDate)
  const [end, setEnd] = useState(trip.endDate)
  const [travelers, setTravelers] = useState(trip.travelers)
  const [error, setError] = useState('')
  const count = dayCount(start, end)
  const blockedDays =
    Number.isFinite(count) && count > 0
      ? trip.days.flatMap((stops, index) =>
          index >= count && stops.length ? [`DAY ${index + 1}`] : [],
        )
      : []
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError('여행 이름을 입력해 주세요.')
    if (!Number.isFinite(count) || count < 1)
      return setError('마지막 날은 출발일과 같거나 이후여야 해요.')
    if (count > 21) return setError('한 여행은 최대 21일까지 만들 수 있어요.')
    if (travelers < (trip.members?.length || 0))
      return setError(
        '등록한 동행인 수보다 인원을 줄일 수 없어요. 먼저 동행인을 편집하세요.',
      )
    if (blockedDays.length)
      return setError(
        `${blockedDays.join(', ')}에 일정이 있어요. 장소를 다른 날로 옮긴 뒤 기간을 줄여 주세요.`,
      )
    const members = [...(trip.members || [])]
    while (members.length < travelers) {
      const base = members.length === 0 ? '나' : `동행 ${members.length}`
      let name = base,
        suffix = 2
      while (members.some((member) => member.name === name))
        name = `${base} (${suffix++})`
      members.push({ id: crypto.randomUUID(), name })
    }
    onSave({
      ...trip,
      title: title.trim(),
      startDate: start,
      endDate: end,
      travelers,
      members,
      days: Array.from({ length: count }, (_, index) => trip.days[index] || []),
      dayDestinationIds: Array.from(
        { length: count },
        (_, index) =>
          destinationForDay(trip, Math.min(index, trip.days.length - 1)).id,
      ),
    })
  }
  return (
    <form className="create-form" onSubmit={submit}>
      <div className="form-intro">
        <span className="small-icon">
          <CalendarDays size={24} />
        </span>
        <div>
          <h3>계획이 바뀌어도 괜찮아요</h3>
          <p>여행 이름, 날짜와 인원을 수정하세요.</p>
        </div>
      </div>
      <label className="field">
        여행 이름
        <input
          required
          maxLength={50}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="form-row">
        <label className="field">
          출발일
          <input
            required
            type="date"
            value={start}
            onChange={(event) => {
              setStart(event.target.value)
              setError('')
            }}
          />
        </label>
        <label className="field">
          마지막 날
          <input
            required
            type="date"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value)
              setError('')
            }}
          />
        </label>
      </div>
      <label className="field">
        함께하는 인원
        <select
          value={travelers}
          onChange={(event) => setTravelers(Number(event.target.value))}
        >
          {Array.from({ length: 10 }, (_, index) => (
            <option key={index} value={index + 1}>
              {index + 1}명
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" type="submit">
        변경사항 저장
      </button>
    </form>
  )
}
