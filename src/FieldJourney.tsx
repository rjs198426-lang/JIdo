import PlaceSource from './PlaceSource'
import PlacePhoto from './PlacePhoto'
import {
  Check,
  ChevronRight,
  MapPin,
  Wallet,
  FileText,
  Ticket,
  Plus,
  Phone,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  type Trip,
  type Stop,
  stopDetails,
  destinationForDay,
} from './travel-model'
import { dateAt, formatDate, today } from './store'
import {
  pendingStops,
  lodgingForDay,
  directionsTo,
  travelDay,
} from './journey-personal'
import { mapsSearch } from './google-maps'
import AttachmentsPanel from './AttachmentsPanel'
import JourneyShare from './JourneyShare'
import AddressCard from './AddressCard'
import FieldReservation from './FieldReservation'
import { reservationsForDay } from './field-reservations'

export default function FieldJourney({
  trip,
  day,
  onDay,
  onUpdate,
  onOpen,
  onAdd,
  onExpense,
  onReservation,
}: {
  trip: Trip
  day: number
  onDay: (day: number) => void
  onUpdate: (trip: Trip) => void
  onOpen: (workspace: string) => void
  onAdd: () => void
  onExpense: (stop?: Stop) => void
  onReservation: (id: string) => void
}) {
  const pending = pendingStops(trip, day),
    next = pending[0],
    lodging = lodgingForDay(trip, day)
  const selectedDate = dateAt(trip.startDate, day)
  const nextReservation = next?.reservationId
    ? trip.reservations?.find(
        (item) => item.id === next.reservationId && item.status !== 'cancelled',
      )
    : undefined
  const dayReservations = reservationsForDay(trip, day).filter(
    (item) =>
      item.id !== nextReservation?.id &&
      !lodging.some((stay) => stay.id === item.id),
  )
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => setNow(new Date())
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const lateMinutes =
    next && dateAt(trip.startDate, day) === today()
      ? Math.max(
          0,
          now.getHours() * 60 +
            now.getMinutes() -
            Number(next.time.slice(0, 2)) * 60 -
            Number(next.time.slice(3)),
        )
      : 0
  const delay =
    lateMinutes >= 60
      ? `${Math.floor(lateMinutes / 60)}시간${lateMinutes % 60 ? ` ${lateMinutes % 60}분` : ''}`
      : `${lateMinutes}분`
  const [undo, setUndo] = useState<{
    id: string
    day: number
    status: Stop['status']
  } | null>(null)
  const mark = (stop: Stop, status: Stop['status']) => {
    setUndo({ id: stop.id, day, status: stop.status })
    onUpdate({
      ...trip,
      days: trip.days.map((items, index) =>
        index === day
          ? items.map((item) =>
              item.id === stop.id ? { ...item, status } : item,
            )
          : items,
      ),
    })
  }
  const phone = (value?: string) => {
    const clean = value?.replace(/[ ()-]/g, '')
    return clean && /^\+?\d{3,20}$/.test(clean) ? `tel:${clean}` : undefined
  }
  return (
    <section
      className="field-journey workspace-panel"
      aria-label="여행 중 빠른 실행"
    >
      {travelDay(trip) !== null && day !== travelDay(trip) && (
        <button
          className="button outline small"
          onClick={() => onDay(travelDay(trip)!)}
        >
          오늘로 이동
        </button>
      )}
      <div className="tool-heading">
        <div>
          <h3>{destinationForDay(trip, day).name}에서의 하루</h3>
          <span>{formatDate(dateAt(trip.startDate, day), true)}</span>
        </div>
        <select
          aria-label="현장에서 볼 날짜"
          value={day}
          onChange={(event) => onDay(Number(event.target.value))}
        >
          {trip.days.map((_, index) => (
            <option value={index} key={index}>
              DAY {index + 1} · {formatDate(dateAt(trip.startDate, index))}
            </option>
          ))}
        </select>
      </div>
      {next ? (
        <article className="field-next">
          <span className="eyebrow">다음 방문 · {next.time}</span>
          {lateMinutes > 0 && (
            <span className="field-delay" role="status">
              예정 시각보다 {delay} 지났어요
            </span>
          )}
          <h2>{stopDetails(next).name}</h2>
          <p>{stopDetails(next).address}</p>
          <div className="field-actions">
            <a
              className="button primary"
              href={directionsTo(next, trip)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={18} />
              길찾기
            </a>
            <button
              className="button outline"
              onClick={() => mark(next, 'done')}
            >
              <Check size={18} />
              방문 완료
            </button>
            <button className="button outline" onClick={() => onExpense(next)}>
              <Wallet size={18} />
              지출 기록
            </button>
          </div>
          {stopDetails(next).address && (
            <AddressCard
              name={stopDetails(next).name}
              address={stopDetails(next).address}
            />
          )}
          {nextReservation && (
            <details className="field-ticket" key={next.id}>
              <summary>
                예약·티켓 ·{' '}
                {nextReservation.status === 'confirmed' ? '확정' : '확인 필요'}
              </summary>
              <FieldReservation
                item={nextReservation}
                date={selectedDate}
                scheduledTime={next.time}
                onManage={onReservation}
              />
            </details>
          )}
          {next.note && <p className="field-note">{next.note}</p>}
          <PlaceSource stop={next} />
          <details className="field-place-info stop-photos">
            <summary>
              장소 사진
              <ChevronRight size={16} aria-hidden="true" />
            </summary>
            <PlacePhoto stop={next} className="field-place-photo" />
            <AttachmentsPanel stopId={next.id} imagesOnly />
          </details>
          <button className="text-button" onClick={() => mark(next, 'skipped')}>
            이번 장소 건너뛰기
          </button>
        </article>
      ) : (
        <div className="field-next">
          <h3>
            {trip.days[day].length
              ? '남은 방문이 없어요'
              : '아직 정한 장소가 없어요'}
          </h3>
          <button className="button primary" onClick={onAdd}>
            <Plus size={18} />
            장소 추가
          </button>
          <button className="text-button" onClick={() => onOpen('schedule')}>
            일정 수정
          </button>
        </div>
      )}
      {undo && (
        <div className="undo-strip" role="status">
          방문 상태를 바꿨어요.
          <button
            onClick={() => {
              onUpdate({
                ...trip,
                days: trip.days.map((items, index) =>
                  index === undo.day
                    ? items.map((item) =>
                        item.id === undo.id
                          ? { ...item, status: undo.status }
                          : item,
                      )
                    : items,
                ),
              })
              setUndo(null)
            }}
          >
            실행 취소
          </button>
        </div>
      )}
      <div className="field-shortcuts">
        <button onClick={() => onExpense()}>
          <Wallet size={19} />
          지출 추가
        </button>
        <button onClick={() => onOpen('reservations')}>
          <Ticket size={19} />
          예약 확인
        </button>
        <button onClick={() => onOpen('files')}>
          <FileText size={19} />
          자료 열기
        </button>
        <button onClick={onAdd}>
          <Plus size={19} />
          장소 추가
        </button>
      </div>
      {dayReservations.length > 0 && (
        <details
          className="field-day-bookings"
          key={`${trip.id}:${day}:${nextReservation?.id || ''}`}
        >
          <summary>이날의 다른 예약 {dayReservations.length}건</summary>
          {dayReservations.map((item) => (
            <FieldReservation
              key={item.id}
              item={item}
              date={selectedDate}
              onManage={onReservation}
            />
          ))}
        </details>
      )}
      <details className="field-remaining">
        <summary>남은 장소 {pending.length}곳 · 방문 순서</summary>
        {pending.map((stop) => (
          <div key={stop.id}>
            <span>
              {stop.time} · {stopDetails(stop).name}
            </span>
            <a
              href={directionsTo(stop, trip)}
              target="_blank"
              rel="noopener noreferrer"
            >
              길찾기
            </a>
          </div>
        ))}
        <button className="text-button" onClick={() => onOpen('schedule')}>
          순서·시간 변경
        </button>
      </details>
      <section className="field-lodging">
        <div className="tool-heading">
          <h4>오늘 묵는 곳</h4>
          <button
            className="text-button"
            onClick={() => onOpen('reservations')}
          >
            예약 관리
          </button>
        </div>
        {lodging.length ? (
          lodging.map((item) => (
            <article key={item.id}>
              <strong>{item.title}</strong>
              {item.status !== 'confirmed' && <small>예약 확인 필요</small>}
              <p>{item.address}</p>
              {item.address && (
                <AddressCard name={item.title} address={item.address} />
              )}
              {item.reference && <p>예약 번호: {item.reference}</p>}
              {item.address && (
                <a
                  href={mapsSearch(item.address + ' ' + item.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  숙소 지도
                </a>
              )}
              <AttachmentsPanel reservationId={item.id} readOnly />
            </article>
          ))
        ) : trip.travelInfo?.lodgingAddress ? (
          <>
            <p>{trip.travelInfo.lodgingAddress}</p>
            <a
              href={mapsSearch(trip.travelInfo.lodgingAddress)}
              target="_blank"
              rel="noopener noreferrer"
            >
              숙소 지도
            </a>
          </>
        ) : (
          <button
            className="text-button"
            onClick={() => onOpen('reservations')}
          >
            숙소 예약 추가
          </button>
        )}
      </section>
      {trip.travelInfo && (
        <details className="field-contacts">
          <summary>여행 연락처·메모</summary>
          {[
            ['긴급 연락처', trip.travelInfo.emergencyPhone],
            ['보험사', trip.travelInfo.insurancePhone],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <p key={label}>
                {label} ·{' '}
                {phone(value) ? (
                  <a href={phone(value)}>
                    <Phone size={15} />
                    {value}
                  </a>
                ) : (
                  value
                )}
              </p>
            ))}
          {trip.travelInfo.embassyContact && (
            <p>{trip.travelInfo.embassyContact}</p>
          )}
          {trip.travelInfo.note && (
            <p className="field-note">{trip.travelInfo.note}</p>
          )}
        </details>
      )}
      <JourneyShare trip={trip} day={day} />
    </section>
  )
}
