import AttachmentsPanel from './AttachmentsPanel'
import TripFilesProvider from './TripFilesProvider'
import { documentAttachments } from './attachment-purpose'
import { cancelledReservation } from './journey-progress'
import { useEffect, useState } from 'react'
import TripPhoto from './TripPhoto'
import {
  CalendarDays,
  Plane,
  BedDouble,
  CheckSquare,
  Wallet,
  ArrowRight,
  Plus,
  Map,
  FileDown,
  Camera,
  Check,
  Paperclip,
} from 'lucide-react'
import { journeyPhase } from './home-journey'
import { convertedTotal, currencyTotals } from './finance'
import {
  destinationForDay,
  money,
  stopDetails,
  type Trip,
} from './travel-model'
import { dateAt, formatDate } from './store'
import { tripClock } from './destination-time'
export default function PlannerHome({
  trips,
  activeTripId,
  onCreate,
  onOpen,
  onImport,
  onPhotos,
  onQuick,
  onChange,
  selectedTripId,
  onSelectTrip,
  onSyncTrip,
}: {
  selectedTripId?: string
  onSelectTrip: (id: string) => void
  onSyncTrip: (id: string) => void
  onQuick: (
    trip: Trip,
    day: number,
    action?: 'files' | '항공' | '숙소' | 'expense',
  ) => void
  onChange: (id: string, change: (trip: Trip) => Trip) => boolean | void
  trips: Trip[]
  activeTripId: string
  onCreate: () => void
  onImport: () => void
  onPhotos: (trip: Trip) => void
  onOpen: (trip: Trip, workspace: string, day: number) => void
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setNow(new Date())
    }
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  const states = trips
    .map((trip) => ({ trip, ...journeyPhase(trip, now) }))
    .sort((a, b) => {
      const rank = { ongoing: 0, upcoming: 1, past: 2 }
      return (
        rank[a.phase] - rank[b.phase] ||
        (a.phase === 'past'
          ? b.trip.endDate.localeCompare(a.trip.endDate)
          : a.trip.startDate.localeCompare(b.trip.startDate)) ||
        Number(b.trip.id === activeTripId) - Number(a.trip.id === activeTripId)
      )
    })
  const entry =
      states.find((entry) => entry.trip.id === selectedTripId) || states[0],
    trip = entry?.trip
  useEffect(() => {
    if (trip && trip.id !== activeTripId) onSyncTrip(trip.id)
  }, [trip?.id, activeTripId, onSyncTrip])
  if (!trip || !entry)
    return (
      <section className="planner-home page-section">
        <span className="home-kicker">나의 자유여행</span>
        <h1>여행 준비부터 현장까지</h1>
        <div className="planner-welcome">
          <Plane size={32} />
          <h2>내 여행을 한곳에</h2>
          <p>
            날짜별 일정, 항공·호텔 예약, 여행 경비와 동행자 정산을 함께
            관리해요.
          </p>
          <button className="button primary" onClick={onCreate}>
            첫 여행 만들기
            <Plus size={18} />
          </button>
        </div>
        <p className="home-storage-note">
          가입 없이 시작해요. 기록은 기기에 저장되며 설정에서 백업·Google Drive
          동기화를 연결할 수 있어요.
        </p>
        <button className="text-button" onClick={onImport}>
          <FileDown size={18} />
          여행 백업 불러오기
        </button>
      </section>
    )
  const day =
      entry.currentDay ?? (entry.phase === 'past' ? trip.days.length - 1 : 0),
    date = dateAt(trip.startDate, day)
  const pending = trip.days[day].filter(
    (stop) => stop.status !== 'skipped' && !cancelledReservation(trip, stop),
  )
  const reservations = (trip.reservations || []).filter(
    (r) => r.status !== 'cancelled',
  )
  const upcoming = reservations
    .filter(
      (r) =>
        entry.phase === 'past' ||
        [r.date, r.endDate, r.flight?.arrivalDate]
          .filter((v): v is string => !!v)
          .sort()
          .at(-1)! >= tripClock(trip, day, now).date,
    )
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 3)
  const total = convertedTotal(trip),
    done = trip.checklist?.filter((i) => i.done).length || 0
  const open = (workspace: string) => onOpen(trip, workspace, day)
  return (
    <TripFilesProvider
      trip={trip}
      onChange={(change) => onChange(trip.id, change)}
      isShared={() => true}
    >
      <section className="planner-home page-section">
        {trips.length > 1 && (
          <label className="home-trip-switch">
            현재 여행
            <select
              aria-label="홈에서 볼 여행"
              value={trip.id}
              onChange={(e) => onSelectTrip(e.target.value)}
            >
              {states.map(({ trip: item }) => (
                <option key={item.id} value={item.id}>
                  {item.title} · {formatDate(item.startDate)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="home-section-heading">
          <div>
            <span className="home-kicker">
              {entry.phase === 'ongoing'
                ? '지금 여행 중'
                : entry.phase === 'past'
                  ? '지난 여행'
                  : '다음 여행 준비'}
            </span>
            <h1>{trip.title}</h1>
          </div>
          <button
            className="icon-button"
            aria-label="새 여행 만들기"
            onClick={onCreate}
          >
            <Plus size={22} />
          </button>
        </div>
        <div className="planner-trip-summary">
          <TripPhoto
            trip={trip}
            className="planner-cover-photo"
            fallback={
              <Plane
                className="hero-travel-icon"
                size={88}
                aria-hidden="true"
              />
            }
          />
          <span className="home-phase">
            {entry.phase === 'upcoming'
              ? `D-${entry.until}`
              : entry.phase === 'ongoing'
                ? '여행 중'
                : '여행 기록'}
          </span>
          <p>
            {formatDate(trip.startDate)} – {formatDate(trip.endDate)} ·{' '}
            {trip.days.length}일
          </p>
          <p>
            {trip.travelers === 1
              ? '나 혼자'
              : `나와 동행 ${trip.travelers - 1}명`}
          </p>
          <button
            className="button primary"
            onClick={() =>
              open(entry.phase === 'ongoing' ? 'field' : 'schedule')
            }
          >
            {entry.phase === 'ongoing' ? '오늘 여행 열기' : '여행 계획 열기'}
            <ArrowRight size={18} />
          </button>
          <button
            className="text-button planner-photo-button"
            onClick={() => onPhotos(trip)}
          >
            <Camera size={18} />
            여행 사진
          </button>
        </div>
        <nav className="planner-shortcuts" aria-label="여행 바로가기">
          {[
            ['항공·호텔', 'reservations', Plane],
            ['준비물', 'checklist', CheckSquare],
            ['경비·정산', 'expenses', Wallet],
            ['지도·동선', 'route', Map],
          ].map(([label, workspace, Icon]) => {
            const Image = Icon as typeof Plane
            return (
              <button
                key={workspace as string}
                onClick={() => open(workspace as string)}
              >
                <Image size={23} />
                <span>{label as string}</span>
              </button>
            )
          })}
        </nav>
        <section className="planner-panel">
          <div className="home-section-heading">
            <h2>{entry.phase === 'ongoing' ? '오늘 일정' : '여행 일정'}</h2>
            <button className="text-button" onClick={() => open('schedule')}>
              일정 보기
              <ArrowRight size={16} />
            </button>
          </div>
          <p className="muted">
            {formatDate(date, true)} · {destinationForDay(trip, day).name}
          </p>
          {pending.length ? (
            <ol className="planner-day-preview">
              {pending.slice(0, 4).map((stop) => (
                <li
                  key={stop.id}
                  className={stop.status === 'done' ? 'is-done' : ''}
                >
                  <button
                    className="home-complete"
                    aria-label={`${stopDetails(stop).name} ${stop.status === 'done' ? '완료 취소' : '방문 완료'}`}
                    aria-pressed={stop.status === 'done'}
                    onClick={() =>
                      onChange(trip.id, (current) => ({
                        ...current,
                        days: current.days.map((stops, i) =>
                          i === day
                            ? stops.map((item) =>
                                item.id === stop.id
                                  ? {
                                      ...item,
                                      status:
                                        item.status === 'done'
                                          ? 'planned'
                                          : 'done',
                                    }
                                  : item,
                              )
                            : stops,
                        ),
                      }))
                    }
                  >
                    <Check size={17} />
                  </button>
                  <span>{stop.time || '시간 미정'}</span>
                  <button
                    className="home-stop-details"
                    onClick={() =>
                      open(entry.phase === 'ongoing' ? 'field' : 'schedule')
                    }
                  >
                    <strong>{stopDetails(stop).name}</strong>
                    {stop.note && <small>{stop.note}</small>}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <button
              className="planner-empty-link"
              onClick={() => open('schedule')}
            >
              <CalendarDays size={22} />
              이날의 첫 일정 정하기
              <ArrowRight size={16} />
            </button>
          )}
        </section>
        <section className="planner-panel">
          <div className="home-section-heading">
            <h2>항공·호텔 예약</h2>
            <button
              className="text-button"
              onClick={() => open('reservations')}
            >
              모두 보기
              <ArrowRight size={16} />
            </button>
          </div>
          {upcoming.length ? (
            upcoming.map((item) => (
              <article
                className="home-booking-card"
                key={item.id}
                aria-label={`${item.title} 예약 요약`}
              >
                <div className="home-booking-heading">
                  {item.kind === '항공' ? (
                    <Plane size={20} />
                  ) : (
                    <BedDouble size={20} />
                  )}
                  <strong>{item.title}</strong>
                  <span>
                    {item.status === 'confirmed' ? '확정' : '확인 필요'}
                  </span>
                </div>
                {item.flight && (
                  <div className="home-flight-route">
                    <strong>
                      {item.flight.departureAirport || '출발 공항'}
                    </strong>
                    <ArrowRight size={18} />
                    <strong>{item.flight.arrivalAirport || '도착 공항'}</strong>
                  </div>
                )}
                <p>
                  {item.flight?.number && `${item.flight.number} · `}
                  {formatDate(item.date)} {item.time || '시간 미정'}
                  {item.kind === '숙소' &&
                    item.endDate &&
                    ` → ${formatDate(item.endDate)} ${item.stay?.checkoutTime || ''}`}
                  {item.flight?.arrivalDate &&
                    ` → ${formatDate(item.flight.arrivalDate)} ${item.flight.arrivalTime || ''}`}
                </p>
                {item.reference && (
                  <div className="home-booking-reference">
                    <span>
                      예약 번호 <strong>{item.reference}</strong>
                    </span>
                    <CopyBooking reference={item.reference} />
                  </div>
                )}
                {item.address && (
                  <p className="home-booking-address">{item.address}</p>
                )}
                <AttachmentsPanel reservationId={item.id} readOnly />
              </article>
            ))
          ) : (
            <button
              className="planner-empty-link"
              onClick={() => onQuick(trip, day, '항공')}
            >
              예약한 항공·숙소 기록하기
              <Plus size={18} />
            </button>
          )}
        </section>
        <section className="planner-panel home-checklist">
          <div className="home-section-heading">
            <h2>출발 전 할 일</h2>
            <button className="text-button" onClick={() => open('checklist')}>
              전체 보기 <ArrowRight size={16} />
            </button>
          </div>
          {(trip.checklist || [])
            .filter((item) => !item.done)
            .slice(0, 4)
            .map((item) => (
              <label className="home-check-row" key={item.id}>
                <input
                  type="checkbox"
                  checked={false}
                  aria-label={`${item.title} 준비 완료`}
                  onChange={() =>
                    onChange(trip.id, (current) => ({
                      ...current,
                      checklist: (current.checklist || []).map((check) =>
                        check.id === item.id ? { ...check, done: true } : check,
                      ),
                    }))
                  }
                />
                <span>
                  {item.title}
                  {item.dueDate && (
                    <small>{formatDate(item.dueDate)}까지</small>
                  )}
                </span>
              </label>
            ))}
          {!trip.checklist?.length ? (
            <button
              className="planner-empty-link"
              onClick={() => open('checklist')}
            >
              챙길 것과 할 일 추가하기 <Plus size={18} />
            </button>
          ) : (
            trip.checklist.every((item) => item.done) && (
              <p className="muted">등록한 준비물을 모두 확인했어요.</p>
            )
          )}
        </section>
        <section className="planner-panel home-documents">
          <div className="home-section-heading">
            <h2>
              <Paperclip size={19} /> 바로 꺼내는 자료{' '}
              <span>{documentAttachments(trip.attachments).length}</span>
            </h2>
            <button
              className="text-button"
              onClick={() => onQuick(trip, day, 'files')}
            >
              파일 첨부 <Plus size={16} />
            </button>
          </div>
          {documentAttachments(trip.attachments).length ? (
            <>
              <AttachmentsPanel all readOnly trip={trip} maxVisible={3} />
              {documentAttachments(trip.attachments).length > 3 && (
                <button className="text-button" onClick={() => open('files')}>
                  자료 모두 보기 <ArrowRight size={16} />
                </button>
              )}
            </>
          ) : (
            <p className="muted">
              티켓과 예약 확인서를 넣어두면 여기서 바로 열 수 있어요.
            </p>
          )}
        </section>
        <div className="planner-metrics">
          <button onClick={() => open('checklist')}>
            <span>준비물</span>
            <strong>
              {trip.checklist?.length
                ? `${done}/${trip.checklist.length}`
                : '목록 만들기'}
            </strong>
          </button>
          <button onClick={() => open('expenses')}>
            <span>기록한 여행 경비</span>
            <strong>
              {total.missing.length
                ? currencyTotals(trip.expenses || [])
                    .map((v) => money(v.total, v.currency))
                    .join(' · ')
                : money(total.total, total.currency)}
            </strong>
          </button>
        </div>
      </section>
      <button className="quick-add-fab" onClick={() => onQuick(trip, day)}>
        <Plus size={22} />
        빠른 추가
      </button>
    </TripFilesProvider>
  )
}

function CopyBooking({ reference }: { reference: string }) {
  const [message, setMessage] = useState('')
  return (
    <>
      <button
        className="text-button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(reference)
            setMessage('복사했어요')
          } catch {
            setMessage('예약 번호를 길게 눌러 선택해 주세요')
          }
        }}
      >
        {message || '복사'}
      </button>
    </>
  )
}
