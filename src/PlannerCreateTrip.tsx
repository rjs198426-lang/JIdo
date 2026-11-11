import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { cities } from './catalog'
import { useDraftFields } from './form-draft'
import CompanionCount from './CompanionCount'
import { dateAt, dayCount, today } from './store'
import { tripSchema, MAX_TRAVELERS, type Trip } from './travel-model'
import { validTimeZone } from './destination-time'

export default function PlannerCreateTrip({
  initialName = '',
  initialCountry = '',
  onCreate,
}: {
  initialName?: string
  initialCountry?: string
  onCreate: (trip: Trip) => void
}) {
  const draft = useDraftFields('jido-draft:create:planner-v1', {
    name: initialName,
    country: initialCountry,
    start: today(),
    end: dateAt(today(), 3),
    title: '',
    travelers: 1,
    timeZone: '',
  })
  const [name, setName] = draft.field('name'),
    [country, setCountry] = draft.field('country'),
    [start, setStart] = draft.field('start'),
    [end, setEnd] = draft.field('end'),
    [title, setTitle] = draft.field('title'),
    [travelers, setTravelers] = draft.field('travelers'),
    [timeZone, setTimeZone] = draft.field('timeZone')
  const [error, setError] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (
      !Number.isInteger(travelers) ||
      travelers < 1 ||
      travelers > MAX_TRAVELERS
    )
      return setError('함께하는 인원을 확인해 주세요.')
    const length = dayCount(start, end)
    if (!Number.isInteger(length) || length < 1 || length > 90)
      return setError('여행 기간은 1일부터 90일까지 선택해 주세요.')
    if (timeZone && !validTimeZone(timeZone))
      return setError('현지 시간대를 목록에서 선택해 주세요.')
    const id = `personal-${crypto.randomUUID()}`
    const known = cities.find(
      (city) => city.name === name.trim() && city.country === country.trim(),
    )
    const zone = timeZone || known?.timeZone
    const parsed = tripSchema.safeParse({
      id: crypto.randomUUID(),
      cityId: id,
      title: title.trim() || `${name.trim()} 여행`,
      startDate: start,
      endDate: end,
      travelers,
      members: Array.from({ length: travelers }, (_, i) => ({
        id: crypto.randomUUID(),
        name: i ? `동행 ${i}` : '나',
      })),
      destinations: [
        {
          id,
          name: name.trim(),
          country: country.trim(),
          ...(zone ? { timeZone: zone } : {}),
        },
      ],
      dayDestinationIds: Array(length).fill(id),
      days: Array.from({ length }, () => []),
    })
    if (!parsed.success)
      return setError('도시·국가·여행 인원과 날짜를 확인해 주세요.')
    try {
      onCreate(parsed.data)
      draft.clear()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : '저장하지 못했어요. 다시 시도해 주세요.',
      )
    }
  }
  return (
    <form
      className="create-form planner-create"
      onSubmit={submit}
      onInvalidCapture={(e) => {
        const panel = (e.target as HTMLElement).closest('details')
        if (panel) panel.open = true
      }}
    >
      <p className="form-intro">
        도시와 날짜로 여행을 만들고, 항공·호텔·하루 일정을 차근차근 더해요.
      </p>
      <div className="form-row">
        <label className="field">
          여행 도시
          <input
            required
            maxLength={80}
            list="planner-cities"
            value={name}
            placeholder="예: 괌, 파리"
            onChange={(e) => {
              setName(e.target.value)
              const city = cities.find((c) => c.name === e.target.value)
              if (city) {
                setCountry(city.country)
                setTimeZone(city.timeZone || '')
              } else setTimeZone('')
            }}
          />
        </label>
        <label className="field">
          국가
          <input
            required
            maxLength={80}
            value={country}
            placeholder="예: 미국령 괌"
            onChange={(e) => {
              setCountry(e.target.value)
              setTimeZone('')
            }}
          />
        </label>
      </div>
      <datalist id="planner-cities">
        {cities.map((city) => (
          <option key={city.id} value={city.name}>
            {city.country}
          </option>
        ))}
      </datalist>
      <div className="form-row">
        <label className="field">
          출발일
          <input
            required
            type="date"
            value={start}
            onChange={(e) => {
              const next = e.target.value
              const old = dayCount(start, end)
              setStart(next)
              if (next && (!end || end < next))
                setEnd(
                  dateAt(
                    next,
                    Number.isFinite(old) && old > 0 && old <= 90 ? old - 1 : 3,
                  ),
                )
              setError('')
            }}
          />
        </label>
        <label className="field">
          마지막 날
          <input
            required
            type="date"
            min={start || undefined}
            value={end}
            onChange={(e) => {
              setEnd(e.target.value)
              setError('')
            }}
          />
        </label>
      </div>
      <details className="simple-options create-options">
        <summary>
          여행 이름·동행·현지 시간 <span>선택</span>
        </summary>
        <label className="field">
          여행 이름
          <input
            maxLength={50}
            value={title}
            placeholder={`${name || '나의'} 여행`}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <CompanionCount travelers={travelers} onChange={setTravelers} />
        <label className="field">
          현지 시간대
          <input
            list="planner-timezones"
            maxLength={80}
            value={timeZone}
            placeholder="예: Pacific/Guam"
            onChange={(e) => setTimeZone(e.target.value)}
          />
        </label>
        <datalist id="planner-timezones">
          {[
            'Asia/Seoul',
            'Asia/Tokyo',
            'Asia/Taipei',
            'Asia/Bangkok',
            'Asia/Singapore',
            'Asia/Manila',
            'Pacific/Guam',
            'Pacific/Saipan',
            'Europe/Paris',
            'Europe/London',
            'America/New_York',
            'America/Los_Angeles',
            'Pacific/Honolulu',
            'Australia/Sydney',
          ].map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </datalist>
        <p className="muted">
          여행지의 날짜와 이동시간 계산에 사용해요. 여행의 도시 관리에서도
          변경할 수 있어요.
        </p>
      </details>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="button primary full">
        내 여행 만들기
        <ArrowRight size={18} />
      </button>
    </form>
  )
}
