import ReminderSettings from './ReminderSettings'
import LiveNearby from './LiveNearby'
import { useTravelReminders } from './reminder-service'
import { layoutHeight } from './ui-scale'
import { Ticket, CheckSquare, Wallet } from 'lucide-react'
import DayNavigation from './DayNavigation'
import {
  moveScheduleStops,
  scheduleMoveRecord,
  undoScheduleMove,
  type ScheduleMove,
} from './schedule-move'
import { bundledImage } from './bundled-image'
import { startContentUpdates } from './content-release'
import TimelineRail, { timelineDistance } from './TimelineRail'
import SettingsPage from './SettingsPage'
import { Settings } from 'lucide-react'
import ScheduleStopInfo from './ScheduleStopInfo'
import ScheduleOrderDialog from './ScheduleOrderDialog'
import {
  emptyScheduleFilter,
  matchesSchedule,
  scheduleSummary,
  applyScheduleOrder,
  type ScheduleFilter,
  type ScheduleOrder,
} from './schedule-list'
import { homeJourney } from './home-journey'
import AppInformation from './AppInformation'
import BlogPhotos from './BlogPhotos'
import { meaningfulCost } from './place-introduction'
import { balancedPlaces } from './category-balance'
import CompanionCount from './CompanionCount'
import DayTransfers from './DayTransfers'
import { useGoogleRoutes } from './google-routes'
import DurationInput from './DurationInput'
import TripSearch from './TripSearch'
import DayScheduleAdjust from './DayScheduleAdjust'
import { applyTimeAdjustment, type TimeAdjustment } from './schedule-adjust'
import { useJourneyNavigation } from './use-journey-navigation'
import type { JourneyTarget } from './trip-readiness'
import { dayTransferLegs } from './transfer-planning'
import {
  planningViews,
  preparationViews,
  workspaceGroup,
} from './workspace-navigation'
import QuickExpense from './QuickExpense'
import NearbyPlaces from './NearbyPlaces'
import { commitFullRestore } from './full-backup'
import ReservationConflicts from './ReservationConflicts'
import { useDraftFields } from './form-draft'
import CityGuide, { type CityGuideTab } from './CityGuide'
import TripOverview from './TripOverview'
import {
  personalPhotoKey,
  personalPhotosSnapshot,
  usePersonalPhoto,
  usePhotoUrl,
} from './personal-photos'
import { sameStopPlace } from './stop-identity'
import CityPhoto from './CityPhoto'
import PersonalPhotoControl from './PersonalPhotoControl'
import GuideCourseForm from './GuideCourseForm'
import { appendGuideSelection } from './guide-course'
import {
  courseDays,
  practicalGuideById,
  type CourseSelection,
} from './practical-guides'
import CoursePreview from './CoursePreview'
import TravelHome from './TravelHome'
import PhotoCredits from './PhotoCredits'
import PlaceSource from './PlaceSource'
import PlaceReviews from './PlaceReviews'
import PlacePhoto from './PlacePhoto'
import FieldJourney from './FieldJourney'
import JourneyShare from './JourneyShare'
import {
  journeyPreference,
  saveJourneyPreference,
  travelDay,
} from './journey-personal'
import AttachmentsPanel, { AttachmentsContext } from './AttachmentsPanel'
import type { Attachment } from './attachment-schema'
import TripDashboard from './TripDashboard'
import { cancelledReservation, timeConflicts } from './journey-progress'
import PlacePicker from './PlacePicker'
import RegisteredPlaceAdd from './RegisteredPlaceAdd'
import {
  registeredPlaces,
  registeredPlaceKey,
  matchesRegisteredPlace,
} from './registered-places'
import { googleMapsLink, mapsSearch } from './google-maps'
import { placeCoordinates, placeMapQuery } from './place-location'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Compass,
  Coffee,
  Earth,
  Home,
  Luggage,
  Map as MapIcon,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
  Utensils,
  X,
  Plane,
  ExternalLink,
  Pencil,
  BedDouble,
  Music,
  ShoppingBag,
} from 'lucide-react'
import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  cities,
  places,
  regions,
  categoryOptions,
  getCity,
  getPlace,
  type City,
  type Place,
  type Region,
} from './catalog'
import { getGuide, useGuideCatalog } from './catalog'
import GuideContent from './GuideContent'
import TripEditor from './TripEditor'
import JourneyRoute, { DayRoute } from './JourneyRoute'
import CustomStopForm from './CustomStopForm'
import TravelBackup from './TravelBackup'
import { Checklist, Expenses, Reservations } from './TravelTools'
import {
  tripCity,
  tripDestinations,
  destinationForDay,
  stopDetails,
  mapQuery,
  tripSchema,
  MAX_TRAVELERS,
  type CustomPlace,
} from './travel-model'
import { matchesCity, matchesPlace } from './search'
import {
  dateAt,
  dayCount,
  formatDate,
  today,
  useTravelStore,
  type Trip,
  type Stop,
} from './store'

type Page = 'home' | 'trips' | 'explore' | 'settings'
type Dialog =
  | { type: 'credits' }
  | { type: 'reminders' }
  | { type: 'nearby' }
  | { type: 'expense'; tripId: string; day: number; stopId?: string }
  | { type: 'city'; id: string; guideTab?: CityGuideTab }
  | { type: 'place'; id: string }
  | {
      type: 'create'
      cityId?: string
      placeId?: string
      course?: CourseSelection
      initialName?: string
      initialCountry?: string
      pendingPlaceName?: string
      registeredPlace?: CustomPlace
    }
  | { type: 'course'; course: CourseSelection }
  | { type: 'picker'; tripId: string; day: number }
  | { type: 'add'; placeId: string }
  | { type: 'registered'; key: string }
  | { type: 'delete'; tripId: string }
  | { type: 'backup' }
  | { type: 'edit'; tripId: string }
  | {
      type: 'custom'
      tripId: string
      day: number
      stopId?: string
      initialName?: string
    }
const navigation = [
  { id: 'home' as const, name: '홈', icon: Home },
  { id: 'trips' as const, name: '내 여행', icon: Luggage },
  { id: 'explore' as const, name: '여행지', icon: Compass },
  { id: 'settings' as const, name: '설정', icon: Settings },
]
const categoryIcon = {
  관광: MapPin,
  맛집: Utensils,
  카페: Coffee,
  숙소: BedDouble,
  '바·공연': Music,
  쇼핑: ShoppingBag,
  체험: Sparkles,
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const container = ref.current!
    container
      .querySelector<HTMLElement>(
        'button, input, select, textarea, [tabindex="0"]',
      )
      ?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
      if (event.key === 'Tab') {
        const elements = Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length > 0)
        const first = elements[0],
          last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKey)
      previous?.focus()
    }
  }, [])
  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CityCard({
  city,
  onOpen,
  compact = false,
}: {
  city: City
  onOpen: () => void
  compact?: boolean
}) {
  return (
    <article className={`city-card ${compact ? 'city-compact' : ''}`}>
      <div className="city-photo">
        <button
          className="photo-button"
          aria-label={`${city.name} 여행지 자세히 보기`}
          onClick={onOpen}
        >
          <CityPhoto city={city} />
        </button>
        <span className="country-tag">{city.country}</span>
      </div>
      <button className="city-card-copy" onClick={onOpen}>
        <span className="city-title">
          <strong>{city.name}</strong>
          <span>{city.country}</span>
          <ArrowUp className="diagonal-arrow" size={19} />
        </span>
        <span className="city-tagline">{city.tagline}</span>
        <span className="tags">
          {city.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </span>
      </button>
    </article>
  )
}

function PlaceCard({ place, onOpen }: { place: Place; onOpen: () => void }) {
  const Icon = categoryIcon[place.category]
  return (
    <article className="place-card">
      <div className="place-photo">
        <button
          className="photo-button"
          onClick={onOpen}
          aria-label={`${place.name} 자세히 보기`}
        >
          <PlacePhoto place={place} alt={place.name} />
        </button>
      </div>
      <button className="place-card-copy" onClick={onOpen}>
        <span className="place-location">
          <MapPin size={12} />
          {place.area?.startsWith('근교')
            ? place.area
            : getCity(place.cityId)?.name}
          <span>·</span>
          {place.category}
        </span>
        <strong>{place.name}</strong>
        <span className="place-description">{place.description}</span>
        <span className="place-meta">
          <Icon size={13} /> {place.area || place.category}
          {place.address && (
            <span className="place-card-address">{place.address}</span>
          )}
        </span>
      </button>
    </article>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: ReactNode
  title: string
  description: string
  action: string
  onAction: () => void
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <button className="button primary" onClick={onAction}>
        {action}
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

function CreateTrip({
  cityId,
  placeId,
  initialName = '',
  initialCountry = '',
  course,
  onCreate,
}: {
  cityId?: string
  course?: CourseSelection
  initialName?: string
  initialCountry?: string
  placeId?: string
  onCreate: (trip: Trip) => void
}) {
  const draft = useDraftFields(
    `jido-draft:create:${cityId || 'custom'}:${placeId || ''}:${course?.days ? course.id + ':' : ''}${course?.placeIds.join(',') || ''}${initialName ? ':' + initialName + ':' + initialCountry : ''}`,
    {
      destination: cityId || (initialName ? 'custom' : ''),
      customCity: initialName,
      customCountry: initialCountry,
      title: '',
      start: today(),
      end: dateAt(today(), course?.days ? course.days.length - 1 : 3),
      travelers: 1,
      recommended: false,
      courseTime: '',
    },
  )
  const [destination, setDestination] = draft.field('destination')
  const [customCity, setCustomCity] = draft.field('customCity')
  const [customCountry, setCustomCountry] = draft.field('customCountry')
  const [title, setTitle] = draft.field('title')
  const [start, setStart] = draft.field('start')
  const [end, setEnd] = draft.field('end')
  const [travelers, setTravelers] = draft.field('travelers')
  const [recommended, setRecommended] = draft.field('recommended')
  const [courseTime, setCourseTime] = draft.field('courseTime')
  const [error, setError] = useState('')
  const selectedCity = getCity(destination) || {
    name: customCity.trim() || '새로운 도시',
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!destination) return setError('여행지를 골라주세요.')
    if (
      destination === 'custom' &&
      (!customCity.trim() || !customCountry.trim())
    ) {
      setError('도시와 국가를 입력해 주세요.')
      return
    }
    if (
      !Number.isInteger(travelers) ||
      travelers < 1 ||
      travelers > MAX_TRAVELERS
    ) {
      setError('함께하는 인원을 확인해 주세요.')
      return
    }
    const targetId =
      destination === 'custom' ? `personal-${crypto.randomUUID()}` : destination
    const count = dayCount(start, end)
    if (!Number.isFinite(count) || count < 1) {
      setError('마지막 날은 출발일과 같거나 이후여야 해요.')
      return
    }
    if (count > 90) {
      setError('한 여행은 최대 90일까지 만들 수 있어요.')
      return
    }
    const days: Stop[][] = Array.from({ length: count }, () => [])
    const initialPlaces = course
      ? []
      : placeId
        ? [getPlace(placeId)!]
        : recommended
          ? places.filter((place) => place.cityId === destination).slice(0, 3)
          : []
    initialPlaces.forEach((place) =>
      days[0].push({
        id: crypto.randomUUID(),
        placeId: place.id,
        time: '',
        note: '',
      }),
    )
    const created: Trip = {
      id: crypto.randomUUID(),
      title: title.trim() || `${selectedCity.name} 여행`,
      cityId: targetId,
      destinations: [
        {
          id: targetId,
          name: selectedCity.name,
          country:
            destination === 'custom'
              ? customCountry.trim()
              : getCity(destination)!.country,
          ...(destination !== 'custom' ? { guideCityId: destination } : {}),
        },
      ],
      startDate: start,
      endDate: end,
      travelers,
      members: Array.from({ length: travelers }, (_, index) => ({
        id: crypto.randomUUID(),
        name: index === 0 ? '나' : `동행 ${index}`,
      })),
      days,
    }
    try {
      onCreate(
        course
          ? appendGuideSelection(created, course, 0, courseTime, getPlace).trip
          : created,
      )
      draft.clear()
    } catch (error) {
      setError((error as Error).message)
    }
  }
  return (
    <form
      className="create-form simple-create"
      onSubmit={submit}
      onInvalidCapture={(event) => {
        const details = (event.target as HTMLElement).closest('details')
        if (details) details.open = true
      }}
    >
      <p className="form-intro">여행지와 날짜만 정하면 준비 끝이에요.</p>
      <label className="field">
        어디로 떠나세요?
        <select
          required
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          disabled={!!placeId || !!course}
        >
          <option value="" disabled>
            여행지 선택
          </option>
          {!cities.some((city) => city.id === destination) &&
            getCity(destination) && (
              <option value={destination}>
                {getCity(destination)!.name} · 저장된 가이드
              </option>
            )}
          <option value="custom">원하는 도시 직접 입력</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name} · {city.country}
            </option>
          ))}
        </select>
      </label>
      {destination === 'custom' && (
        <div className="form-row">
          <label className="field">
            도시 이름
            <input
              required
              maxLength={80}
              value={customCity}
              onChange={(event) => setCustomCity(event.target.value)}
              placeholder="예: 파리"
            />
          </label>
          <label className="field">
            국가
            <input
              required
              maxLength={80}
              value={customCountry}
              onChange={(event) => setCustomCountry(event.target.value)}
              placeholder="예: 프랑스"
            />
          </label>
        </div>
      )}
      <div className="form-row">
        <label className="field">
          출발일
          <input
            required
            type="date"
            value={start}
            onChange={(event) => {
              setStart(event.target.value)
              if (course?.days && event.target.value)
                setEnd(dateAt(event.target.value, course.days.length - 1))
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
      {course && (
        <section className="course-create-preview">
          <h3>{course.title}</h3>
          <CoursePreview course={course} />
          <label className="field">
            {course.days ? '매일 첫 방문 시간' : '첫날 첫 방문 시간'}
            <input
              type="time"
              value={courseTime}
              onChange={(event) => setCourseTime(event.target.value)}
            />
          </label>
          <p className="detail-footnote">
            {course.days
              ? `선택한 ${courseDays(course).length}일 코스를 날짜별로 담습니다. `
              : '선택한 코스를 첫날에 담습니다. '}
            시간을 정하지 않고 담아도 됩니다. 방문 시간은 일정 편집에서 정할 수
            있어요.
          </p>
        </section>
      )}
      <details className="simple-options create-options">
        <summary>
          여행 이름·동행 설정 <span>선택</span>
        </summary>
        <label className="field">
          여행 이름 <span className="optional">선택</span>
          <input
            placeholder={`${selectedCity.name} 여행`}
            value={title}
            maxLength={50}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <CompanionCount travelers={travelers} onChange={setTravelers} />
        {!placeId && !course && destination && destination !== 'custom' && (
          <label className="check-field">
            <input
              type="checkbox"
              checked={recommended}
              onChange={(event) => setRecommended(event.target.checked)}
            />
            <span>
              첫날에 추천 장소 3곳 넣어두기
              <small>나중에 자유롭게 바꿀 수 있어요.</small>
            </span>
          </label>
        )}
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

function AddToTrip({
  place,
  trips,
  preferredTripId,
  preferredDay,
  onAdd,
  onCreate,
  onManageTrip,
}: {
  place: Place
  trips: Trip[]
  preferredTripId?: string
  preferredDay?: number
  onAdd: (tripId: string, day: number) => void
  onCreate: () => void
  onManageTrip: (id: string) => void
}) {
  const matching = trips.filter((trip) =>
    tripDestinations(trip).some(
      (destination) => destination.guideCityId === place.cityId,
    ),
  )
  const [tripId, setTripId] = useState(
    matching.find((trip) => trip.id === preferredTripId)?.id ??
      matching[0]?.id ??
      '',
  )
  const [day, setDay] = useState<number | null>(
    matching.some((trip) => trip.id === preferredTripId)
      ? (preferredDay ?? null)
      : null,
  )
  const trip = matching.find((item) => item.id === tripId)
  const eligible =
    trip?.days
      .map((_, index) => index)
      .filter(
        (index) => destinationForDay(trip, index).guideCityId === place.cityId,
      ) || []
  const selectedDay = day !== null && eligible.includes(day) ? day : eligible[0]
  if (!trip)
    return (
      <div className="modal-body">
        <EmptyState
          icon={<Luggage size={30} />}
          title={`${getCity(place.cityId)?.name} 여행을 먼저 만들어볼까요?`}
          description="여행을 만들면 이 장소가 첫날 일정에 추가돼요."
          action="이 장소와 여행 시작하기"
          onAction={onCreate}
        />
      </div>
    )
  return (
    <form
      className="modal-body"
      onSubmit={(event) => {
        event.preventDefault()
        if (selectedDay !== undefined) onAdd(tripId, selectedDay)
      }}
    >
      <div className="add-place-preview">
        <PlacePhoto place={place} alt={place.name} />
        <div>
          <span className="eyebrow">{place.category}</span>
          <h3>{place.name}</h3>
        </div>
      </div>
      <label className="field">
        추가할 여행
        <select
          value={tripId}
          onChange={(event) => {
            setTripId(event.target.value)
            setDay(null)
          }}
        >
          {matching.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        어느 날에 갈까요?
        <select
          value={selectedDay ?? ''}
          onChange={(event) => setDay(Number(event.target.value))}
        >
          {selectedDay === undefined && (
            <option value="">이 도시의 날짜 미지정</option>
          )}
          {eligible.map((index) => (
            <option key={index} value={index}>
              DAY {index + 1} · {formatDate(dateAt(trip.startDate, index))}
            </option>
          ))}
        </select>
      </label>
      {selectedDay === undefined && (
        <button
          type="button"
          className="button outline full"
          onClick={() => onManageTrip(trip.id)}
        >
          여행에서 체류 날짜 지정
        </button>
      )}
      <button
        className="button primary full"
        type="submit"
        disabled={selectedDay === undefined}
      >
        <Plus size={18} />
        일정에 추가
      </button>
    </form>
  )
}

function Itinerary({
  trip,
  day,
  onDayChange: changeDay,
  onAdd,
  onDeleteTrip,
  onEditTrip,
  onCustom,
  onUpdate,
  onOpen,
  onAttachmentsChange,
  isAttachmentShared,
  onQuickExpense,
  scheduleReturn,
}: {
  scheduleReturn?: { tripId: string; day: number; revision: number }
  onQuickExpense: (stop?: Stop) => void
  onAttachmentsChange: (change: (files: Attachment[]) => Attachment[]) => void
  isAttachmentShared: (id: string) => boolean
  trip: Trip
  day: number
  onDayChange: (day: number) => void
  onAdd: () => void
  onDeleteTrip: () => void
  onEditTrip: () => void
  onCustom: (stopId?: string) => void
  onUpdate: (trip: Trip) => void
  onOpen: (placeId: string) => void
}) {
  const city = tripCity(trip)
  const personalCityPhoto = usePersonalPhoto(personalPhotoKey('city', city.id))
  const cityCover = usePhotoUrl(personalCityPhoto) || city.image
  const [workspace, setWorkspaceState] = useState(
    () => journeyPreference(trip).workspace,
  )
  const navigation = useJourneyNavigation(
    workspace,
    day,
    setWorkspaceState,
    changeDay,
  )
  const setWorkspace = (next: string) => navigation.go(next)
  const onDayChange = (next: number) => navigation.go(workspace, next)
  const [searchOpen, setSearchOpen] = useState(false)
  const [targetRevision, setTargetRevision] = useState(0)
  const [focusedExpenseId, setFocusedExpenseId] = useState<string>()
  const [scheduleEditing, setScheduleEditing] = useState(false)
  const [batchIds, setBatchIds] = useState<string[]>([])
  const [batchTarget, setBatchTarget] = useState('')
  const [batchError, setBatchError] = useState('')
  const [batchUndo, setBatchUndo] = useState<ScheduleMove>()
  useEffect(() => {
    setBatchIds([])
    setBatchTarget('')
    setBatchError('')
  }, [day, trip.id, scheduleEditing])
  const [expandedStops, setExpandedStops] = useState<string[]>([])
  const [filterState, setFilterState] = useState<{
    day: number
    value: ScheduleFilter
  }>({ day, value: { ...emptyScheduleFilter } })
  useEffect(() => {
    setFilterState({ day, value: { ...emptyScheduleFilter } })
  }, [day, trip.id])
  const scheduleFilter =
    filterState.day === day ? filterState.value : { ...emptyScheduleFilter }
  const setScheduleFilter = (value: ScheduleFilter) => {
    setFilterState({ day, value })
    setBatchIds([])
    setBatchError('')
  }
  const resetScheduleFilter = () =>
    setScheduleFilter({ ...emptyScheduleFilter })
  const [orderOpen, setOrderOpen] = useState(false)
  const [orderUndo, setOrderUndo] = useState<ScheduleOrder>()
  const [orderError, setOrderError] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [timeUndo, setTimeUndo] = useState<TimeAdjustment>()
  const [adjustError, setAdjustError] = useState('')
  useEffect(() => {
    saveJourneyPreference(trip, day, workspace)
  }, [trip.id, day, workspace])
  const mainWorkspace = workspaceGroup(workspace)
  const googleRouting = useGoogleRoutes(
    trip,
    day,
    workspace === 'route' || workspace === 'transfers',
  )
  const planningView = useRef(
    (planningViews as readonly string[]).includes(workspace)
      ? workspace
      : 'schedule',
  )
  const preparationView = useRef(
    (preparationViews as readonly string[]).includes(workspace)
      ? workspace
      : 'overview',
  )
  if (mainWorkspace === 'schedule') planningView.current = workspace
  if (mainWorkspace === 'overview') preparationView.current = workspace
  const [selectedStops, setSelectedStops] = useState<Record<number, string>>({})
  const selectedStop = selectedStops[day] || trip.days[day]?.[0]?.id
  const pendingScroll = useRef<string | undefined>(undefined)
  const pendingTarget = useRef<JourneyTarget | null>(null)
  useEffect(() => {
    const target = pendingTarget.current
    if (
      !target ||
      workspace !== target.workspace ||
      (target.day !== undefined && day !== target.day)
    )
      return
    pendingTarget.current = null
    const attribute = target.reservationId
      ? 'data-reservation-id'
      : target.attachmentId
        ? 'data-attachment-id'
        : target.expenseId
          ? 'data-expense-id'
          : target.checklistId
            ? 'data-checklist-id'
            : workspace === 'transfers'
              ? 'data-transfer-id'
              : 'data-stop-id'
    const id =
      target.reservationId ||
      target.attachmentId ||
      target.expenseId ||
      target.checklistId ||
      target.stopId
    const element = id
      ? Array.from(
          document.querySelectorAll<HTMLElement>(`[${attribute}]`),
        ).find((item) => item.getAttribute(attribute) === id)
      : document.getElementById('workspace-panel')
    element?.scrollIntoView({ block: 'center', behavior: 'instant' })
    element?.focus({ preventScroll: true })
  }, [workspace, day, targetRevision])
  const locate = (target: JourneyTarget) => {
    if (target.workspace === 'schedule') resetScheduleFilter()
    if (target.stopId)
      setExpandedStops((items) => [...new Set([...items, target.stopId!])])
    setFocusedExpenseId(target.expenseId)
    setTargetRevision((value) => value + 1)
    pendingTarget.current = target
    if (target.day !== undefined) {
      if (target.stopId)
        setSelectedStops((previous) => ({
          ...previous,
          [target.day!]: target.stopId!,
        }))
    }
    navigation.go(target.workspace, target.day ?? day)
  }
  const handledReturn = useRef(scheduleReturn?.revision)
  useEffect(() => {
    if (
      !scheduleReturn ||
      scheduleReturn.tripId !== trip.id ||
      handledReturn.current === scheduleReturn.revision
    )
      return
    handledReturn.current = scheduleReturn.revision
    locate({ workspace: 'schedule', day: scheduleReturn.day })
  }, [scheduleReturn])
  useEffect(() => {
    if (workspace !== 'schedule' || !pendingScroll.current) return
    const id = pendingScroll.current
    pendingScroll.current = undefined
    const element = Array.from(
      document.querySelectorAll<HTMLElement>('[data-stop-id]'),
    ).find((el) => el.dataset.stopId === id)
    element?.scrollIntoView({ block: 'center', behavior: 'instant' })
    element?.focus({ preventScroll: true })
  }, [workspace, day])
  const showMap = (id: string) => {
    setSelectedStops((previous) => ({ ...previous, [day]: id }))
    setWorkspace('route')
  }
  const showInList = (id: string) => {
    resetScheduleFilter()
    setExpandedStops((items) => [...new Set([...items, id])])
    setSelectedStops((previous) => ({ ...previous, [day]: id }))
    pendingScroll.current = id
    setWorkspace('schedule')
  }
  const legs = dayTransferLegs(trip, day)
  const travelWarnings = legs.filter((leg) => leg.lateMinutes).length

  const conflicts = timeConflicts(trip, day)
  const recordExpense = onQuickExpense
  const [removed, setRemoved] = useState<{
    stop: Stop
    day: number
    index: number
  } | null>(null)
  const stops = trip.days[day] || []
  const daySummary = scheduleSummary(trip, day)
  const visibleStops = stops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => matchesSchedule(trip, stop, scheduleFilter))
  const changeOrder = (change: ScheduleOrder) => {
    onUpdate(applyScheduleOrder(trip, change))
    setOrderUndo(change)
    setOrderError('')
  }

  const updateStop = (id: string, change: Partial<Stop>) =>
    onUpdate({
      ...trip,
      days: trip.days.map((items, index) =>
        index === day
          ? items.map((stop) =>
              stop.id === id ? { ...stop, ...change } : stop,
            )
          : items,
      ),
    })
  const removeStop = (id: string) => {
    const index = stops.findIndex((stop) => stop.id === id)
    if (index >= 0) setRemoved({ stop: stops[index], day, index })
    onUpdate({
      ...trip,
      days: trip.days.map((items, index) =>
        index === day ? items.filter((stop) => stop.id !== id) : items,
      ),
    })
  }
  const moveToDay = (stop: Stop, target: number) => {
    if (
      target === day ||
      !trip.days[target] ||
      trip.days[target].some((item) => sameStopPlace(item, stop)) ||
      trip.days[target].length >= 200
    )
      return
    onUpdate({
      ...trip,
      days: trip.days.map((items, index) =>
        index === day
          ? items.filter((item) => item.id !== stop.id)
          : index === target
            ? [...items, stop]
            : items,
      ),
    })
    onDayChange(target)
  }
  const moveStop = (index: number, direction: number) => {
    if (index + direction < 0 || index + direction >= stops.length) return
    const updated = stops.map((stop) => stop.id)
    ;[updated[index], updated[index + direction]] = [
      updated[index + direction],
      updated[index],
    ]
    changeOrder({ day, before: stops.map((stop) => stop.id), after: updated })
  }
  return (
    <AttachmentsContext.Provider
      value={{
        files: trip.attachments || [],
        add: (files) =>
          onAttachmentsChange((current) =>
            [
              ...current,
              ...files.filter(
                (file) => !current.some((item) => item.id === file.id),
              ),
            ].slice(0, 300),
          ),
        remove: (id) =>
          onAttachmentsChange((current) =>
            current.filter((file) => file.id !== id),
          ),
        isShared: isAttachmentShared,
        coverFor: (id) =>
          trip.days.flat().find((stop) => stop.id === id)?.photoId,
        setCover: (stopId, id) => {
          if (
            !trip.attachments?.some(
              (file) =>
                file.id === id &&
                file.stopId === stopId &&
                file.mimeType.startsWith('image/'),
            )
          )
            return
          onUpdate({
            ...trip,
            days: trip.days.map((items) =>
              items.map((stop) =>
                stop.id === stopId ? { ...stop, photoId: id } : stop,
              ),
            ),
          })
        },
      }}
    >
      <div className={`itinerary ${workspace === 'field' ? 'is-field' : ''}`}>
        <div
          className="trip-banner"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(12,36,31,.86),rgba(12,36,31,.3)), url(${bundledImage(cityCover)})`,
          }}
        >
          <div className="trip-header-copy">
            <span className="trip-country">
              {city.country} · {city.name}
            </span>
            <h2>{trip.title}</h2>
            <div className="trip-facts">
              <span>
                <CalendarDays size={15} />
                {formatDate(trip.startDate)} – {formatDate(trip.endDate)}
              </span>
              <span>
                <Users size={15} />
                {trip.travelers === 1
                  ? '나 혼자'
                  : `동행 ${trip.travelers - 1}명`}
              </span>
              <span>{trip.days.length}일</span>
            </div>
          </div>
          <div className="trip-banner-controls">
            <button
              className="icon-button trip-find"
              aria-label="여행 내 찾기"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
            </button>
            <button
              className="icon-button trip-edit"
              aria-label="여행 정보 수정"
              onClick={onEditTrip}
            >
              <Pencil size={18} />
            </button>
            <button
              className="icon-button trip-delete"
              onClick={onDeleteTrip}
              aria-label="여행 삭제"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <nav className="trip-quick-links" aria-label="여행 도구 바로가기">
          <button onClick={() => setWorkspace('reservations')}>
            <Ticket size={16} />
            항공·숙소 예약
          </button>
          <button onClick={() => setWorkspace('checklist')}>
            <CheckSquare size={16} />
            준비물
          </button>
          <button onClick={() => setWorkspace('expenses')}>
            <Wallet size={16} />
            가계부
          </button>
          <button onClick={() => setWorkspace('route')}>
            <MapPin size={16} />
            지도
          </button>
        </nav>
        <div className="workspace-tabs" role="tablist" aria-label="여행 관리">
          {[
            ['schedule', '일정'],
            ['field', '여행 중'],
            ['overview', '여행 준비'],
            ['expenses', '가계부'],
          ].map(([id, label]) => (
            <button
              key={id}
              id={`workspace-${id}`}
              role="tab"
              aria-controls="workspace-panel"
              aria-selected={mainWorkspace === id}
              onClick={() => {
                navigation.go(
                  id === 'schedule'
                    ? planningView.current
                    : id === 'overview'
                      ? preparationView.current
                      : id,
                  id === 'field' ? (travelDay(trip) ?? day) : day,
                )
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <ReservationConflicts
          trip={trip}
          onOpen={() => setWorkspace('reservations')}
        />
        <div
          className={`workspace-content workspace-${workspace}`}
          id="workspace-panel"
          role="tabpanel"
          tabIndex={-1}
          aria-labelledby={`workspace-${mainWorkspace}`}
        >
          {mainWorkspace === 'schedule' && (
            <div
              className="workspace-view-switch"
              role="group"
              aria-label="일정 보기"
            >
              {[
                ['schedule', '일정 목록'],
                ['route', '지도·동선'],
                ['transfers', '이동시간'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className="button outline small"
                  aria-label={label}
                  aria-pressed={workspace === id}
                  onClick={() => setWorkspace(id)}
                >
                  {label}
                  {id === 'transfers' && travelWarnings > 0 && (
                    <span className="travel-warning-count" aria-hidden="true">
                      {travelWarnings}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {mainWorkspace === 'overview' && (
            <div
              className="workspace-view-switch"
              role="group"
              aria-label="준비 관리"
            >
              {[
                ['overview', '요약'],
                ['reservations', '예약'],
                ['checklist', '준비물'],
                ['files', '자료'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className="button outline small"
                  aria-pressed={workspace === id}
                  onClick={() => setWorkspace(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {workspace === 'field' && (
            <FieldJourney
              onReservation={(id) =>
                locate({ workspace: 'reservations', reservationId: id })
              }
              trip={trip}
              day={day}
              onDay={onDayChange}
              onUpdate={onUpdate}
              onOpen={setWorkspace}
              onAdd={onAdd}
              onExpense={recordExpense}
              onPlace={onOpen}
            />
          )}
          {workspace === 'overview' && (
            <TripDashboard
              onLocate={locate}
              trip={trip}
              day={day}
              onUpdate={onUpdate}
              onOpen={(next, nextDay) => {
                navigation.go(next, nextDay ?? day)
              }}
              onExpense={() => recordExpense()}
            />
          )}
          {mainWorkspace === 'schedule' && (
            <>
              <DayNavigation trip={trip} day={day} onDay={onDayChange} />
              {workspace === 'transfers' ? (
                <DayTransfers trip={trip} day={day} routing={googleRouting} />
              ) : workspace === 'route' ? (
                <DayRoute
                  routing={googleRouting}
                  selectedId={selectedStop}
                  onSelect={(id) =>
                    setSelectedStops((previous) => ({ ...previous, [day]: id }))
                  }
                  onShowStop={showInList}
                  trip={trip}
                  day={day}
                  onUpdate={onUpdate}
                  onEdit={(id) => onCustom(id)}
                  onAdd={onAdd}
                />
              ) : (
                <div
                  className={`day-content timeline-workspace ${scheduleEditing ? 'timeline-editing' : 'timeline-reading'}`}
                  role="tabpanel"
                  id="day-panel"
                  aria-labelledby={`day-tab-${day}`}
                >
                  <div className="section-heading timeline-day-heading">
                    <div>
                      <h3>
                        <span>DAY {day + 1}</span>{' '}
                        <time dateTime={dateAt(trip.startDate, day)}>
                          {formatDate(dateAt(trip.startDate, day), true)}
                        </time>
                        <small className="timeline-city">
                          {destinationForDay(trip, day).name}
                        </small>
                      </h3>
                    </div>
                    <div className="day-add-actions">
                      <button
                        className="text-button"
                        aria-label="일정 목록 편집"
                        aria-pressed={scheduleEditing}
                        onClick={() => {
                          setScheduleEditing((value) => !value)
                          setExpandedStops([])
                        }}
                      >
                        {scheduleEditing ? '편집 완료' : '편집'}
                      </button>
                    </div>
                  </div>
                  {scheduleEditing && (
                    <div className="timeline-edit-tools">
                      <button
                        className="button outline small"
                        onClick={() => setAdjustOpen(true)}
                        disabled={!stops.length}
                      >
                        시간 변경
                      </button>
                    </div>
                  )}
                  {scheduleEditing &&
                    trip.days.length > 1 &&
                    stops.length > 0 && (
                      <section
                        className="schedule-batch"
                        aria-label="선택한 일정 관리"
                      >
                        <div className="schedule-batch-heading">
                          <strong>{batchIds.length}개 선택</strong>
                          <button
                            className="text-button"
                            onClick={() => {
                              setBatchIds(
                                batchIds.length
                                  ? []
                                  : visibleStops.map(({ stop }) => stop.id),
                              )
                              setBatchError('')
                            }}
                          >
                            {batchIds.length
                              ? '선택 해제'
                              : '보이는 일정 모두 선택'}
                          </button>
                        </div>
                        <div className="schedule-batch-actions">
                          <select
                            aria-label="선택한 일정 옮길 날짜"
                            value={batchTarget}
                            onChange={(e) => {
                              setBatchTarget(e.target.value)
                              setBatchError('')
                            }}
                          >
                            <option value="">옮길 날짜</option>
                            {trip.days.map(
                              (_, index) =>
                                index !== day && (
                                  <option key={index} value={index}>
                                    DAY {index + 1} ·{' '}
                                    {formatDate(dateAt(trip.startDate, index))}{' '}
                                    · {destinationForDay(trip, index).name}
                                  </option>
                                ),
                            )}
                          </select>
                          <button
                            className="button outline small"
                            disabled={!batchIds.length || batchTarget === ''}
                            onClick={() => {
                              try {
                                const target = Number(batchTarget)
                                const next = moveScheduleStops(
                                  trip,
                                  day,
                                  target,
                                  batchIds,
                                )
                                setBatchUndo(
                                  scheduleMoveRecord(
                                    trip,
                                    next,
                                    day,
                                    target,
                                    batchIds,
                                  ),
                                )
                                onUpdate(next)
                                setBatchIds([])
                                setBatchError('')
                                onDayChange(target)
                              } catch (error) {
                                setBatchError((error as Error).message)
                              }
                            }}
                          >
                            날짜로 이동
                          </button>
                        </div>
                        {batchError && (
                          <p className="form-error" role="alert">
                            {batchError}
                          </p>
                        )}
                      </section>
                    )}
                  {batchUndo && (
                    <div className="undo-strip" role="status">
                      {batchUndo.ids.length}개 일정을 DAY {batchUndo.to + 1}로
                      옮겼어요.
                      <button
                        onClick={() => {
                          try {
                            onUpdate(undoScheduleMove(trip, batchUndo))
                            onDayChange(batchUndo.from)
                            setBatchUndo(undefined)
                            setBatchError('')
                          } catch (error) {
                            setBatchError((error as Error).message)
                          }
                        }}
                      >
                        날짜 이동 되돌리기
                      </button>
                      {batchError && !scheduleEditing && (
                        <p role="alert">{batchError}</p>
                      )}
                    </div>
                  )}
                  {orderUndo && (
                    <div className="undo-strip" role="status">
                      DAY {orderUndo.day + 1} · 방문 순서를 변경했어요.
                      <button
                        onClick={() => {
                          try {
                            onUpdate(applyScheduleOrder(trip, orderUndo, true))
                            setOrderError('')
                          } catch (reason) {
                            setOrderError((reason as Error).message)
                          }
                          setOrderUndo(undefined)
                        }}
                      >
                        순서 변경 되돌리기
                      </button>
                    </div>
                  )}
                  {orderError && (
                    <p className="form-error" role="alert">
                      {orderError}
                    </p>
                  )}
                  {stops.length > 0 && (
                    <div className="day-progress">
                      <span>
                        {daySummary.done}/{daySummary.planned + daySummary.done}{' '}
                        방문 완료
                      </span>
                      <progress
                        aria-label="이날의 방문 진행률"
                        value={daySummary.done}
                        max={Math.max(1, daySummary.planned + daySummary.done)}
                      />
                    </div>
                  )}
                  {timeUndo && (
                    <div className="undo-strip" role="status">
                      DAY {timeUndo.day + 1} · {timeUndo.changes.length}곳
                      시간을 변경했어요.
                      <button
                        onClick={() => {
                          try {
                            onUpdate(applyTimeAdjustment(trip, timeUndo, true))
                            setTimeUndo(undefined)
                            setAdjustError('')
                          } catch (reason) {
                            setAdjustError((reason as Error).message)
                            setTimeUndo(undefined)
                          }
                        }}
                      >
                        시간 변경 되돌리기
                      </button>
                    </div>
                  )}
                  {adjustError && (
                    <p className="form-error" role="alert">
                      {adjustError}
                    </p>
                  )}
                  {conflicts.length > 0 && (
                    <details className="time-conflicts">
                      <summary>시간이 겹치는 일정 {conflicts.length}건</summary>
                      {conflicts.slice(0, 10).map((item, index) => (
                        <p key={index}>
                          {item.first} · {item.second}
                        </p>
                      ))}
                    </details>
                  )}
                  {scheduleEditing && stops.length > 1 && (
                    <div className="schedule-sort">
                      <span>
                        {stops.some(
                          (stop, index) =>
                            index > 0 &&
                            !!stop.time &&
                            !!stops[index - 1].time &&
                            stops[index - 1].time > stop.time,
                        )
                          ? '방문 순서와 시간이 달라요'
                          : `오늘 ${stops.length}개의 일정`}
                      </span>
                      <div className="schedule-sort-actions">
                        <button
                          className="button outline small"
                          onClick={() => setOrderOpen(true)}
                        >
                          순서 편집
                        </button>
                        <button
                          className="text-button"
                          onClick={() =>
                            changeOrder({
                              day,
                              before: stops.map((stop) => stop.id),
                              after: [...stops]
                                .sort((a, b) =>
                                  !a.time
                                    ? b.time
                                      ? 1
                                      : 0
                                    : !b.time
                                      ? -1
                                      : a.time.localeCompare(b.time),
                                )
                                .map((stop) => stop.id),
                            })
                          }
                        >
                          시간순 정렬 <ArrowDown size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  {stops.length === 0 ? (
                    <EmptyState
                      icon={<MapIcon size={32} />}
                      title="아직 비어 있는 하루"
                      description="가고 싶은 곳을 더해 나만의 하루를 만들어보세요."
                      action="장소 추가"
                      onAction={onAdd}
                    />
                  ) : (
                    <div className="timeline">
                      {!visibleStops.length && (
                        <div className="schedule-empty-results" role="status">
                          <p>조건에 맞는 일정이 없어요.</p>
                          <button
                            className="button outline"
                            onClick={resetScheduleFilter}
                          >
                            모든 일정 보기
                          </button>
                        </div>
                      )}
                      {visibleStops.map(({ stop, index }) => {
                        const place = stopDetails(stop)
                        const Icon =
                          categoryIcon[
                            place.category as keyof typeof categoryIcon
                          ] || MapPin
                        return (
                          <article
                            data-stop-id={stop.id}
                            tabIndex={-1}
                            data-category={place.category}
                            className={`timeline-item ${selectedStop === stop.id ? 'stop-selected' : ''} ${stop.status === 'done' ? 'stop-completed' : stop.status === 'skipped' || cancelledReservation(trip, stop) ? 'stop-skipped' : ''}`}
                            key={stop.id}
                          >
                            <TimelineRail
                              trip={trip}
                              stop={stop}
                              index={index}
                              distance={timelineDistance(
                                trip,
                                day,
                                stop,
                                visibleStops.map((item) => item.stop.id),
                                legs,
                              )}
                            />
                            <div
                              className={`stop-card ${!scheduleEditing && !expandedStops.includes(stop.id) ? 'stop-condensed' : ''}`}
                            >
                              {
                                <button
                                  className="text-button stop-expand"
                                  aria-expanded={
                                    scheduleEditing ||
                                    expandedStops.includes(stop.id)
                                  }
                                  aria-label={`${place.name} 일정 상세 펼치기`}
                                  onClick={() =>
                                    setExpandedStops((items) =>
                                      items.includes(stop.id)
                                        ? items.filter((id) => id !== stop.id)
                                        : [...items, stop.id],
                                    )
                                  }
                                >
                                  {expandedStops.includes(stop.id)
                                    ? '접기'
                                    : '편집'}
                                </button>
                              }
                              {scheduleEditing && trip.days.length > 1 && (
                                <label className="schedule-pick-stop">
                                  <input
                                    type="checkbox"
                                    aria-label={`${place.name} 일정 선택`}
                                    checked={batchIds.includes(stop.id)}
                                    onChange={(e) => {
                                      setBatchIds((ids) =>
                                        e.target.checked
                                          ? [...ids, stop.id]
                                          : ids.filter((id) => id !== stop.id),
                                      )
                                      setBatchError('')
                                    }}
                                  />
                                  일정 선택
                                </label>
                              )}
                              <div className="stop-top">
                                <input
                                  className="stop-time"
                                  type="time"
                                  value={stop.time}
                                  aria-label={`${place.name} 방문 시간`}
                                  onChange={(event) => {
                                    updateStop(stop.id, {
                                      time: event.target.value,
                                    })
                                  }}
                                />
                                <span className="stop-category">
                                  <Icon size={13} />
                                  {place.category}
                                </span>
                                <div className="stop-actions">
                                  <button
                                    className="icon-button"
                                    aria-label={`${place.name} 지도에서 보기`}
                                    onClick={() => showMap(stop.id)}
                                  >
                                    <MapIcon size={16} />
                                  </button>
                                  <button
                                    className="icon-button"
                                    disabled={index === 0}
                                    aria-label={`${place.name} 위로 이동`}
                                    onClick={() => moveStop(index, -1)}
                                  >
                                    <ArrowUp size={16} />
                                  </button>
                                  <button
                                    className="icon-button"
                                    disabled={index === stops.length - 1}
                                    aria-label={`${place.name} 아래로 이동`}
                                    onClick={() => moveStop(index, 1)}
                                  >
                                    <ArrowDown size={16} />
                                  </button>
                                  <button
                                    className="icon-button"
                                    aria-label={`${place.name} 일정에서 삭제`}
                                    onClick={() => removeStop(stop.id)}
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                              <div className="stop-place">
                                <PlacePhoto stop={stop} alt={place.name} />
                                <button
                                  onClick={() =>
                                    stop.custom
                                      ? onCustom(stop.id)
                                      : onOpen(place.id)
                                  }
                                >
                                  <strong>{place.name}</strong>
                                  <span className="timeline-card-category">
                                    {place.category}
                                  </span>
                                  <span className="stop-city-name">
                                    {stop.custom
                                      ? tripDestinations(trip).find(
                                          (destination) =>
                                            destination.id ===
                                            stop.custom!.destinationId,
                                        )?.name
                                      : getCity(getPlace(stop.placeId)!.cityId)
                                          ?.name}
                                  </span>
                                  <span>
                                    <MapPin size={12} />
                                    {place.address}
                                  </span>
                                </button>
                                <ChevronRight size={18} />
                              </div>

                              <ScheduleStopInfo
                                trip={trip}
                                stop={stop}
                                day={day}
                                onLocate={locate}
                              />
                              <PlaceSource stop={stop} />
                              <a
                                className="custom-stop-link"
                                href={
                                  (stop.custom &&
                                    googleMapsLink(stop.custom.link)) ||
                                  mapsSearch(mapQuery(stop, trip))
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                지도 열기 <ExternalLink size={14} />
                              </a>
                              {stop.custom?.link &&
                                !googleMapsLink(stop.custom.link) && (
                                  <a
                                    className="custom-stop-link"
                                    href={stop.custom.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    관련 링크 열기 <ExternalLink size={14} />
                                  </a>
                                )}
                              <details className="stop-photos">
                                <summary>장소 사진</summary>
                                <AttachmentsPanel stopId={stop.id} imagesOnly />
                              </details>
                              <div className="stop-progress-actions">
                                <button
                                  className="button outline small"
                                  aria-label={`${place.name} ${stop.status === 'done' ? '완료 취소' : '방문 완료'}`}
                                  aria-pressed={stop.status === 'done'}
                                  disabled={cancelledReservation(trip, stop)}
                                  onClick={() =>
                                    updateStop(stop.id, {
                                      status:
                                        stop.status === 'done'
                                          ? 'planned'
                                          : 'done',
                                    })
                                  }
                                >
                                  <Check size={15} />
                                  {stop.status === 'done'
                                    ? '완료 취소'
                                    : '방문 완료'}
                                </button>
                                <button
                                  className="text-button"
                                  aria-label={`${place.name} 지출 기록`}
                                  onClick={() => recordExpense(stop)}
                                >
                                  지출 기록
                                </button>
                                {cancelledReservation(trip, stop) && (
                                  <span className="reservation-cancelled">
                                    취소한 예약
                                  </span>
                                )}
                                {stop.status === 'skipped' && (
                                  <span>건너뜀</span>
                                )}
                              </div>
                              <details className="stop-edit-details">
                                <summary>
                                  메모·날짜 변경
                                  {stop.note
                                    ? ` · ${stop.note.slice(0, 24)}`
                                    : ''}
                                </summary>
                                <div className="form-row stop-extra-fields">
                                  <label className="field">
                                    방문 상태
                                    <select
                                      aria-label={`${place.name} 방문 상태`}
                                      value={stop.status || 'planned'}
                                      onChange={(event) =>
                                        updateStop(stop.id, {
                                          status: event.target
                                            .value as Stop['status'],
                                        })
                                      }
                                    >
                                      <option value="planned">방문 예정</option>
                                      <option value="done">방문 완료</option>
                                      <option value="skipped">건너뛰기</option>
                                    </select>
                                  </label>
                                  <label className="field">
                                    예상 체류 시간 · 분
                                    <DurationInput
                                      label={`${place.name} 예상 체류 시간`}
                                      value={stop.durationMinutes}
                                      onChange={(value) =>
                                        updateStop(stop.id, {
                                          durationMinutes: value,
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                                {trip.days.length > 1 && (
                                  <label className="stop-day-move">
                                    <CalendarDays size={15} /> 날짜 이동
                                    <select
                                      aria-label={`${place.name} 이동할 날짜`}
                                      value={day}
                                      onChange={(event) =>
                                        moveToDay(
                                          stop,
                                          Number(event.target.value),
                                        )
                                      }
                                    >
                                      {trip.days.map((items, index) => {
                                        const duplicate =
                                          index !== day &&
                                          items.some((item) =>
                                            sameStopPlace(item, stop),
                                          )
                                        return (
                                          <option
                                            key={index}
                                            value={index}
                                            disabled={
                                              duplicate || items.length >= 200
                                            }
                                          >
                                            DAY {index + 1} ·{' '}
                                            {formatDate(
                                              dateAt(trip.startDate, index),
                                            )}
                                            {duplicate
                                              ? ' · 이미 추가됨'
                                              : items.length >= 200
                                                ? ' · 200곳 가득 참'
                                                : ''}
                                          </option>
                                        )
                                      })}
                                    </select>
                                  </label>
                                )}
                                <label className="stop-note">
                                  <Bookmark size={14} />
                                  <textarea
                                    rows={2}
                                    placeholder="기억할 것, 먹고 싶은 것… 메모를 남겨보세요"
                                    aria-label={`${place.name} 메모`}
                                    maxLength={2000}
                                    value={stop.note}
                                    onChange={(event) =>
                                      updateStop(stop.id, {
                                        note: event.target.value,
                                      })
                                    }
                                  />
                                </label>
                              </details>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                  {stops.length > 0 && (
                    <button
                      className="button primary full schedule-add-bottom"
                      onClick={onAdd}
                    >
                      <Plus size={16} />
                      장소 추가
                    </button>
                  )}
                  {removed && (
                    <div className="undo-strip" role="status">
                      일정에서 삭제했어요.
                      <button
                        disabled={
                          !trip.days[removed.day] ||
                          trip.days[removed.day].some(
                            (stop) => stop.placeId === removed.stop.placeId,
                          )
                        }
                        onClick={() => {
                          onUpdate({
                            ...trip,
                            days: trip.days.map((items, index) =>
                              index === removed.day
                                ? [
                                    ...items.slice(0, removed.index),
                                    removed.stop,
                                    ...items.slice(removed.index),
                                  ]
                                : items,
                            ),
                          })
                          setRemoved(null)
                        }}
                      >
                        실행 취소
                      </button>
                    </div>
                  )}
                </div>
              )}
              <details className="simple-options trip-more">
                <summary>여행 더보기</summary>
                <JourneyRoute trip={trip} day={day} onUpdate={onUpdate} />
                <TripOverview trip={trip} onDay={onDayChange} />
                <JourneyShare trip={trip} day={day} />
              </details>
            </>
          )}
          {workspace === 'files' && (
            <div className="workspace-panel">
              <AttachmentsPanel key={targetRevision} all trip={trip} />
            </div>
          )}
          {workspace === 'reservations' && (
            <Reservations
              day={day}
              key={targetRevision}
              trip={trip}
              onUpdate={onUpdate}
            />
          )}
          {workspace === 'checklist' && (
            <Checklist key={targetRevision} trip={trip} onUpdate={onUpdate} />
          )}
          {workspace === 'expenses' && (
            <Expenses
              onQuickAdd={() => onQuickExpense()}
              day={day}
              key={targetRevision}
              focusExpenseId={focusedExpenseId}
              trip={trip}
              onUpdate={onUpdate}
            />
          )}
          {searchOpen && (
            <TripSearch
              trip={trip}
              onClose={() => setSearchOpen(false)}
              onLocate={locate}
            />
          )}
          {orderOpen && (
            <ScheduleOrderDialog
              key={`${trip.id}:${day}`}
              trip={trip}
              day={day}
              onClose={() => setOrderOpen(false)}
              onApply={changeOrder}
            />
          )}
          {adjustOpen && (
            <DayScheduleAdjust
              trip={trip}
              day={day}
              onClose={() => setAdjustOpen(false)}
              onApply={(value) => {
                onUpdate(applyTimeAdjustment(trip, value))
                setTimeUndo(value)
                setAdjustError('')
              }}
            />
          )}
        </div>
      </div>
    </AttachmentsContext.Provider>
  )
}

export default function App() {
  const [scheduleReturn, setScheduleReturn] = useState<{
    tripId: string
    day: number
    revision: number
  }>()
  const scheduleReturnSequence = useRef(0)
  useGuideCatalog()
  useEffect(startContentUpdates, [])
  const { store, setStore, storageError } = useTravelStore()
  const attachmentStoreRef = useRef(store)
  attachmentStoreRef.current = store
  const [page, setPage] = useState<Page>('home')
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState<Region>('전체')
  const [category, setCategory] = useState<string>('전체')
  const [exploreCity, setExploreCity] = useState('전체')
  const [placeLimit, setPlaceLimit] = useState(24)
  const [exploreTab, setExploreTab] = useState<'cities' | 'places'>('cities')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const closeDialog = () => setDialog(null)
  useEffect(() => setInfoOpen(false), [page, dialog])

  const [toast, setToast] = useState('')
  const [reminderRevision, setReminderRevision] = useState(0)
  const [activeTripId, setActiveTripId] = useState(() => {
    try {
      const previous = localStorage.getItem('jdo-active-trip-v1')
      if (store.trips.some((trip) => trip.id === previous)) return previous!
    } catch {
      /* Viewing trips still works without storage access. */
    }
    return store.trips.at(-1)?.id ?? ''
  })
  const bottomNav = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = bottomNav.current
    if (!nav) return
    const measure = () =>
      document.documentElement.style.setProperty(
        '--jido-bottom-nav-height',
        `${layoutHeight(nav)}px`,
      )
    const observer = new ResizeObserver(measure)
    // Android gesture insets change padding, so observe the whole bar.
    observer.observe(nav, { box: 'border-box' })
    measure()
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const [activeDay, setActiveDay] = useState(() => {
    const trip = store.trips.find((item) => item.id === activeTripId)
    return trip ? journeyPreference(trip).day : 0
  })
  useTravelReminders(store.trips, (target) => {
    const trip = attachmentStoreRef.current.trips.find(
      (item) => item.id === target.tripId,
    )
    if (!trip) return
    const day = Math.max(0, Math.min(trip.days.length - 1, target.day))
    saveJourneyPreference(trip, day, target.workspace)
    setActiveTripId(trip.id)
    setActiveDay(day)
    setReminderRevision((value) => value + 1)
    setDialog(null)
    setInfoOpen(false)
    setPage('trips')
    window.scrollTo(0, 0)
  })
  const navigationRef = useRef({ page, dialog, closeDialog, infoOpen })
  navigationRef.current = { page, dialog, closeDialog, infoOpen }
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const showHome = () => {
      setDialog(null)
      setInfoOpen(false)
      setToast('')
      setPage('home')
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('jido:launcher-open', showHome)
    return () => window.removeEventListener('jido:launcher-open', showHome)
  }, [])
  useEffect(() => {
    const handleBack = () => {
      const preview = Array.from(
        document.querySelectorAll(
          'dialog.attachment-preview[open], dialog.address-dialog[open], dialog.trip-search-dialog[open], dialog.day-adjust-dialog[open]',
        ),
      ).at(-1)
      if (preview) {
        preview.dispatchEvent(new Event('cancel', { cancelable: true }))
        return
      }
      if (navigationRef.current.infoOpen) {
        setInfoOpen(false)
        document.getElementById('app-information-toggle')?.focus()
        return
      }
      if (navigationRef.current.dialog) navigationRef.current.closeDialog()
      else if (
        !window.dispatchEvent(new Event('jido:trip-back', { cancelable: true }))
      )
        return
      else if (navigationRef.current.page !== 'home') setPage('home')
      else if (Capacitor.isNativePlatform()) void NativeApp.exitApp()
    }
    window.addEventListener('jido:back', handleBack)
    const listener = Capacitor.isNativePlatform()
      ? NativeApp.addListener('backButton', handleBack)
      : undefined
    return () => {
      window.removeEventListener('jido:back', handleBack)
      void listener?.then((handle) => handle.remove())
    }
  }, [])
  const navigate = (target: Page) => {
    setInfoOpen(false)
    setPage(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openCity = (id: string) => {
    setDialog({ type: 'city', id })
  }
  const openPlace = (id: string) => {
    setDialog({ type: 'place', id })
  }
  const search = (event: FormEvent) => {
    event.preventDefault()
    setRegion('전체')
    setCategory('전체')
    setExploreCity('전체')
    setExploreTab(
      cities.some((city) => matchesCity(city, query)) ? 'cities' : 'places',
    )
    navigate('explore')
  }
  const createTrip = (trip: Trip) => {
    setStore((previous) => ({ ...previous, trips: [...previous.trips, trip] }))
    setActiveTripId(trip.id)
    setActiveDay(0)
    setDialog(null)
    navigate('trips')
    setToast('새로운 여행이 시작됐어요!')
  }
  const updateTrip = (trip: Trip) =>
    setStore((previous) => ({
      ...previous,
      trips: previous.trips.map((item) => (item.id === trip.id ? trip : item)),
    }))
  const addStop = (
    tripId: string,
    day: number,
    placeId: string,
    close = true,
  ) => {
    const trip = store.trips.find((item) => item.id === tripId)
    if (
      !trip ||
      !trip.days[day] ||
      !tripDestinations(trip).some(
        (destination) => destination.guideCityId === getPlace(placeId)?.cityId,
      )
    )
      return
    if (
      destinationForDay(trip, day).guideCityId !== getPlace(placeId)?.cityId
    ) {
      setToast('장소와 같은 도시로 지정한 날짜를 선택해 주세요.')
      return
    }
    if (
      trip.days[day].some((stop) =>
        sameStopPlace(stop, {
          id: 'candidate',
          placeId,
          time: '',
          note: '',
        }),
      )
    ) {
      setToast('이날 일정에 이미 있는 장소예요.')
      return
    }
    if (trip.days[day].length >= 200) {
      setToast('하루 일정은 최대 200곳까지 담을 수 있어요.')
      return
    }
    const stop: Stop = {
      id: crypto.randomUUID(),
      placeId,
      time: '',
      note: '',
    }
    updateTrip({
      ...trip,
      days: trip.days.map((items, index) =>
        index === day ? [...items, stop] : items,
      ),
    })
    if (close) {
      setDialog(null)
      setActiveTripId(trip.id)
      setActiveDay(day)
      navigate('trips')
    }
    setToast(close ? '일정에 장소를 추가했어요.' : '')
  }
  const addRegisteredPlace = (
    place: CustomPlace,
    tripId: string,
    day: number,
    close = true,
  ) => {
    const trip = attachmentStoreRef.current.trips.find(
      (item) => item.id === tripId,
    )
    if (!trip || !trip.days[day]) return
    const custom = { ...place, destinationId: destinationForDay(trip, day).id }
    if (
      trip.days[day].some(
        (stop) =>
          stop.custom &&
          registeredPlaceKey(stop.custom) === registeredPlaceKey(custom),
      )
    ) {
      setToast('이날 일정에 이미 있는 장소예요.')
      return
    }
    if (trip.days[day].length >= 200) {
      setToast('하루 일정은 최대 200곳까지 담을 수 있어요.')
      return
    }
    updateTrip({
      ...trip,
      days: trip.days.map((items, index) =>
        index === day
          ? [
              ...items,
              {
                id: crypto.randomUUID(),
                placeId: `custom-${crypto.randomUUID()}`,
                time: '',
                note: '',
                custom,
              },
            ]
          : items,
      ),
    })
    setActiveTripId(trip.id)
    setActiveDay(day)
    if (close) {
      setDialog(null)
      navigate('trips')
    }
    setToast(close ? '일정에 장소를 추가했어요.' : '')
  }
  const registered = registeredPlaces(store.trips)
  const startNewPlace = () => {
    if (activeTrip)
      setDialog({
        type: 'custom',
        tripId: activeTrip.id,
        day: Math.min(activeDay, activeTrip.days.length - 1),
        initialName: query.trim(),
      })
    else
      setDialog({
        type: 'create',
        cityId: 'custom',
        pendingPlaceName: query.trim(),
      })
  }
  const filteredCities = cities.filter(
    (city) =>
      (region === '전체' || city.region === region) && matchesCity(city, query),
  )
  const exploreCityOptions = cities.filter(
    (city) => region === '전체' || city.region === region,
  )
  const effectiveExploreCity = exploreCityOptions.some(
    (city) => city.id === exploreCity,
  )
    ? exploreCity
    : '전체'
  const filteredRegistered = registered.filter((entry) => {
    const city = entry.destination.guideCityId
      ? getCity(entry.destination.guideCityId)
      : undefined
    return (
      (region === '전체' || city?.region === region) &&
      (category === '전체' || entry.custom.kind === category) &&
      (effectiveExploreCity === '전체' ||
        entry.destination.guideCityId === effectiveExploreCity) &&
      matchesRegisteredPlace(entry, query)
    )
  })
  const filteredPlaces = places.filter((place) => {
    const city = getCity(place.cityId)!
    return (
      (region === '전체' || city.region === region) &&
      (category === '전체' || place.category === category) &&
      (effectiveExploreCity === '전체' ||
        place.cityId === effectiveExploreCity) &&
      matchesPlace(place, city, query)
    )
  })
  useEffect(
    () => setPlaceLimit(24),
    [query, region, category, effectiveExploreCity],
  )
  const [homeNow, setHomeNow] = useState(() => new Date())
  useEffect(() => {
    if (page !== 'home') return
    const refresh = () => {
      if (!document.hidden) setHomeNow(new Date())
    }
    refresh()
    const timer = window.setInterval(refresh, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [page])
  const home = homeJourney(store.trips, activeTripId, homeNow)
  const activeTrip =
    store.trips.find((trip) => trip.id === activeTripId) || store.trips[0]
  useEffect(() => {
    try {
      if (activeTrip) localStorage.setItem('jdo-active-trip-v1', activeTrip.id)
      else localStorage.removeItem('jdo-active-trip-v1')
    } catch {
      /* Travel data saving reports its own storage error. */
    }
  }, [activeTrip?.id])
  const cityCards = (items: City[], compact = false) => (
    <div className="city-grid">
      {items.map((city) => (
        <CityCard
          key={city.id}
          city={city}
          compact={compact}

          onOpen={() => openCity(city.id)}
        />
      ))}
    </div>
  )
  const placeCards = (items: Place[]) => (
    <div className="place-grid">
      {items.map((place) => (
        <PlaceCard
          key={place.id}
          place={place}

          onOpen={() => openPlace(place.id)}
        />
      ))}
    </div>
  )

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => navigate('home')}
            aria-label="J★Do 홈"
          >
            <span className="brand-mark">
              J
              <span className="brand-star" aria-hidden="true">
                ★
              </span>
              Do
            </span>
          </button>
          <nav className="desktop-nav" aria-label="주 메뉴">
            {navigation.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? 'active' : ''}
                onClick={() => navigate(item.id)}
              >
                {item.name}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <AppInformation
              open={infoOpen}
              onToggle={() => setInfoOpen((value) => !value)}
              onClose={() => setInfoOpen(false)}
            />
            <button
              className="header-search icon-button"
              aria-label="여행지 검색"
              onClick={() => {
                setQuery('')
                navigate('explore')
              }}
            >
              <Search size={20} />
            </button>
            <button
              className="button outline header-plan"
              onClick={() => setDialog({ type: 'create' })}
            >
              <Plus size={16} />
              여행 만들기
            </button>
          </div>
        </div>
      </header>
      <main className="main">
        {page === 'settings' && (
          <SettingsPage
            onReminders={() => setDialog({ type: 'reminders' })}
            onNearby={() => setDialog({ type: 'nearby' })}
            onPhotoCredits={() => setDialog({ type: 'credits' })}
            onBackup={() => setDialog({ type: 'backup' })}
          />
        )}
        {page === 'home' && (
          <TravelHome
            journey={home}
            onReminders={() => setDialog({ type: 'reminders' })}
            onNearby={() => setDialog({ type: 'nearby' })}
            trips={store.trips}
            cities={cityCards(
              home?.personalized
                ? home.cities
                : ['tokyo', 'osaka', 'kyoto', 'sapporo']
                    .map(getCity)
                    .filter((city): city is City => !!city),
            )}
            places={placeCards(
              home?.personalized
                ? home.recommendations
                : [
                    'tokyo-shibuya',
                    'osaka-dotonbori',
                    'kiyomizu',
                    'sapporo-odori',
                  ]
                    .map(getPlace)
                    .filter((place): place is Place => !!place),
            )}
            placesTitle={
              home?.personalized
                ? `${home.destination.name}에서 더 가볼 곳`
                : '여행에 담아둘 장소'
            }
            onGuide={(id, guideTab) =>
              setDialog({ type: 'city', id, guideTab })
            }
            onCreate={() => setDialog({ type: 'create' })}
            onTrips={() => navigate('trips')}
            onImport={() => setDialog({ type: 'backup' })}
            onExplore={(japan = false, showPlaces = false, cityId) => {
              setQuery('')
              setRegion(japan ? '일본' : '전체')
              setCategory('전체')
              setExploreCity(cityId || '전체')
              if (cityId && home?.personalized) {
                setActiveTripId(home.trip.id)
                setActiveDay(home.day)
              }
              setExploreTab(showPlaces ? 'places' : 'cities')
              navigate('explore')
            }}
            onOpenTrip={(trip, workspace, day) => {
              const preference = journeyPreference(trip)
              const nextDay = day ?? preference.day
              if (workspace) saveJourneyPreference(trip, nextDay, workspace)
              setActiveTripId(trip.id)
              setActiveDay(nextDay)
              navigate('trips')
            }}
            search={
              <form className="home-search" onSubmit={search}>
                <div className="search-label">
                  <Compass size={22} />
                  <span>
                    내 여행,
                    <br />
                    <strong>도시·장소 찾기</strong>
                  </span>
                </div>
                <div className="search-input">
                  <Search size={20} />
                  <input
                    aria-label="도시 또는 나라 검색"
                    placeholder="도시, 나라 또는 가고 싶은 장소"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  {query && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="검색어 지우기"
                      onClick={() => setQuery('')}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button type="submit" className="button primary">
                  여행지 찾기
                  <ArrowRight size={17} />
                </button>
              </form>
            }
          />
        )}
        {page === 'explore' && (
          <section className="page-section">
            <div className="page-title">
              <h1>도시·장소 찾기</h1>
            </div>
            <form
              className="explore-search input-search"
              onSubmit={(event) => event.preventDefault()}
            >
              <Search size={21} />
              <input
                aria-label="여행지와 장소 검색"
                placeholder="도시, 나라, 장소 이름으로 검색하세요"
                value={query}
                onChange={(event) => {
                  const value = event.target.value
                  setQuery(value)
                  if (
                    value.trim() &&
                    !cities.some((city) => matchesCity(city, value))
                  )
                    setExploreTab('places')
                }}
              />
              {query && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label="검색어 지우기"
                  onClick={() => setQuery('')}
                >
                  <X size={18} />
                </button>
              )}
            </form>
            <div className="page-tabs" role="tablist" aria-label="검색 유형">
              <button
                role="tab"
                aria-selected={exploreTab === 'cities'}
                className={exploreTab === 'cities' ? 'active' : ''}
                onClick={() => setExploreTab('cities')}
              >
                여행 도시 <span>{filteredCities.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={exploreTab === 'places'}
                className={exploreTab === 'places' ? 'active' : ''}
                onClick={() => setExploreTab('places')}
              >
                가볼 만한 곳{' '}
                <span>{filteredPlaces.length + filteredRegistered.length}</span>
              </button>
            </div>
            <div className="filter-row">
              {regions.map((item) => (
                <button
                  key={item}
                  className={`filter ${region === item ? 'active' : ''}`}
                  onClick={() => {
                    setRegion(item)
                    setExploreCity('전체')
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            {exploreTab === 'places' && (
              <div className="explore-place-filters">
                <label className="explore-city-filter">
                  도시
                  <select
                    aria-label="가볼 만한 곳의 도시"
                    value={effectiveExploreCity}
                    onChange={(event) => setExploreCity(event.target.value)}
                  >
                    <option value="전체">모든 도시</option>
                    {exploreCityOptions.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name} ·{' '}
                        {
                          places.filter((place) => place.cityId === city.id)
                            .length
                        }
                        곳
                      </option>
                    ))}
                  </select>
                </label>
                <div className="category-row">
                  {categoryOptions.map((item) => (
                    <button
                      className={item === category ? 'active' : ''}
                      key={item}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="result-count">
              {query.trim() && <strong>‘{query.trim()}’ </strong>}총{' '}
              {exploreTab === 'cities'
                ? filteredCities.length
                : filteredPlaces.length + filteredRegistered.length}
              개의 {exploreTab === 'cities' ? '여행지' : '장소'}
            </p>
            {exploreTab === 'places' && filteredRegistered.length > 0 && (
              <div
                className="picker-list registered-explore-list"
                aria-label="직접 등록한 장소 검색 결과"
              >
                {filteredRegistered.map((entry) => (
                  <div className="picker-item" key={entry.key}>
                    <span className="registered-place-icon">
                      <MapPin size={22} />
                    </span>
                    <button
                      type="button"
                      className="picker-place-name"
                      onClick={() =>
                        setDialog({ type: 'registered', key: entry.key })
                      }
                    >
                      <small>
                        {entry.destination.name} · {entry.custom.kind}
                      </small>
                      <strong>{entry.custom.name}</strong>
                      <span>{entry.custom.address}</span>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`${entry.custom.name} 일정에 추가`}
                      onClick={() =>
                        setDialog({ type: 'registered', key: entry.key })
                      }
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {exploreTab === 'cities' ? (
              filteredCities.length ? (
                cityCards(filteredCities)
              ) : (
                <EmptyState
                  icon={<Search size={30} />}
                  title="아직 찾지 못했어요"
                  description={
                    filteredPlaces.length
                      ? `검색어와 일치하는 장소 ${filteredPlaces.length}곳이 있어요.`
                      : '가이드가 없는 도시도 이름을 직접 입력해 여행을 시작할 수 있어요.'
                  }
                  action={
                    filteredPlaces.length
                      ? '일치하는 장소 보기'
                      : '직접 입력해 여행 만들기'
                  }
                  onAction={() =>
                    filteredPlaces.length
                      ? setExploreTab('places')
                      : setDialog({ type: 'create', cityId: 'custom' })
                  }
                />
              )
            ) : filteredPlaces.length ? (
              <>
                {placeCards(
                  (category === '전체'
                    ? balancedPlaces(filteredPlaces)
                    : filteredPlaces
                  ).slice(0, placeLimit),
                )}
                {filteredPlaces.length > placeLimit && (
                  <button
                    className="button outline full places-load-more"
                    onClick={() => setPlaceLimit((limit) => limit + 24)}
                  >
                    장소 더 보기 · {placeLimit}/{filteredPlaces.length}
                  </button>
                )}
              </>
            ) : filteredRegistered.length ? null : (
              <EmptyState
                icon={<Search size={30} />}
                title="등록된 장소가 없어요"
                description=""
                action={
                  query.trim()
                    ? `‘${query.trim()}’ 새 장소 추가`
                    : '새 장소 추가'
                }
                onAction={startNewPlace}
              />
            )}
            {exploreTab === 'cities' &&
              query.trim() &&
              !filteredCities.length &&
              !filteredPlaces.length &&
              !filteredRegistered.length && (
                <button
                  type="button"
                  className="button outline full custom-stop-cta"
                  onClick={startNewPlace}
                >
                  ‘{query.trim()}’ 새 장소 추가
                </button>
              )}
            {exploreTab === 'places' &&
              query.trim() &&
              !filteredCities.length &&
              !filteredPlaces.length &&
              !filteredRegistered.length && (
                <button
                  type="button"
                  className="button outline full custom-stop-cta"
                  onClick={() =>
                    setDialog({ type: 'create', cityId: 'custom' })
                  }
                >
                  직접 입력해 여행 만들기
                </button>
              )}
          </section>
        )}
        {page === 'trips' && (
          <section className="page-section trips-page">
            <div className="page-title trip-page-title">
              <div>
                <h1>내 여행</h1>
                <details className="trip-library-more">
                  <summary>여행 관리</summary>
                  <button
                    className="text-button"
                    onClick={() => setDialog({ type: 'backup' })}
                  >
                    여행 백업·공유 <ExternalLink size={14} />
                  </button>
                </details>
              </div>
              <button
                className="button primary"
                onClick={() => setDialog({ type: 'create' })}
              >
                <Plus size={17} />새 여행
              </button>
            </div>
            {!activeTrip ? (
              <EmptyState
                icon={<Luggage size={36} />}
                title="설레는 여행을 시작해볼까요?"
                description="도시와 날짜를 정하고, 나만의 여행 코스를 만들어보세요."
                action="첫 여행 만들기"
                onAction={() => setDialog({ type: 'create' })}
              />
            ) : (
              <>
                {store.trips.length > 1 && (
                  <div className="trip-selector">
                    <label htmlFor="trip-select">
                      나의 여행 <span>{store.trips.length}</span>
                    </label>
                    <select
                      id="trip-select"
                      value={activeTrip.id}
                      onChange={(event) => {
                        setActiveTripId(event.target.value)
                        const selected = store.trips.find(
                          (trip) => trip.id === event.target.value,
                        )
                        setActiveDay(
                          selected ? journeyPreference(selected).day : 0,
                        )
                      }}
                    >
                      {store.trips.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.title} · {trip.startDate}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Itinerary
                  key={`${activeTrip.id}:${reminderRevision}`}
                  onQuickExpense={(stop) =>
                    setDialog({
                      type: 'expense',
                      tripId: activeTrip.id,
                      day: Math.min(activeDay, activeTrip.days.length - 1),
                      stopId: stop?.id,
                    })
                  }
                  trip={activeTrip}
                  onAttachmentsChange={(change) =>
                    setStore((previous) => ({
                      ...previous,
                      trips: previous.trips.map((trip) => {
                        if (trip.id !== activeTrip.id) return trip
                        const files = change(trip.attachments || [])
                        return {
                          ...trip,
                          attachments: files,
                          days: trip.days.map((items) =>
                            items.map((stop) =>
                              stop.photoId &&
                              !files.some((file) => file.id === stop.photoId)
                                ? { ...stop, photoId: undefined }
                                : stop,
                            ),
                          ),
                        }
                      }),
                    }))
                  }
                  isAttachmentShared={(id) =>
                    Object.values(personalPhotosSnapshot()).some(
                      (file) => file.id === id,
                    ) ||
                    attachmentStoreRef.current.trips.some(
                      (trip) =>
                        trip.id !== activeTrip.id &&
                        trip.attachments?.some((file) => file.id === id),
                    )
                  }
                  onCustom={(stopId) =>
                    setDialog({
                      type: 'custom',
                      tripId: activeTrip.id,
                      day: Math.min(activeDay, activeTrip.days.length - 1),
                      stopId,
                    })
                  }
                  onEditTrip={() =>
                    setDialog({ type: 'edit', tripId: activeTrip.id })
                  }
                  day={Math.min(activeDay, activeTrip.days.length - 1)}
                  onDayChange={setActiveDay}
                  scheduleReturn={scheduleReturn}
                  onAdd={() =>
                    setDialog({
                      type: 'picker',
                      tripId: activeTrip.id,
                      day: Math.min(activeDay, activeTrip.days.length - 1),
                    })
                  }
                  onDeleteTrip={() =>
                    setDialog({ type: 'delete', tripId: activeTrip.id })
                  }
                  onUpdate={updateTrip}
                  onOpen={openPlace}
                />
              </>
            )}
          </section>
        )}
      </main>
      <nav ref={bottomNav} className="bottom-nav" aria-label="모바일 주 메뉴">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <span>
                <Icon size={22} strokeWidth={page === item.id ? 2.2 : 1.7} />
              </span>
              <span>{item.name}</span>
            </button>
          )
        })}
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {storageError && (
        <div className="storage-warning" role="alert">
          이 기기에 저장할 수 없어요. 브라우저의 저장 공간 설정을 확인하세요.
        </div>
      )}
      {dialog?.type === 'expense' &&
        (() => {
          const trip = store.trips.find((item) => item.id === dialog.tripId)
          if (!trip || !trip.days[dialog.day]) return null
          return (
            <Modal title="빠른 지출 기록" onClose={() => setDialog(null)}>
              <QuickExpense
                key={`${trip.id}:${dialog.day}:${dialog.stopId || 'general'}`}
                trip={trip}
                day={dialog.day}
                stopId={dialog.stopId}
                onClose={() => setDialog(null)}
                onSave={(expense) => {
                  const current = attachmentStoreRef.current
                  const latest = current.trips.find(
                    (item) => item.id === trip.id,
                  )
                  if (!latest) throw new Error('여행을 찾을 수 없어요.')
                  const updated = tripSchema.parse({
                    ...latest,
                    expenses: [...(latest.expenses || []), expense],
                  })
                  const next = {
                    ...current,
                    trips: current.trips.map((item) =>
                      item.id === trip.id ? updated : item,
                    ),
                  }
                  try {
                    localStorage.setItem('jido-travel-v1', JSON.stringify(next))
                  } catch {
                    throw new Error(
                      '지출을 저장하지 못했어요. 저장 공간을 확인하고 다시 시도하세요.',
                    )
                  }
                  setStore(next)
                  setDialog(null)
                  setToast('지출을 저장했어요.')
                }}
              />
            </Modal>
          )
        })()}
      {dialog?.type === 'reminders' && (
        <Modal title="여행 알림 설정" onClose={() => setDialog(null)}>
          <ReminderSettings trips={store.trips} />
        </Modal>
      )}
      {dialog?.type === 'nearby' && (
        <Modal title="내 주변 맛집·카페" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <LiveNearby onOpen={openPlace} />
          </div>
        </Modal>
      )}
      {dialog?.type === 'credits' && (
        <Modal title="사진 출처" onClose={() => setDialog(null)} wide>
          <PhotoCredits
            trips={store.trips}
            savedCities={store.savedCities}
            savedPlaces={store.savedPlaces}
          />
        </Modal>
      )}
      {dialog?.type === 'backup' && (
        <Modal title="여행 백업·공유" onClose={() => setDialog(null)}>
          <TravelBackup
            day={activeDay}
            trips={store.trips}
            activeTrip={activeTrip}
            onFullRestore={(trips, photos) => {
              const next = commitFullRestore(
                attachmentStoreRef.current,
                trips,
                photos,
              )
              setStore(next)
              if (trips.length) {
                setActiveTripId(trips[0].id)
                setActiveDay(0)
              }
            }}
            onRestore={(trips) => {
              const current = attachmentStoreRef.current
              if (current.trips.length + trips.length > 500)
                throw new Error('여행은 최대 500개까지 보관할 수 있어요.')
              const next = { ...current, trips: [...current.trips, ...trips] }
              localStorage.setItem('jido-travel-v1', JSON.stringify(next))
              setStore(next)
              setActiveTripId(trips[0]?.id || '')
              setActiveDay(0)
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'course' && (
        <Modal title="가이드 코스 담기" onClose={closeDialog}>
          <GuideCourseForm
            key={dialog.course.id}
            course={dialog.course}
            trips={store.trips}
            activeTripId={activeTripId}
            activeDay={activeDay}
            onCreate={() =>
              setDialog({
                type: 'create',
                cityId: dialog.course.cityId,
                course: dialog.course,
              })
            }
            onOpenTrip={(id) => {
              setActiveTripId(id)
              setDialog(null)
              navigate('trips')
            }}
            onApply={(tripId, day, time) => {
              const course = dialog.course
              const current = attachmentStoreRef.current
              const target = current.trips.find((trip) => trip.id === tripId)
              if (!target)
                throw new Error('여행을 찾을 수 없습니다. 다시 선택해 주세요.')
              const result = appendGuideSelection(
                target,
                course,
                day,
                time,
                getPlace,
              )
              setStore({
                ...current,
                trips: current.trips.map((trip) =>
                  trip.id === tripId ? result.trip : trip,
                ),
              })
              setActiveTripId(tripId)
              setActiveDay(day)
              setDialog(null)
              navigate('trips')
              setToast(`${result.added}곳을 일정에 담았어요.`)
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'create' && (
        <Modal title="새로운 여행 만들기" onClose={() => setDialog(null)}>
          <CreateTrip
            initialName={
              dialog.initialName ??
              (dialog.pendingPlaceName
                ? ''
                : dialog.cityId === 'custom'
                  ? query.trim().slice(0, 80)
                  : '')
            }
            initialCountry={dialog.initialCountry}
            cityId={dialog.cityId}
            placeId={dialog.placeId}
            course={dialog.course}
            onCreate={(trip) => {
              if (dialog.registeredPlace) {
                trip = {
                  ...trip,
                  days: trip.days.map((items, index) =>
                    index === 0
                      ? [
                          ...items,
                          {
                            id: crypto.randomUUID(),
                            placeId: `custom-${crypto.randomUUID()}`,
                            time: '',
                            note: '',
                            custom: {
                              ...dialog.registeredPlace!,
                              destinationId: destinationForDay(trip, 0).id,
                            },
                          },
                        ]
                      : items,
                  ),
                }
              }
              createTrip(trip)
              if (dialog.pendingPlaceName)
                setDialog({
                  type: 'custom',
                  tripId: trip.id,
                  day: 0,
                  initialName: dialog.pendingPlaceName,
                })
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'custom' &&
        (() => {
          const trip = store.trips.find((item) => item.id === dialog.tripId)
          if (!trip) return null
          const stop = trip.days[dialog.day]?.find(
            (item) => item.id === dialog.stopId,
          )
          return (
            <Modal
              title={stop ? '일정 수정' : '장소 추가'}
              onClose={() => setDialog(null)}
            >
              <CustomStopForm
                initialName={dialog.initialName}
                onBrowse={() =>
                  setDialog({
                    type: 'picker',
                    tripId: trip.id,
                    day: dialog.day,
                  })
                }
                trip={trip}
                day={dialog.day}
                stop={stop}
                onSave={(value) => {
                  updateTrip({
                    ...trip,
                    days: trip.days.map((items, index) =>
                      index === dialog.day
                        ? stop
                          ? items.map((item) =>
                              item.id === stop.id ? value : item,
                            )
                          : [...items, value]
                        : items,
                    ),
                  })
                  setDialog(null)
                  setToast(
                    stop ? '일정을 수정했어요.' : '나만의 일정을 추가했어요.',
                  )
                }}
              />
            </Modal>
          )
        })()}
      {dialog?.type === 'edit' &&
        (() => {
          const trip = store.trips.find((item) => item.id === dialog.tripId)
          return (
            trip && (
              <Modal title="여행 정보 수정" onClose={() => setDialog(null)}>
                <TripEditor
                  trip={trip}
                  onSave={(updated) => {
                    updateTrip(updated)
                    setActiveDay((day) =>
                      Math.min(day, updated.days.length - 1),
                    )
                    setDialog(null)
                    setToast('여행 정보를 수정했어요.')
                  }}
                />
              </Modal>
            )
          )
        })()}
      {dialog?.type === 'city' &&
        (() => {
          const city = getCity(dialog.id)!
          const storedGuide = getGuide(city.id)
          return (
            <Modal
              title={`${city.name} 여행 가이드`}
              onClose={() => setDialog(null)}
              wide
            >
              <div className="city-detail-hero">
                <CityPhoto city={city} alt={`${city.name} 여행 풍경`} />

                <div>
                  <span>{city.country}</span>
                  <h2>{city.name}</h2>
                  <p>{city.tagline}</p>
                </div>
              </div>
              <div className="modal-body">
                {(!practicalGuideById.has(city.id) || storedGuide) && (
                  <p className="city-intro">{city.description}</p>
                )}
                <CityGuide
                  key={city.id}
                  city={city}
                  initialTab={dialog.guideTab}
                  onPlace={openPlace}
                >
                  <GuideContent
                    compact
                    guide={storedGuide}
                    cityId={city.id}
                    onCourse={(course) => setDialog({ type: 'course', course })}
                    onPlace={openPlace}
                  />
                </CityGuide>
                <PersonalPhotoControl
                  kind="city"
                  id={city.id}
                  name={city.name}
                />
                <BlogPhotos cityId={city.id} />

                <button
                  className="button primary full city-plan-button"
                  onClick={() => setDialog({ type: 'create', cityId: city.id })}
                >
                  <Plus size={18} />
                  {city.name} 여행 만들기
                </button>
              </div>
            </Modal>
          )
        })()}
      {dialog?.type === 'place' &&
        (() => {
          const place = getPlace(dialog.id)!
          const city = getCity(place.cityId)!
          return (
            <Modal key={place.id} title={place.name} onClose={closeDialog}>
              <div className="place-detail-photo">
                <PlacePhoto place={place} alt={place.name} />

                <span>
                  {city.name} · {place.category}
                </span>
              </div>
              <div className="modal-body">
                <span className="eyebrow">
                  {city.name} · {place.category}
                </span>
                <h3 className="place-detail-title">{place.name}</h3>
                <PersonalPhotoControl
                  kind="place"
                  id={place.id}
                  name={place.name}
                />
                {place.english && (
                  <details className="place-original-name">
                    <summary>현지 이름 확인</summary>
                    <p lang="und">{place.english}</p>
                  </details>
                )}
                <p className="city-intro">{place.description}</p>
                <BlogPhotos
                  cityId={city.id}
                  placeId={place.id}
                  primaryImage={place.image}
                />
                <div className="place-facts">
                  {place.area && (
                    <p>
                      <MapPin size={17} />
                      <span>{place.area}</span>
                    </p>
                  )}
                  <p>
                    <MapPin size={17} />
                    <span>{place.address}</span>
                  </p>
                  {meaningfulCost(place.cost) && (
                    <p>
                      <Bookmark size={17} />
                      <span>{place.cost}</span>
                    </p>
                  )}
                </div>
                {place.tip !==
                  '영업·휴관 일정과 예약 여부는 방문 전 공식 안내에서 확인하세요.' && (
                  <div className="place-tip">
                    <Sparkles size={18} />
                    <div>
                      <strong>작은 여행 팁</strong>
                      <p>{place.tip}</p>
                    </div>
                  </div>
                )}
                <PlaceReviews place={place} />
                <NearbyPlaces place={place} onOpen={openPlace} />
                <a
                  className="button outline full map-link"
                  href={mapsSearch(placeMapQuery(place))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapIcon size={17} />
                  {placeCoordinates(place)
                    ? '지도에서 위치 보기'
                    : '지도에서 이름으로 찾기'}
                  <ExternalLink size={14} />
                </a>
                <button
                  className="button primary full"
                  onClick={() => setDialog({ type: 'add', placeId: place.id })}
                >
                  <Plus size={17} />
                  일정에 추가
                </button>
              </div>
            </Modal>
          )
        })()}
      {dialog?.type === 'add' && (
        <Modal title="내 일정에 장소 담기" onClose={() => setDialog(null)}>
          <AddToTrip
            place={getPlace(dialog.placeId)!}
            trips={store.trips}
            preferredTripId={
              page === 'home' && home?.personalized
                ? home.trip.id
                : activeTrip?.id
            }
            preferredDay={
              page === 'home' && home?.personalized ? home.day : activeDay
            }
            onAdd={(tripId, day) => addStop(tripId, day, dialog.placeId)}
            onManageTrip={(id) => {
              const trip = store.trips.find((item) => item.id === id)
              if (trip) {
                const selected = journeyPreference(trip).day
                saveJourneyPreference(trip, selected, 'schedule')
                setActiveDay(selected)
              }
              setActiveTripId(id)
              setDialog(null)
              navigate('trips')
            }}
            onCreate={() =>
              setDialog({
                type: 'create',
                cityId: getPlace(dialog.placeId)!.cityId,
                placeId: dialog.placeId,
              })
            }
          />
        </Modal>
      )}
      {dialog?.type === 'registered' &&
        (() => {
          const entry = registered.find((place) => place.key === dialog.key)
          if (!entry) return null
          return (
            <Modal
              title="등록한 장소 일정에 담기"
              onClose={() => setDialog(null)}
            >
              <RegisteredPlaceAdd
                entry={entry}
                trips={store.trips}
                activeTripId={activeTripId}
                initialDay={activeDay}
                onAdd={(tripId, day) =>
                  addRegisteredPlace(entry.custom, tripId, day)
                }
                onManage={(tripId) => {
                  const trip = store.trips.find((item) => item.id === tripId)
                  if (trip) saveJourneyPreference(trip, 0, 'route')
                  setActiveDay(0)
                  setActiveTripId(tripId)
                  setDialog(null)
                  navigate('trips')
                }}
                onCreate={() =>
                  setDialog({
                    type: 'create',
                    cityId: entry.destination.guideCityId || 'custom',
                    initialName: entry.destination.name,
                    initialCountry: entry.destination.country,
                    registeredPlace: entry.custom,
                  })
                }
              />
            </Modal>
          )
        })()}
      {dialog?.type === 'picker' &&
        (() => {
          const trip = store.trips.find((item) => item.id === dialog.tripId)!
          return (
            <Modal
              title={`${destinationForDay(trip, dialog.day).name}에서 가볼 곳`}
              onClose={() => setDialog(null)}
            >
              <PlacePicker
                onDone={() => {
                  setScheduleReturn({
                    tripId: trip.id,
                    day: dialog.day,
                    revision: ++scheduleReturnSequence.current,
                  })
                  setDialog(null)
                }}
                trip={trip}
                trips={store.trips}
                onCustom={(name) =>
                  setDialog({
                    type: 'custom',
                    initialName: name,
                    tripId: trip.id,
                    day: dialog.day,
                  })
                }
                day={dialog.day}
                onReuse={(place) =>
                  addRegisteredPlace(place, trip.id, dialog.day, false)
                }
                onAdd={(id) => addStop(trip.id, dialog.day, id, false)}
                onOpen={openPlace}
              />
            </Modal>
          )
        })()}
      {dialog?.type === 'delete' && (
        <Modal title="이 여행을 삭제할까요?" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <p className="delete-description">
              ‘{store.trips.find((trip) => trip.id === dialog.tripId)?.title}’의
              일정과 메모가 삭제돼요.
            </p>
            <div className="form-row">
              <button
                className="button outline"
                onClick={() => setDialog(null)}
              >
                돌아가기
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setStore((previous) => ({
                    ...previous,
                    trips: previous.trips.filter(
                      (trip) => trip.id !== dialog.tripId,
                    ),
                  }))
                  setActiveTripId('')
                  setActiveDay(0)
                  setDialog(null)
                  setToast('여행을 삭제했어요.')
                }}
              >
                여행 삭제
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
