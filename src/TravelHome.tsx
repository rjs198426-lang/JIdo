import type { ReactNode } from 'react'
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  CheckSquare,
  Compass,
  FileDown,
  MapPin,
  Plane,
  Plus,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react'
import { convertedTotal } from './finance'
import { journeyPreference, pendingStops, travelDay } from './journey-personal'
import { dayCount, formatDate, today } from './store'
import {
  destinationForDay,
  money,
  stopDetails,
  tripCity,
  tripDestinations,
  type Trip,
} from './travel-model'

type Props = {
  trip?: Trip
  trips: Trip[]
  savedCount: number
  cities: ReactNode
  places: ReactNode
  placesTitle: string
  search: ReactNode
  onCreate: () => void
  onOpenTrip: (trip: Trip, workspace?: string, day?: number) => void
  onTrips: () => void
  onSaved: () => void
  onImport: () => void
  onExplore: (japan?: boolean, showPlaces?: boolean) => void
}

export default function TravelHome(props: Props) {
  const { trip, trips } = props
  const currentDay = trip ? travelDay(trip) : null
  const day = trip ? (currentDay ?? journeyPreference(trip).day) : 0
  const until = trip ? dayCount(today(), trip.startDate) - 1 : 0
  const phase = !trip
    ? ''
    : currentDay !== null
      ? '여행 중'
      : until > 0
        ? `D-${until}`
        : '여행 기록'
  const checklist = trip?.checklist || []
  const completed = checklist.filter((item) => item.done).length
  const reservations = (trip?.reservations || []).filter(
    (item) => item.status !== 'cancelled',
  )
  const unconfirmed = reservations.filter(
    (item) => item.status !== 'confirmed',
  ).length
  const conversion = trip ? convertedTotal(trip) : null
  const next = trip ? pendingStops(trip, day).slice(0, 3) : []
  const shortcuts = [
    { label: '여행 만들기', icon: Plus, color: 'mint', action: props.onCreate },
    {
      label: '저장한 곳',
      icon: Bookmark,
      color: 'peach',
      action: props.onSaved,
    },
    {
      label: '일정 가져오기',
      icon: FileDown,
      color: 'blue',
      action: props.onImport,
    },
    {
      label: '여행지 보기',
      icon: Compass,
      color: 'violet',
      action: () => props.onExplore(),
    },
  ]
  return (
    <div className="travel-home">
      <div className="home-heading">
        <div>
          <span className="home-kicker">MY JOURNEY</span>
          <h1>나의 여행 한눈에</h1>
        </div>
        <span className="home-date">
          <CalendarDays size={15} />
          {formatDate(today(), true)}
        </span>
      </div>
      {trip ? (
        <section className="home-journey-card" aria-label="준비 중인 여행">
          <div className="home-journey-copy">
            <span className="home-phase">{phase}</span>
            <h2>{trip.title}</h2>
            <p className="home-journey-cities">
              <MapPin size={15} />
              {tripDestinations(trip)
                .map((item) => item.name)
                .join(' · ')}
            </p>
            <p className="home-journey-dates">
              {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              <span>·</span>
              {trip.days.length}일
            </p>
            <div className="home-journey-meta">
              <span>
                <Users size={15} />
                {trip.travelers === 1 ? '나 혼자' : `동행 ${trip.travelers}명`}
              </span>
              <span>
                <MapPin size={15} />
                {trip.days.flat().length}곳
              </span>
            </div>
            <button
              className="button primary"
              onClick={() =>
                props.onOpenTrip(
                  trip,
                  currentDay !== null ? 'field' : undefined,
                  day,
                )
              }
            >
              {currentDay !== null ? '오늘 여행 시작' : '여행 이어서 보기'}
              <ArrowRight size={17} />
            </button>
          </div>
          <img
            className="home-journey-photo"
            src={tripCity(trip).image}
            alt={`${tripCity(trip).name} 여행 풍경`}
          />
        </section>
      ) : (
        <section className="home-start-card" aria-label="첫 여행 준비">
          <div>
            <span className="home-phase">YOUR NEXT TRIP</span>
            <h2>
              다음 여행은
              <br />
              어디로 떠날까요?
            </h2>
            <button className="button primary" onClick={props.onCreate}>
              첫 여행 만들기
              <Plus size={17} />
            </button>
          </div>
          <div className="home-ticket" aria-hidden="true">
            <span>J★Do · BOARDING PASS</span>
            <Plane size={32} />
            <strong>나만의 자유여행</strong>
            <div className="home-ticket-path">
              <i />
              <b />
              <i />
            </div>
            <small>PLAN · GO · REMEMBER</small>
          </div>
        </section>
      )}
      <nav className="home-shortcuts" aria-label="여행 바로가기">
        {shortcuts.map(({ label, icon: Icon, color, action }) => (
          <button key={label} onClick={action}>
            <span className={`home-shortcut-icon ${color}`}>
              <Icon size={23} />
            </span>
            <strong>{label}</strong>
          </button>
        ))}
      </nav>
      {props.search}
      {trip && (
        <section className="home-trip-overview" aria-label="여행 현황">
          <div className="home-status-grid">
            <button onClick={() => props.onOpenTrip(trip, 'checklist', day)}>
              <CheckSquare size={20} />
              <span>준비물</span>
              <strong>
                {completed}
                <small> / {checklist.length}</small>
              </strong>
              <span className="home-status-caption">
                {checklist.length - completed}개 남음
              </span>
            </button>
            <button onClick={() => props.onOpenTrip(trip, 'reservations', day)}>
              <Ticket size={20} />
              <span>예약</span>
              <strong>
                {reservations.length}
                <small>건</small>
              </strong>
              <span className="home-status-caption">
                {unconfirmed
                  ? `${unconfirmed}건 확인 필요`
                  : '미확인 예약 없음'}
              </span>
            </button>
            <button onClick={() => props.onOpenTrip(trip, 'expenses', day)}>
              <Wallet size={20} />
              <span>여행 경비</span>
              <strong className="home-money">
                {conversion?.missing.length
                  ? '환율 확인'
                  : money(conversion!.total, conversion!.currency)}
              </strong>
              <span className="home-status-caption">
                {(trip.expenses || []).length}건 기록
              </span>
            </button>
          </div>
          <div className="home-next-day">
            <div className="home-section-heading">
              <div>
                <span className="home-kicker">
                  DAY {day + 1} · {destinationForDay(trip, day).name}
                </span>
                <h2>
                  {currentDay !== null ? '오늘의 일정' : '이어서 계획할 하루'}
                </h2>
              </div>
              <button
                className="text-button"
                onClick={() => props.onOpenTrip(trip, 'schedule', day)}
              >
                일정 보기
                <ArrowRight size={16} />
              </button>
            </div>
            {next.length ? (
              <ol>
                {next.map((stop) => (
                  <li key={stop.id}>
                    <span>{stop.time}</span>
                    <button
                      onClick={() => props.onOpenTrip(trip, 'schedule', day)}
                    >
                      <strong>{stopDetails(stop).name}</strong>
                      <Chevron />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <button
                className="home-empty-day"
                onClick={() => props.onOpenTrip(trip, 'schedule', day)}
              >
                <CalendarDays size={23} />
                {trip.days[day].length
                  ? '이날의 여행 기록 보기'
                  : '이날의 첫 장소 정하기'}
                <ArrowRight size={17} />
              </button>
            )}
          </div>
        </section>
      )}
      <section className="home-section" aria-label="일본 도시 둘러보기">
        <div className="home-section-heading">
          <div>
            <span className="home-kicker">CITY GUIDE</span>
            <h2>일본 도시 둘러보기</h2>
          </div>
          <button className="text-button" onClick={() => props.onExplore(true)}>
            더 보기
            <ArrowRight size={16} />
          </button>
        </div>
        {props.cities}
      </section>
      <section className="home-section" aria-label={props.placesTitle}>
        <div className="home-section-heading">
          <div>
            <span className="home-kicker">PLACES TO GO</span>
            <h2>{props.placesTitle}</h2>
          </div>
          <button
            className="text-button"
            onClick={
              props.savedCount >= 4
                ? props.onSaved
                : () => props.onExplore(false, true)
            }
          >
            더 보기
            <ArrowRight size={16} />
          </button>
        </div>
        {props.places}
      </section>
      {!!trips.length && (
        <section className="personal-home" aria-label="나와 동행자의 여행">
          <div className="home-section-heading">
            <div>
              <span className="home-kicker">MY TRIPS</span>
              <h2>나와 동행자의 여행</h2>
            </div>
            <button className="text-button" onClick={props.onTrips}>
              전체 {trips.length}
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="home-trip-grid">
            {trips
              .slice(-4)
              .reverse()
              .map((item) => (
                <button
                  className="home-trip-tile"
                  key={item.id}
                  onClick={() => props.onOpenTrip(item)}
                >
                  <span className="home-trip-icon">
                    <Plane size={22} />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {formatDate(item.startDate)} · {item.days.length}일 ·{' '}
                      {item.travelers === 1 ? '나 혼자' : `${item.travelers}명`}
                    </span>
                  </div>
                  <ArrowRight size={17} />
                </button>
              ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Chevron() {
  return <ArrowRight size={16} />
}
