import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BedDouble,
  Bookmark,
  CalendarDays,
  Camera,
  Check,
  CheckSquare,
  ChevronRight,
  Coffee,
  ExternalLink,
  Home,
  Luggage,
  Map as MapIcon,
  MapPin,
  Music,
  Pencil,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Ticket,
  Trash2,
  Users,
  Utensils,
  Wallet,
  X,
} from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ContextType,
  type ReactNode,
} from 'react'
import AppInformation from './AppInformation'
import AttachmentsPanel from './AttachmentsPanel'
import TripFilesProvider from './TripFilesProvider'
import TripPhoto from './TripPhoto'
import ConnectionNotice from './ConnectionNotice'
import CustomStopForm from './CustomStopForm'
import DayNavigation from './DayNavigation'
import DayScheduleAdjust from './DayScheduleAdjust'
import DayTransfers from './DayTransfers'
import DurationInput from './DurationInput'
import FieldJourney from './FieldJourney'
import JourneyRoute, { DayRoute } from './JourneyRoute'
import JourneyShare from './JourneyShare'
import PersonalPlaceForm from './PersonalPlaceForm'
import { PlaceLibraryContext } from './PlaceLibraryContext'
import PlacePhoto from './PlacePhoto'
import PlacePicker from './PlacePicker'
import SavedPlaces from './SavedPlaces'
import StopPhotos from './StopPhotos'
import PlaceSource from './PlaceSource'
import CreateTrip from './PlannerCreateTrip'
import PlannerHome from './PlannerHome'
import QuickExpense from './QuickExpense'
import RecoveryPanel from './RecoveryPanel'
import RegisteredPlaceAdd from './RegisteredPlaceAdd'
import ReminderSettings from './ReminderSettings'
import ReservationConflicts from './ReservationConflicts'
import ScheduleOrderDialog from './ScheduleOrderDialog'
import ScheduleStopInfo from './ScheduleStopInfo'
import SettingsPage from './SettingsPage'
import TimelineRail, { timelineDistance } from './TimelineRail'
import TravelBackup from './TravelBackup'
import { Checklist, Expenses, Reservations } from './TravelTools'
import TripDashboard from './TripDashboard'
import TripEditor from './TripEditor'
import TripLibrary from './TripLibrary'
import TripOverview from './TripOverview'
import TripSearch from './TripSearch'
import { readAppSession, useAppSession } from './app-session'
import { cities, getCity, getPlace } from './catalog'
import { commitFullRestore } from './full-backup'
import { googleMapsLink, mapsSearch } from './google-maps'
import { useGoogleRoutes } from './google-routes'
import {
  journeyPreference,
  saveJourneyPreference,
  travelDay,
} from './journey-personal'
import { cancelledReservation, timeConflicts } from './journey-progress'
import { personalPhotosSnapshot } from './personal-photos'
import {
  libraryPlaces,
  removeLibraryPlace,
  savePersonalPlace,
  type PersonalPlace,
} from './personal-place-library'
import { registeredPlaceKey, stopMatchesCustom } from './registered-places'
import { useTravelReminders } from './reminder-service'
import { applyTimeAdjustment, type TimeAdjustment } from './schedule-adjust'
import {
  applyScheduleOrder,
  emptyScheduleFilter,
  matchesSchedule,
  scheduleSummary,
  type ScheduleFilter,
  type ScheduleOrder,
} from './schedule-list'
import {
  moveScheduleStops,
  scheduleMoveRecord,
  undoScheduleMove,
  type ScheduleMove,
} from './schedule-move'
import { sameStopPlace } from './stop-identity'
import {
  dateAt,
  formatDate,
  SAVE_ERROR_MESSAGE,
  useTravelStore,
  type Stop,
  type Trip,
} from './store'
import { dayTransferLegs } from './transfer-planning'
import {
  destinationForDay,
  mapQuery,
  stopDetails,
  tripCity,
  tripDestinations,
  tripSchema,
  type CustomPlace,
} from './travel-model'
import type { JourneyTarget } from './trip-readiness'
import { layoutHeight } from './ui-scale'
import { useJourneyNavigation } from './use-journey-navigation'
import { useDriveSync } from './useDriveSync'
import {
  planningViews,
  preparationViews,
  workspaceGroup,
} from './workspace-navigation'

type Page = 'home' | 'trips' | 'settings'
type LibraryTarget = { type: 'place-library'; tripId: string; day: number }
type Dialog =
  | LibraryTarget
  | {
      type: 'personal-place'
      personalId?: string
      draftId?: string
      cityId?: string
      kind?: string
      initialName?: string
      entry?: import('./registered-places').RegisteredPlace
      returnTo?: LibraryTarget
    }
  | {
      type: 'remove-place'
      entry?: import('./registered-places').RegisteredPlace
      placeId?: string
      returnTo?: LibraryTarget
    }
  | { type: 'reminders' }
  | { type: 'recovery' }
  | { type: 'expense'; tripId: string; day: number; stopId?: string }
  | {
      type: 'create'
      cityId?: string
      placeId?: string
      initialName?: string
      initialCountry?: string
      pendingPlaceName?: string
      registeredPlace?: CustomPlace
    }
  | { type: 'picker'; tripId: string; day: number }
  | {
      type: 'registered'
      key: string
      entry?: import('./registered-places').RegisteredPlace
    }
  | { type: 'delete'; tripId: string }
  | { type: 'backup' }
  | { type: 'edit'; tripId: string }
  | { type: 'photos'; tripId: string; stopId?: string }
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
  { id: 'reservations' as const, name: '예약', icon: Ticket },
  { id: 'expenses' as const, name: '경비', icon: Wallet },
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

const StorageErrorContext = createContext('')

function AppProviders({
  error,
  library,
  children,
}: {
  error: string
  library: NonNullable<ContextType<typeof PlaceLibraryContext>>
  children: ReactNode
}) {
  return (
    <StorageErrorContext.Provider value={error}>
      <PlaceLibraryContext.Provider value={library}>
        {children}
      </PlaceLibraryContext.Provider>
    </StorageErrorContext.Provider>
  )
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
  const storageMessage = useContext(StorageErrorContext)
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
      // Let a native photo/document preview handle its own focus and Escape.
      if (document.querySelector('dialog[open]')) return
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
        {storageMessage && (
          <p className="modal-save-error" role="alert">
            {storageMessage}
          </p>
        )}
        {children}
      </div>
    </div>
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
      {description && <p>{description}</p>}
      <button className="button primary" onClick={onAction}>
        {action}
        <ArrowRight size={16} />
      </button>
    </div>
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
  onPhotos,
  onSavedPlaces,
  onPlanning,
  focused,
  onFilesChange,
  isAttachmentShared,
  onQuickExpense,
  scheduleReturn,
  onWorkspaceChange,
}: {
  onWorkspaceChange: (workspace: string) => void
  scheduleReturn?: { tripId: string; day: number; revision: number }
  onQuickExpense: (stop?: Stop) => void
  onFilesChange: (change: (current: Trip) => Trip) => boolean | void
  isAttachmentShared: (id: string) => boolean
  onSavedPlaces: () => void
  onPlanning: () => void
  focused?: boolean
  onPhotos: (stopId?: string) => void
  trip: Trip
  day: number
  onDayChange: (day: number) => void
  onAdd: () => void
  onDeleteTrip: () => void
  onEditTrip: () => void
  onCustom: (stopId?: string) => void
  onUpdate: (trip: Trip) => boolean | void
  onOpen: (placeId: string) => void
}) {
  const city = tripCity(trip)
  const [workspace, setWorkspaceState] = useState(
    () => journeyPreference(trip).workspace,
  )
  const navigation = useJourneyNavigation(
    workspace,
    day,
    setWorkspaceState,
    changeDay,
  )
  useEffect(() => onWorkspaceChange(workspace), [workspace, onWorkspaceChange])
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
    onUpdate,
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
    if (onUpdate(applyScheduleOrder(trip, change)) === false) return false
    setOrderUndo(change)
    setOrderError('')
    return true
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
    if (
      onUpdate({
        ...trip,
        days: trip.days.map((items, index) =>
          index === day ? items.filter((stop) => stop.id !== id) : items,
        ),
      }) === false
    )
      return
    if (index >= 0) setRemoved({ stop: stops[index], day, index })
  }
  const moveToDay = (stop: Stop, target: number) => {
    if (
      target === day ||
      !trip.days[target] ||
      trip.days[target].some((item) => sameStopPlace(item, stop)) ||
      trip.days[target].length >= 200
    )
      return
    if (
      onUpdate({
        ...trip,
        days: trip.days.map((items, index) =>
          index === day
            ? items.filter((item) => item.id !== stop.id)
            : index === target
              ? [...items, stop]
              : items,
        ),
      }) === false
    )
      return
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
    <TripFilesProvider
      trip={trip}
      onChange={onFilesChange}
      isShared={isAttachmentShared}
    >
      <div className={`itinerary ${workspace === 'field' ? 'is-field' : ''}`}>
        <div className="trip-banner">
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
          {!focused && (
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
          )}
        </div>
        {focused && (
          <button
            className="text-button task-planning-return"
            onClick={onPlanning}
          >
            일정으로 돌아가기
          </button>
        )}
        {!focused && (
          <div className="trip-photo-toolbar">
            <TripPhoto trip={trip} className="trip-plan-cover" />
            <button className="text-button" onClick={() => onPhotos()}>
              <Camera size={18} />
              여행 사진
            </button>
            <button className="text-button" onClick={onSavedPlaces}>
              <Bookmark size={18} />
              장소 보관함
            </button>
          </div>
        )}
        {!focused && (
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
        )}
        <ReservationConflicts
          trip={trip}
          onOpen={() => setWorkspace('reservations')}
        />
        <div
          className={`workspace-content workspace-${workspace}`}
          id="workspace-panel"
          role={focused ? 'region' : 'tabpanel'}
          tabIndex={-1}
          aria-label={
            focused
              ? workspace === 'reservations'
                ? '예약 기록'
                : '경비 기록'
              : undefined
          }
          aria-labelledby={focused ? undefined : `workspace-${mainWorkspace}`}
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
          {mainWorkspace === 'overview' && !focused && (
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
              {workspace === 'schedule' && (
                <TripOverview trip={trip} onDay={onDayChange} />
              )}
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
                                if (onUpdate(next) === false) return
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
                            if (
                              onUpdate(undoScheduleMove(trip, batchUndo)) ===
                              false
                            )
                              return
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
                            if (
                              onUpdate(
                                applyScheduleOrder(trip, orderUndo, true),
                              ) === false
                            )
                              return
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
                            if (
                              onUpdate(
                                applyTimeAdjustment(trip, timeUndo, true),
                              ) === false
                            )
                              return
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
                    <div className="schedule-first-place">
                      <EmptyState
                        icon={<MapIcon size={32} />}
                        title="아직 비어 있는 하루"
                        description="가고 싶은 장소부터 담아보세요. 방문 시간은 나중에 정해도 돼요."
                        action="장소 추가"
                        onAction={onAdd}
                      />
                      {!trip.days.some((items) => items.length) && (
                        <nav
                          className="first-trip-actions"
                          aria-label="여행 준비 시작"
                        >
                          <button
                            className="text-button"
                            onClick={() => setWorkspace('reservations')}
                          >
                            <Ticket size={17} />
                            예약 기록하기
                          </button>
                          <button
                            className="text-button"
                            onClick={() => setWorkspace('checklist')}
                          >
                            <CheckSquare size={17} />
                            준비물 챙기기
                          </button>
                        </nav>
                      )}
                    </div>
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
                                <button onClick={() => onCustom(stop.id)}>
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

                              <button
                                className="text-button stop-photo-shortcut"
                                onClick={() => onPhotos(stop.id)}
                                aria-label={`${place.name} 사진 추가·관리`}
                              >
                                <Camera size={16} />
                                사진
                              </button>
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
                              <StopPhotos stopId={stop.id} />
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
                          if (
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
                            }) === false
                          )
                            return
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
                if (onUpdate(applyTimeAdjustment(trip, value)) === false)
                  return false
                setTimeUndo(value)
                setAdjustError('')
                return true
              }}
            />
          )}
        </div>
      </div>
    </TripFilesProvider>
  )
}

export default function App() {
  const [scheduleReturn, setScheduleReturn] = useState<{
    tripId: string
    day: number
    revision: number
  }>()
  const scheduleReturnSequence = useRef(0)
  const {
    store,
    setStore,
    getCurrentStore,
    storageError,
    saveError,
    recoveries,
    acknowledgeRecovery,
  } = useTravelStore()
  const driveSync = useDriveSync(getCurrentStore, setStore)
  const attachmentStoreRef = useRef(store)
  attachmentStoreRef.current = store
  const [initialSession] = useState(() => {
    const session = readAppSession(store.trips)
    if (
      session &&
      (session.page === 'explore' ||
        ['city', 'place', 'add', 'guidebooks', 'nearby'].includes(
          session.dialog?.type || '',
        ))
    ) {
      return {
        ...session,
        page: (store.trips.length ? 'trips' : 'home') as Page,
        tripLibrary: store.trips.length > 1,
        dialog: null,
        scroll: 0,
        modalScroll: [],
        openDetails: [],
        detailCount: 0,
      }
    }
    return session
  })
  const [page, setPage] = useState<Page>(
    initialSession?.page === 'explore'
      ? 'trips'
      : initialSession?.page || 'home',
  )
  const [workspaceEntry, setWorkspaceEntry] = useState<
    'trip' | 'reservations' | 'expenses'
  >(initialSession?.workspaceEntry || 'trip')
  const [tripLibrary, setTripLibrary] = useState(
    initialSession?.tripLibrary ?? true,
  )
  const [dialog, setDialog] = useState<Dialog | null>(
    initialSession?.dialog &&
      ![
        'city',
        'place',
        'add',
        'guidebooks',
        'nearby',
        'course',
        'credits',
      ].includes(initialSession.dialog.type)
      ? (initialSession.dialog as Dialog)
      : null,
  )
  const [infoOpen, setInfoOpen] = useState(false)
  const closeDialog = () => setDialog(null)
  useEffect(() => setInfoOpen(false), [page, dialog])

  const [toast, setToast] = useState('')
  const [navWorkspace, setNavWorkspace] = useState(() => {
    const trip =
      store.trips.find((t) => t.id === initialSession?.activeTripId) ||
      store.trips.at(-1)
    return trip ? journeyPreference(trip).workspace : 'schedule'
  })
  const [reminderRevision, setReminderRevision] = useState(0)
  const [activeTripId, setActiveTripId] = useState(() => {
    if (initialSession?.activeTripId) return initialSession.activeTripId
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
    return trip
      ? initialSession?.activeTripId === trip.id
        ? initialSession.day
        : journeyPreference(trip).day
      : 0
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
    setTripLibrary(false)
    setWorkspaceEntry(
      target.workspace === 'reservations' ? target.workspace : 'trip',
    )
    setPage('trips')
    window.scrollTo(0, 0)
  })
  const navigationRef = useRef({
    page,
    dialog,
    closeDialog,
    infoOpen,
    tripLibrary,
    multipleTrips: store.trips.length > 1,
  })
  navigationRef.current = {
    page,
    dialog,
    closeDialog,
    infoOpen,
    tripLibrary,
    multipleTrips: store.trips.length > 1,
  }
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])
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
      else if (
        navigationRef.current.page === 'trips' &&
        navigationRef.current.multipleTrips &&
        !navigationRef.current.tripLibrary
      )
        setTripLibrary(true)
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
  const navigate = (
    target: Page | 'reservations' | 'expenses',
    detail = false,
  ) => {
    if (target === 'reservations' || target === 'expenses') {
      setWorkspaceEntry(target)
      if (activeTrip) {
        const day = Math.min(activeDay, activeTrip.days.length - 1)
        saveJourneyPreference(activeTrip, day, target)
        setNavWorkspace(target)
        setReminderRevision((v) => v + 1)
      }
      setTripLibrary(false)
      setPage('trips')
      setInfoOpen(false)
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    if (target === 'trips') {
      setWorkspaceEntry('trip')
      setTripLibrary(!detail)
      if (!detail && activeTrip) {
        saveJourneyPreference(
          activeTrip,
          Math.min(activeDay, activeTrip.days.length - 1),
          'schedule',
        )
        setNavWorkspace('schedule')
        setReminderRevision((value) => value + 1)
      }
    }
    setInfoOpen(false)
    setPage(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openPlace = (id: string) => {
    if (!activeTrip) return
    const day = activeTrip.days.findIndex((stops) =>
      stops.some((stop) => stop.placeId === id),
    )
    const stop = activeTrip.days[day]?.find((stop) => stop.placeId === id)
    if (stop)
      setDialog({ type: 'custom', tripId: activeTrip.id, day, stopId: stop.id })
  }
  const createTrip = (trip: Trip) => {
    if (
      !setStore((previous) => ({
        ...previous,
        trips: [...previous.trips, trip],
      }))
    )
      throw new Error(SAVE_ERROR_MESSAGE)
    setActiveTripId(trip.id)
    setActiveDay(0)
    setDialog(null)
    navigate('trips', true)
    setToast('새로운 여행이 시작됐어요!')
  }
  const updateTrip = (trip: Trip) =>
    setStore((previous) => ({
      ...previous,
      trips: previous.trips.map((item) => (item.id === trip.id ? trip : item)),
    }))
  const changeTripFiles = (tripId: string, change: (trip: Trip) => Trip) =>
    setStore((current) => {
      if (!current.trips.some((trip) => trip.id === tripId))
        throw new Error('여행이 없어졌어요. 다시 확인해 주세요.')
      return {
        ...current,
        trips: current.trips.map((trip) =>
          trip.id === tripId ? change(trip) : trip,
        ),
      }
    })
  const sharedFile = (tripId: string, id: string) =>
    Object.values(personalPhotosSnapshot()).some((file) => file.id === id) ||
    attachmentStoreRef.current.trips.some(
      (trip) =>
        trip.id !== tripId && trip.attachments?.some((file) => file.id === id),
    )
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
    if (trip.days[day].some((stop) => stopMatchesCustom(stop, custom))) {
      setToast('이날 일정에 이미 있는 장소예요.')
      return
    }
    if (trip.days[day].length >= 200) {
      setToast('하루 일정은 최대 200곳까지 담을 수 있어요.')
      return
    }
    if (
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
      }) === false
    )
      return
    setActiveTripId(trip.id)
    setActiveDay(day)
    if (close) {
      setDialog(null)
      navigate('trips', true)
    }
    setToast(close ? '일정에 장소를 추가했어요.' : '')
  }
  const registered = useMemo(
    () => libraryPlaces(store.trips, store.placeLibrary),
    [store.trips, store.placeLibrary],
  )
  const hiddenPublicIds = new Set(
    (store.placeLibrary?.hidden || [])
      .filter((key) => key.startsWith('public:'))
      .map((key) => key.slice(7)),
  )
  for (const entry of registered)
    if (entry.custom.catalogPlaceId)
      hiddenPublicIds.add(entry.custom.catalogPlaceId)
  const createLibraryPlace = (cityId?: string, kind?: string) =>
    setDialog({
      type: 'personal-place',
      cityId,
      kind,
      draftId: `new-${cityId || 'all'}`,
    })
  const editLibraryPlace = (
    entry: import('./registered-places').RegisteredPlace,
  ) =>
    setDialog({
      type: 'personal-place',
      entry,
      personalId: entry.personalId,
      draftId: entry.personalId || crypto.randomUUID(),
    })
  const activeTrip =
    store.trips.find((trip) => trip.id === activeTripId) || store.trips[0]
  useAppSession(
    {
      page,
      tripLibrary,
      workspaceEntry,
      activeTripId: activeTrip?.id || '',
      day: activeDay,
      // Retain the old navigation envelope without guide-search state.
      query: '',
      region: '전체',
      category: '전체',
      exploreCity: '전체',
      exploreTab: 'cities',
      placeLimit: 24,
      dialog,
    },
    initialSession,
  )
  useEffect(() => {
    try {
      if (activeTrip) localStorage.setItem('jdo-active-trip-v1', activeTrip.id)
      else localStorage.removeItem('jdo-active-trip-v1')
    } catch {
      /* Travel data saving reports its own storage error. */
    }
  }, [activeTrip?.id])
  const selectedNav =
    page === 'trips' && activeTrip && !(store.trips.length > 1 && tripLibrary)
      ? navWorkspace === 'reservations'
        ? 'reservations'
        : navWorkspace === 'expenses'
          ? 'expenses'
          : 'trips'
      : page
  return (
    <AppProviders
      error={storageError ? saveError || SAVE_ERROR_MESSAGE : ''}
      library={{
        entries: registered,
        hiddenPublicIds,
        create: createLibraryPlace,
        open: (entry) =>
          setDialog({ type: 'registered', key: entry.key, entry }),
      }}
    >
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
                className={selectedNav === item.id ? 'active' : ''}
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
        <ConnectionNotice />
        {driveSync.enabled &&
          page !== 'settings' &&
          (driveSync.phase === 'conflict' || driveSync.phase === 'error') && (
            <aside className="sync-status-notice" role="status">
              <span>
                {driveSync.phase === 'conflict'
                  ? '기기 간 다른 내용을 확인해 주세요.'
                  : '동기화를 마치지 못했어요. 기기 기록은 그대로예요.'}
              </span>
              <button
                className="text-button"
                onClick={() => setPage('settings')}
              >
                동기화 확인
              </button>
            </aside>
          )}
        {recoveries.some((record) => !record.acknowledged) && (
          <aside className="recovery-notice" role="alert">
            <strong>일부 기록을 복구했어요</strong>
            <p>
              읽지 못한 기록은 목록에서 제외했어요. 복구 내용에서 원본 보관
              상태를 확인하고 파일로 내보낼 수 있어요.
            </p>
            <button
              className="button outline"
              onClick={() => setDialog({ type: 'recovery' })}
            >
              복구 내용 확인
            </button>
          </aside>
        )}
        {page === 'settings' && (
          <SettingsPage
            sync={driveSync}
            onReminders={() => setDialog({ type: 'reminders' })}
            onBackup={() => setDialog({ type: 'backup' })}
            onRecovery={
              recoveries.length
                ? () => setDialog({ type: 'recovery' })
                : undefined
            }
          />
        )}
        {page === 'home' && (
          <PlannerHome
            trips={store.trips}
            activeTripId={activeTripId}
            onPhotos={(trip) => setDialog({ type: 'photos', tripId: trip.id })}
            onCreate={() => setDialog({ type: 'create' })}
            onOpen={(trip, workspace, day) => {
              saveJourneyPreference(trip, day, workspace)
              setActiveTripId(trip.id)
              setActiveDay(day)
              setNavWorkspace(workspace)
              setReminderRevision((v) => v + 1)
              navigate('trips', true)
              setWorkspaceEntry(
                workspace === 'reservations' || workspace === 'expenses'
                  ? workspace
                  : 'trip',
              )
            }}
            onImport={() => setDialog({ type: 'backup' })}
          />
        )}
        {page === 'trips' && (
          <section className="page-section trips-page">
            <div
              className={`page-title trip-page-title ${activeTrip && !(store.trips.length > 1 && tripLibrary) ? 'trip-detail-toolbar' : ''}`}
            >
              {activeTrip && !tripLibrary && store.trips.length > 1 && (
                <button
                  className="text-button trip-library-return"
                  onClick={() => {
                    setTripLibrary(true)
                    window.scrollTo({ top: 0, behavior: 'instant' })
                  }}
                >
                  모든 여행 보기
                </button>
              )}
              <div>
                <h1
                  className={
                    activeTrip && !(store.trips.length > 1 && tripLibrary)
                      ? 'sr-only'
                      : undefined
                  }
                >
                  내 여행
                </h1>
                <details className="trip-library-more">
                  <summary>여행 관리</summary>
                  <button
                    className="text-button"
                    onClick={() => setDialog({ type: 'backup' })}
                  >
                    여행 백업·공유 <ExternalLink size={14} />
                  </button>
                  {activeTrip && !(store.trips.length > 1 && tripLibrary) && (
                    <button
                      className="text-button"
                      onClick={() => setDialog({ type: 'create' })}
                    >
                      <Plus size={17} />새 여행
                    </button>
                  )}
                </details>
              </div>
              {(!activeTrip || (store.trips.length > 1 && tripLibrary)) && (
                <button
                  className="button primary"
                  onClick={() => setDialog({ type: 'create' })}
                >
                  <Plus size={17} />새 여행
                </button>
              )}
            </div>
            {store.trips.length > 1 && tripLibrary ? (
              <TripLibrary
                trips={store.trips}
                onOpen={(trip) => {
                  const day = journeyPreference(trip).day
                  saveJourneyPreference(trip, day, 'schedule')
                  setActiveTripId(trip.id)
                  setActiveDay(day)
                  setNavWorkspace('schedule')
                  navigate('trips', true)
                }}
              />
            ) : !activeTrip ? (
              <EmptyState
                icon={<Luggage size={36} />}
                title="설레는 여행을 시작해볼까요?"
                description="여행 도시와 날짜를 정하고 일정·예약·경비를 한곳에 모아요."
                action="첫 여행 만들기"
                onAction={() => setDialog({ type: 'create' })}
              />
            ) : (
              <>
                {store.trips.length > 1 &&
                  ['reservations', 'expenses'].includes(navWorkspace) && (
                    <label className="workspace-trip-switch field">
                      현재 작업의 여행
                      <select
                        aria-label="현재 작업의 여행"
                        value={activeTrip.id}
                        onChange={(event) => {
                          const trip = store.trips.find(
                            (t) => t.id === event.target.value,
                          )
                          if (!trip) return
                          const preference = journeyPreference(trip)
                          saveJourneyPreference(
                            trip,
                            preference.day,
                            navWorkspace,
                          )
                          setActiveTripId(trip.id)
                          setActiveDay(preference.day)
                          setReminderRevision((v) => v + 1)
                        }}
                      >
                        {store.trips.map((trip) => (
                          <option key={trip.id} value={trip.id}>
                            {trip.title} · {formatDate(trip.startDate)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                <Itinerary
                  focused={
                    workspaceEntry !== 'trip' &&
                    (navWorkspace === 'reservations' ||
                      navWorkspace === 'expenses')
                  }
                  onPlanning={() => {
                    saveJourneyPreference(activeTrip, activeDay, 'schedule')
                    setWorkspaceEntry('trip')
                    setNavWorkspace('schedule')
                    setReminderRevision((value) => value + 1)
                  }}
                  onSavedPlaces={() =>
                    setDialog({
                      type: 'place-library',
                      tripId: activeTrip.id,
                      day: activeDay,
                    })
                  }
                  onFilesChange={(change) =>
                    changeTripFiles(activeTrip.id, change)
                  }
                  isAttachmentShared={(id) => sharedFile(activeTrip.id, id)}
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
                  onPhotos={(stopId) =>
                    setDialog({
                      type: 'photos',
                      tripId: activeTrip.id,
                      stopId,
                    })
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
                  onWorkspaceChange={setNavWorkspace}
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
              className={selectedNav === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <span>
                <Icon
                  size={22}
                  strokeWidth={selectedNav === item.id ? 2.2 : 1.7}
                />
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
      {storageError && !dialog && (
        <div className="storage-warning" role="alert">
          {saveError || SAVE_ERROR_MESSAGE}
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
                  if (!setStore(next)) throw new Error(SAVE_ERROR_MESSAGE)
                  setDialog(null)
                  setToast('지출을 저장했어요.')
                }}
              />
            </Modal>
          )
        })()}

      {dialog?.type === 'recovery' && (
        <Modal title="기록 복구 안내" onClose={() => setDialog(null)}>
          <RecoveryPanel
            records={recoveries}
            onAcknowledge={acknowledgeRecovery}
          />
        </Modal>
      )}
      {dialog?.type === 'reminders' && (
        <Modal title="여행 알림 설정" onClose={() => setDialog(null)}>
          <ReminderSettings trips={store.trips} />
        </Modal>
      )}

      {dialog?.type === 'backup' && (
        <Modal title="여행 백업·공유" onClose={() => setDialog(null)}>
          <TravelBackup
            day={activeDay}
            trips={store.trips}
            activeTrip={activeTrip}
            placeLibrary={store.placeLibrary}
            onFullRestore={(trips, photos, placeLibrary) => {
              commitFullRestore(
                attachmentStoreRef.current,
                trips,
                photos,
                (value) => {
                  if (!setStore(value)) throw new Error(SAVE_ERROR_MESSAGE)
                },
                placeLibrary,
              )
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
              if (!setStore(next)) throw new Error(SAVE_ERROR_MESSAGE)
              setActiveTripId(trips[0]?.id || '')
              setActiveDay(0)
            }}
          />
        </Modal>
      )}

      {dialog?.type === 'place-library' &&
        (() => {
          const trip = store.trips.find((item) => item.id === dialog.tripId)
          if (!trip) return null
          const target = (day: number): LibraryTarget => ({
            type: 'place-library',
            tripId: trip.id,
            day,
          })
          return (
            <Modal title="장소 보관함" onClose={() => setDialog(null)}>
              <SavedPlaces
                trip={trip}
                day={dialog.day}
                entries={registered}
                onCreate={(day, initialName) =>
                  setDialog({
                    type: 'personal-place',
                    cityId: destinationForDay(trip, day).id,
                    initialName,
                    draftId: `saved:${trip.id}:${day}`,
                    returnTo: target(day),
                  })
                }
                onEdit={(entry, day) =>
                  setDialog({
                    type: 'personal-place',
                    entry,
                    personalId: entry.personalId,
                    draftId: entry.personalId || entry.key,
                    returnTo: target(day),
                  })
                }
                onDelete={(entry, day) =>
                  setDialog({
                    type: 'remove-place',
                    entry,
                    returnTo: target(day),
                  })
                }
                onAdd={(entry, day) =>
                  addRegisteredPlace(entry.custom, trip.id, day, false)
                }
                onDone={(day) => {
                  saveJourneyPreference(trip, day, 'schedule')
                  setActiveTripId(trip.id)
                  setActiveDay(day)
                  setDialog(null)
                  navigate('trips', true)
                  setNavWorkspace('schedule')
                  setReminderRevision((value) => value + 1)
                }}
              />
            </Modal>
          )
        })()}
      {dialog?.type === 'personal-place' && (
        <Modal
          title={
            dialog.entry || dialog.personalId ? '장소 수정' : '내 장소 추가'
          }
          onClose={() => setDialog(null)}
        >
          <PersonalPlaceForm
            knownEntries={registered}
            entry={
              dialog.entry ||
              (dialog.personalId
                ? registered.find(
                    (entry) => entry.personalId === dialog.personalId,
                  )
                : undefined)
            }
            draftId={dialog.draftId}
            initialCityId={dialog.cityId}
            initialKind={dialog.kind}
            initialName={dialog.initialName}
            destinations={[
              ...(dialog.returnTo
                ? store.trips
                    .filter((trip) => trip.id === dialog.returnTo!.tripId)
                    .flatMap(tripDestinations)
                : []),
              ...store.trips.flatMap(tripDestinations),
              ...registered.map((entry) => entry.destination),
            ]}
            onSave={(record) => {
              if (
                !setStore((previous) => ({
                  ...previous,
                  placeLibrary: savePersonalPlace(
                    previous.placeLibrary,
                    record,
                    dialog.entry,
                  ),
                }))
              )
                return false
              setDialog(dialog.returnTo || null)
              setToast('장소 보관함에 저장했어요.')
              return true
            }}
          />
          {dialog.returnTo && (
            <button
              className="text-button saved-place-back"
              onClick={() => setDialog(dialog.returnTo!)}
            >
              보관함으로 돌아가기
            </button>
          )}
        </Modal>
      )}
      {dialog?.type === 'remove-place' && (
        <Modal
          title="장소 목록에서 삭제"
          onClose={() => setDialog(dialog.returnTo || null)}
        >
          <div className="modal-body">
            <p>
              <strong>
                {dialog.entry?.custom.name ||
                  getPlace(dialog.placeId || '')?.name}
              </strong>
              을 내 장소 목록에서 삭제할까요?
            </p>
            <p>이미 담은 일정·메모·사진·예약은 그대로 남아요.</p>
            <div className="button-row">
              <button
                className="button outline"
                onClick={() => setDialog(dialog.returnTo || null)}
              >
                취소
              </button>
              <button
                className="button danger"
                onClick={() => {
                  const current = attachmentStoreRef.current
                  const target = dialog.entry || dialog.placeId
                  if (!target) return
                  const next = removeLibraryPlace(current.placeLibrary, target)
                  if (!setStore({ ...current, placeLibrary: next })) return
                  setDialog(dialog.returnTo || null)
                }}
              >
                목록에서 삭제
              </button>
            </div>
          </div>
        </Modal>
      )}

      {dialog?.type === 'create' && (
        <Modal title="새로운 여행 만들기" onClose={closeDialog}>
          <CreateTrip
            initialName={
              dialog.initialName ||
              (dialog.cityId ? getCity(dialog.cityId)?.name : '')
            }
            initialCountry={
              dialog.initialCountry ||
              (dialog.cityId ? getCity(dialog.cityId)?.country : '')
            }
            onCreate={createTrip}
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
                  if (
                    !updateTrip({
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
                  )
                    throw new Error(SAVE_ERROR_MESSAGE)
                  setDialog(null)
                  setToast(
                    stop ? '일정을 수정했어요.' : '나만의 일정을 추가했어요.',
                  )
                }}
              />
            </Modal>
          )
        })()}
      {dialog?.type === 'photos' &&
        (() => {
          const trip = store.trips.find((item) => item.id === dialog.tripId)
          const stop = dialog.stopId
            ? trip?.days.flat().find((item) => item.id === dialog.stopId)
            : undefined
          if (!trip || (dialog.stopId && !stop)) return null
          return (
            <Modal
              title={stop ? `${stopDetails(stop).name} 사진` : '여행 사진'}
              onClose={() => setDialog(null)}
            >
              <div className="modal-body travel-photos-modal">
                <p>
                  {stop
                    ? '이 장소의 사진을 넣고 대표 사진을 골라보세요.'
                    : '여행 사진을 넣고 홈과 여행 목록에 보일 대표 사진을 골라보세요.'}
                </p>
                <TripFilesProvider
                  trip={trip}
                  onChange={(change) => changeTripFiles(trip.id, change)}
                  isShared={(id) => sharedFile(trip.id, id)}
                >
                  <AttachmentsPanel imagesOnly stopId={stop?.id} />
                </TripFilesProvider>
              </div>
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
                    if (!updateTrip(updated))
                      throw new Error(SAVE_ERROR_MESSAGE)
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

      {dialog?.type === 'registered' &&
        (() => {
          const entry =
            dialog.entry || registered.find((place) => place.key === dialog.key)
          if (!entry) return null
          return (
            <Modal
              title="등록한 장소 일정에 담기"
              onClose={() => setDialog(null)}
            >
              <div className="registered-place-manage">
                <button
                  className="text-button"
                  onClick={() => editLibraryPlace(entry)}
                >
                  {entry.personalId ? '장소 정보 수정' : '장소 목록에 저장'}
                </button>
                <button
                  className="text-button"
                  onClick={() => setDialog({ type: 'remove-place', entry })}
                >
                  목록에서 삭제
                </button>
              </div>
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
                  navigate('trips', true)
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
            <Modal title="일정에 장소 추가" onClose={() => setDialog(null)}>
              <PlacePicker
                onLibrary={() =>
                  setDialog({
                    type: 'place-library',
                    tripId: trip.id,
                    day: dialog.day,
                  })
                }
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
                onOpen={openPlace}
              />
            </Modal>
          )
        })()}
      {dialog?.type === 'delete' && (
        <Modal title="이 여행을 삭제할까요?" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <p className="delete-description">
              ‘{store.trips.find((trip) => trip.id === dialog.tripId)?.title}
              ’의 일정과 메모가 삭제돼요.
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
                  if (
                    !setStore((previous) => ({
                      ...previous,
                      trips: previous.trips.filter(
                        (trip) => trip.id !== dialog.tripId,
                      ),
                    }))
                  )
                    return
                  setTripLibrary(true)
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
    </AppProviders>
  )
}
