import { Bell, LocateFixed } from 'lucide-react'
import CityPhoto from './CityPhoto'
import type { CityGuideTab } from './CityGuide'
import type { ReactNode } from 'react'
import type { HomeJourney } from './home-journey'
import {
  ArrowRight,
  BookOpen,
  Map,
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
import { convertedTotal, currencyTotals } from './finance'
import { pendingStops } from './journey-personal'
import { formatDate, today } from './store'
import {
  destinationForDay,
  money,
  stopDetails,
  tripDestinations,
  type Trip,
} from './travel-model'

type Props = {
  onReminders: () => void
  onNearby: () => void
  journey?: HomeJourney
  trips: Trip[]
  cities: ReactNode
  places: ReactNode
  placesTitle: string
  search: ReactNode
  onGuide: (cityId: string, tab: CityGuideTab) => void
  onCreate: () => void
  onOpenTrip: (trip: Trip, workspace?: string, day?: number) => void
  onTrips: () => void
  onImport: () => void
  onExplore: (japan?: boolean, showPlaces?: boolean, cityId?: string) => void
}

export default function TravelHome(props: Props) {
  const { journey, trips } = props
  const trip = journey?.trip
  const focused = !!journey?.personalized
  const currentDay = journey?.currentDay ?? null
  const day = journey?.day ?? 0
  const phase = !journey
    ? ''
    : journey.phase === 'ongoing'
      ? '여행 중'
      : journey.phase === 'upcoming'
        ? `D-${journey.until}`
        : '여행 기록'
  const checklist = trip?.checklist || []
  const completed = checklist.filter((item) => item.done).length
  const reservations = (trip?.reservations || []).filter(
    (item) => item.status !== 'cancelled',
  )
  const conversion = trip ? convertedTotal(trip) : null
  const next = trip ? pendingStops(trip, day).slice(0, 3) : []
  const shortcuts = [
    {
      label: '여행지 둘러보기',
      icon: Compass,
      color: 'mint',
      action: () => props.onExplore(),
    },
    {
      label: '여행 가져오기',
      icon: FileDown,
      color: 'blue',
      action: props.onImport,
    },
  ]
  return (
    <div className="travel-home">
      <div className="home-heading">
        <div>
          <span className="home-kicker">나의 자유여행</span>
          <h1>
            {focused
              ? currentDay !== null
                ? '오늘의 여행'
                : '다음 여행 준비'
              : '나의 여행 한눈에'}
          </h1>
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
                {trip.travelers === 1
                  ? '나 혼자'
                  : `동행 ${trip.travelers - 1}명`}
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
              {currentDay !== null ? '오늘 일정' : '여행 보기'}
              <ArrowRight size={17} />
            </button>
          </div>
          <CityPhoto
            className="home-journey-photo"
            city={journey!.heroCity}
            alt={`${journey!.destination.name} 여행 풍경`}
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
      {trip && journey && (
        <nav className="home-context-nav" aria-label="이번 여행 바로가기">
          {journey.city && (
            <>
              <button onClick={() => props.onGuide(journey.city!.id, 'ready')}>
                <BookOpen size={21} />
                <span>여행 가이드</span>
              </button>
              <button onClick={() => props.onExplore(false, true, journey.city!.id)}>
                <Map size={21} />
                <span>가볼 곳</span>
              </button>
            </>
          )}
          <button onClick={() => props.onOpenTrip(trip, 'reservations', day)}>
            <Ticket size={21} />
            <span>내 예약</span>
          </button>
          <button onClick={() => props.onOpenTrip(trip, 'checklist', day)}>
            <CheckSquare size={21} />
            <span>여행 준비</span>
          </button>
        </nav>
      )}
      <div className="home-service-links">
        <button onClick={props.onReminders}>
          <Bell size={17} />
          여행 알림 설정
        </button>
        <button onClick={props.onNearby}>
          <LocateFixed size={17} />내 주변 맛집
        </button>
      </div>
      {!focused && (
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
      )}
      {!focused && props.search}
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
            </button>
            <button onClick={() => props.onOpenTrip(trip, 'reservations', day)}>
              <Ticket size={20} />
              <span>예약</span>
              <strong>
                {reservations.length}
                <small>건</small>
              </strong>
            </button>
            <button onClick={() => props.onOpenTrip(trip, 'expenses', day)}>
              <Wallet size={20} />
              <span>여행 경비</span>
              <strong className="home-money">
                {conversion?.missing.length
                  ? currencyTotals(trip.expenses || [])
                      .map((item) => money(item.total, item.currency))
                      .join(' · ')
                  : money(conversion!.total, conversion!.currency)}
              </strong>
            </button>
          </div>
          <div className="home-next-day">
            <div className="home-section-heading">
              <div>
                <span className="home-kicker">
                  DAY {day + 1} · {destinationForDay(trip, day).name}
                </span>
                <h2>{currentDay !== null ? '오늘의 일정' : '여행 일정'}</h2>
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
      <details
        key={focused ? 'planned' : 'explore'}
        className={`home-discover simple-options ${focused ? '' : 'expanded'}`}
        open={focused ? undefined : true}
      >
        <summary>여행지 둘러보기</summary>
        {focused && journey && (
          <section
            className="home-section home-trip-destinations"
            aria-label="이번 여행의 도시"
          >
            <div className="home-section-heading">
              <div>
                <span className="home-kicker">MY DESTINATIONS</span>
                <h2>이번 여행의 도시</h2>
              </div>
              <button
                className="text-button"
                onClick={() => props.onOpenTrip(journey.trip, 'overview', day)}
              >
                여행 개요
                <ArrowRight size={16} />
              </button>
            </div>
            {props.cities}
            {tripDestinations(journey.trip)
              .filter(
                (destination) =>
                  !destination.guideCityId ||
                  !journey.cities.some(
                    (city) => city.id === destination.guideCityId,
                  ),
              )
              .map((destination) => (
                <button
                  className="home-custom-destination"
                  key={destination.id}
                  onClick={() => {
                    const targetDay = journey.trip.days.findIndex(
                      (_, index) =>
                        destinationForDay(journey.trip, index).id ===
                        destination.id,
                    )
                    props.onOpenTrip(
                      journey.trip,
                      targetDay < 0 ? 'overview' : 'schedule',
                      targetDay < 0 ? day : targetDay,
                    )
                  }}
                >
                  <MapPin size={20} />
                  <span>
                    <strong>{destination.name}</strong>
                    <small>{destination.country}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
          </section>
        )}
        {!focused && (
          <section className="home-section" aria-label="일본 도시 둘러보기">
            <div className="home-section-heading">
              <div>
                <span className="home-kicker">CITY GUIDE</span>
                <h2>일본 도시 둘러보기</h2>
              </div>
              <button
                className="text-button"
                onClick={() => props.onExplore(true)}
              >
                더 보기
                <ArrowRight size={16} />
              </button>
            </div>
            {props.cities}
          </section>
        )}
        <section className="home-section" aria-label={props.placesTitle}>
          <div className="home-section-heading">
            <div>
              <span className="home-kicker">
                {focused
                  ? `DAY ${day + 1} · ${journey!.destination.name}`
                  : 'PLACES TO GO'}
              </span>
              <h2>{props.placesTitle}</h2>
            </div>
            {(!focused || journey?.city) && (
              <button
                className="text-button"
                onClick={() =>
                  props.onExplore(
                    false,
                    true,
                    focused ? journey?.city?.id : undefined,
                  )
                }
              >
                더 보기
                <ArrowRight size={16} />
              </button>
            )}
          </div>
          {props.places}
          {focused && !journey?.recommendations.length && (
            <button
              className="home-empty-day"
              onClick={() => props.onOpenTrip(journey!.trip, 'schedule', day)}
            >
              <Plus size={20} />
              {journey?.city
                ? '정한 장소를 일정에서 확인하기'
                : '이 여행의 장소 직접 정하기'}
              <ArrowRight size={17} />
            </button>
          )}
        </section>
      </details>
      {!!trips.length && (
        <details className="home-other-trips simple-options">
          <summary>
            다른 여행 보기 <span>{trips.length}개</span>
          </summary>
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
                        {item.travelers === 1
                          ? '나 혼자'
                          : `동행 ${item.travelers - 1}명`}
                      </span>
                    </div>
                    <ArrowRight size={17} />
                  </button>
                ))}
            </div>
          </section>
        </details>
      )}
    </div>
  )
}

function Chevron() {
  return <ArrowRight size={16} />
}
