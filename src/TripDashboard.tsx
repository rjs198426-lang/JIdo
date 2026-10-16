import { useDraftFields } from './form-draft'
import AttachmentsPanel from './AttachmentsPanel'
import { useState, type FormEvent } from 'react'
import {
  CalendarDays,
  CheckSquare,
  Ticket,
  Wallet,
  ArrowRight,
  Phone,
} from 'lucide-react'
import { convertedTotal, currencyTotals } from './finance'
import {
  destinationForDay,
  money,
  stopDetails,
  type Trip,
} from './travel-model'
import { today, dayCount, dateAt, formatDate } from './store'
import TravelMembers from './TravelMembers'

type Props = {
  trip: Trip
  day: number
  onUpdate: (trip: Trip) => void
  onOpen: (workspace: string, day?: number) => void
  onExpense: () => void
}
export default function TripDashboard({
  trip,
  day,
  onUpdate,
  onOpen,
  onExpense,
}: Props) {
  const date = today(),
    until = dayCount(date, trip.startDate) - 1
  const active =
    until > 0 ? '출발 전' : date > trip.endDate ? '여행 종료' : '여행 중'
  const checklist = trip.checklist || [],
    done = checklist.filter((item) => item.done).length,
    reservations = (trip.reservations || []).filter(
      (item) => item.status !== 'cancelled',
    ),
    confirmed = reservations.filter(
      (item) => item.status === 'confirmed',
    ).length
  const overdue = checklist.filter(
    (item) => !item.done && item.dueDate && item.dueDate < date,
  )
  const conversion = convertedTotal(trip)
  const planned = currencyTotals(
    reservations
      .filter(
        (item) =>
          item.cost &&
          item.currency &&
          !trip.expenses?.some((expense) => expense.reservationId === item.id),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        date: item.date,
        category: '기타',
        payer: '',
        amount: item.cost!,
        currency: item.currency!,
      })),
  )
  const todayIndex = Math.min(
    trip.days.length - 1,
    Math.max(0, dayCount(trip.startDate, date) - 1),
  )
  const selectedDate = dateAt(trip.startDate, day)
  const stops = trip.days[day],
    completed = stops.filter((stop) => stop.status === 'done').length
  const upcoming = stops.find(
    (stop) =>
      stop.status !== 'done' &&
      stop.status !== 'skipped' &&
      !trip.reservations?.some(
        (reservation) =>
          reservation.id === stop.reservationId &&
          reservation.status === 'cancelled',
      ),
  )
  const defaultInfo = trip.travelInfo || {
    emergencyPhone: '',
    insurancePhone: '',
    embassyContact: '',
    lodgingAddress: '',
    note: '',
  }
  const memoDraft = useDraftFields(
    `jido-draft:travel-info:${trip.id}`,
    { info: defaultInfo, infoOpen: false },
    {
      info: (value) =>
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 5 &&
        Object.keys(defaultInfo).every(
          (key) =>
            typeof (value as Record<string, unknown>)[key] === 'string' &&
            String((value as Record<string, unknown>)[key]).length <=
              (['emergencyPhone', 'insurancePhone'].includes(key) ? 80 : 500),
        ),
    },
    (value) =>
      value.infoOpen ||
      JSON.stringify(value.info) !== JSON.stringify(defaultInfo),
  )
  const [info, setInfo] = memoDraft.field('info'),
    [infoOpen, setInfoOpen] = memoDraft.field('infoOpen')
  const [message, setMessage] = useState('')
  function saveInfo(event: FormEvent) {
    event.preventDefault()
    onUpdate({ ...trip, travelInfo: info })
    setInfoOpen(false)
    setMessage('여행 메모를 저장했어요.')
  }
  const phoneHref = (phone: string) => {
    const clean = phone.replace(/[ ()-]/g, '')
    return /^\+?\d{3,20}$/.test(clean) ? `tel:${clean}` : undefined
  }
  return (
    <section className="workspace-panel trip-dashboard">
      <div className="tool-heading">
        <div>
          <h3>{active}</h3>
          <span className="trip-phase">
            {until > 0
              ? `D-${until}`
              : `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`}
          </span>
        </div>
        <button
          className="button primary small"
          onClick={() => onOpen('schedule', todayIndex)}
        >
          <CalendarDays size={16} />
          {active === '출발 전'
            ? '첫날 일정'
            : active === '여행 종료'
              ? '마지막 일정'
              : '오늘 일정'}
        </button>
      </div>
      <div className="dashboard-cards">
        <button onClick={() => onOpen('checklist')}>
          <CheckSquare size={20} />
          <span>여행 준비</span>
          <strong>
            {done}/{checklist.length}
          </strong>
          <small>
            {overdue.length
              ? `기한 지난 항목 ${overdue.length}개`
              : '준비물·할 일'}
          </small>
        </button>
        <button onClick={() => onOpen('reservations')}>
          <Ticket size={20} />
          <span>예약 확인</span>
          <strong>
            {confirmed}/{reservations.length}
          </strong>
          <small>{reservations.length - confirmed}건 확인 필요</small>
        </button>
        <button onClick={() => onOpen('expenses')}>
          <Wallet size={20} />
          <span>순지출</span>
          <strong>
            {conversion.missing.length
              ? '환율 입력 필요'
              : money(conversion.total, conversion.currency)}
          </strong>
          <small>
            {trip.totalBudget === undefined
              ? '전체 예산 설정'
              : `예산 ${money(trip.totalBudget, conversion.currency)}`}
          </small>
        </button>
      </div>
      <div className="dashboard-day">
        <div className="tool-heading">
          <h4>
            {formatDate(selectedDate)} · {destinationForDay(trip, day).name}
          </h4>
          <span>
            {completed}/{stops.length} 방문 완료
          </span>
        </div>
        {upcoming ? (
          <div className="next-stop">
            <div>
              <small>다음 일정 · {upcoming.time}</small>
              <strong>{stopDetails(upcoming).name}</strong>
            </div>
            <button
              className="button outline small"
              onClick={() => onOpen('schedule', day)}
            >
              일정 보기 <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <p>
            {stops.length
              ? '이날의 남은 일정이 없어요.'
              : '이날의 장소를 추가하세요.'}
          </p>
        )}
        <button className="text-button" onClick={onExpense}>
          지출 바로 기록
        </button>
      </div>
      {(overdue.length > 0 ||
        reservations.some((item) => item.status !== 'confirmed')) && (
        <div className="preparation-reminders">
          <h4>확인할 항목</h4>
          {overdue.slice(0, 3).map((item) => (
            <button key={item.id} onClick={() => onOpen('checklist')}>
              {item.title} · 기한 지남 <ArrowRight size={14} />
            </button>
          ))}
          {reservations
            .filter((item) => item.status !== 'confirmed')
            .slice(0, 3)
            .map((item) => (
              <button key={item.id} onClick={() => onOpen('reservations')}>
                {item.title} · 예약 확인 필요 <ArrowRight size={14} />
              </button>
            ))}
        </div>
      )}
      {!!planned.length && (
        <details className="planned-costs">
          <summary>아직 지출에 기록하지 않은 예약 비용</summary>
          {planned.map((item) => (
            <div className="stat-list" key={item.currency}>
              <div>
                <span>{item.currency}</span>
                <strong>{money(item.total, item.currency)}</strong>
              </div>
            </div>
          ))}
        </details>
      )}
      <AttachmentsPanel all />
      <TravelMembers trip={trip} onUpdate={onUpdate} />
      <div className="travel-info">
        <div className="tool-heading">
          <h4>여행 연락처·메모</h4>
          <button
            className="button outline small"
            onClick={() => setInfoOpen(!infoOpen)}
            aria-expanded={infoOpen}
          >
            {infoOpen ? '접기' : trip.travelInfo ? '편집' : '추가'}
          </button>
        </div>
        {infoOpen ? (
          <form className="inline-form" onSubmit={saveInfo}>
            <div className="form-row">
              <label className="field">
                긴급 연락처
                <input
                  maxLength={80}
                  type="tel"
                  value={info.emergencyPhone}
                  onChange={(event) =>
                    setInfo({ ...info, emergencyPhone: event.target.value })
                  }
                />
              </label>
              <label className="field">
                보험사 연락처
                <input
                  maxLength={80}
                  type="tel"
                  value={info.insurancePhone}
                  onChange={(event) =>
                    setInfo({ ...info, insurancePhone: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              대사관·영사관 연락처
              <input
                maxLength={500}
                value={info.embassyContact}
                onChange={(event) =>
                  setInfo({ ...info, embassyContact: event.target.value })
                }
              />
            </label>
            <label className="field">
              숙소 주소
              <input
                maxLength={500}
                value={info.lodgingAddress}
                onChange={(event) =>
                  setInfo({ ...info, lodgingAddress: event.target.value })
                }
              />
            </label>
            <label className="field">
              여행 메모
              <textarea
                maxLength={2000}
                value={info.note}
                onChange={(event) =>
                  setInfo({ ...info, note: event.target.value })
                }
              />
            </label>
            <button className="button primary" type="submit">
              연락처·메모 저장
            </button>
          </form>
        ) : (
          <div className="travel-info-list">
            {(
              [
                ['긴급 연락처', trip.travelInfo?.emergencyPhone],
                ['보험사 연락처', trip.travelInfo?.insurancePhone],
              ] as const
            )
              .filter(([, phone]) => !!phone)
              .map(([label, phone]) => (
                <div key={label}>
                  <span>{label}</span>
                  {phoneHref(phone!) ? (
                    <a href={phoneHref(phone!)}>
                      <Phone size={15} />
                      {phone}
                    </a>
                  ) : (
                    <strong>{phone}</strong>
                  )}
                </div>
              ))}
            {trip.travelInfo?.embassyContact && (
              <p>대사관·영사관 · {trip.travelInfo.embassyContact}</p>
            )}
            {trip.travelInfo?.lodgingAddress && (
              <p>숙소 · {trip.travelInfo.lodgingAddress}</p>
            )}
            {trip.travelInfo?.note && (
              <p className="travel-note-text">{trip.travelInfo.note}</p>
            )}
          </div>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  )
}
