import { reservationConflicts } from './reservation-conflicts'
import { useDraftFields } from './form-draft'
import { useState, type FormEvent } from 'react'
import { dayCount, type Trip } from './store'
import { destinationForDay } from './travel-model'

export default function TripEditor({
  trip,
  onSave,
}: {
  trip: Trip
  onSave: (trip: Trip) => void
}) {
  const draft = useDraftFields(`jido-draft:trip:${trip.id}`, {
    title: trip.title,
    start: trip.startDate,
    end: trip.endDate,
    travelers: trip.travelers,
  })
  const [title, setTitle] = draft.field('title')
  const [start, setStart] = draft.field('start')
  const [end, setEnd] = draft.field('end')
  const [travelers, setTravelers] = draft.field('travelers')
  const [error, setError] = useState('')
  const count = dayCount(start, end)
  const blockedDays =
    Number.isFinite(count) && count > 0
      ? trip.days.flatMap((stops, index) =>
          index >= count && stops.length ? [`DAY ${index + 1}`] : [],
        )
      : []
  const conflicts =
    Number.isFinite(count) && count > 0 && count <= 90
      ? reservationConflicts({
          ...trip,
          startDate: start,
          endDate: end,
          days: Array.from({ length: count }, (_, i) => trip.days[i] || []),
        })
      : []
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return setError('여행 이름을 입력해 주세요.')
    if (!Number.isFinite(count) || count < 1)
      return setError('마지막 날은 출발일과 같거나 이후여야 해요.')
    if (count > 90) return setError('한 여행은 최대 90일까지 만들 수 있어요.')
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
    draft.clear()
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
      {!!conflicts.length && (
        <aside className="reservation-conflicts" role="alert">
          <strong>예약 날짜와 일정이 달라집니다</strong>
          <ul>
            {conflicts.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
          <p>예약 원본 날짜는 유지됩니다. 저장 후 예약을 확인하세요.</p>
        </aside>
      )}
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
