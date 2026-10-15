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
import type { ExpenseDraft } from './ExpenseManager'
import { cancelledReservation, timeConflicts } from './journey-progress'
import PlaceSearchResults, {
  PlaceSearchService,
  usePlaceSearch,
} from './PlaceSearch'
import type { SearchPlace } from './place-search'
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
  Heart,
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
  Info,
  BedDouble,
  Music,
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

type Page = 'home' | 'explore' | 'saved' | 'trips'
type Dialog =
  | { type: 'credits' }
  | { type: 'city'; id: string }
  | { type: 'place'; id: string }
  | { type: 'create'; cityId?: string; placeId?: string }
  | { type: 'picker'; tripId: string; day: number }
  | { type: 'add'; placeId: string }
  | { type: 'delete'; tripId: string }
  | { type: 'backup' }
  | { type: 'edit'; tripId: string }
  | { type: 'custom'; tripId: string; day: number; stopId?: string }
const navigation = [
  { id: 'home' as const, name: '홈', icon: Home },
  { id: 'explore' as const, name: '여행지', icon: Compass },
  { id: 'saved' as const, name: '저장한 곳', icon: Heart },
  { id: 'trips' as const, name: '내 여행', icon: Luggage },
]
const categoryIcon = {
  관광: MapPin,
  맛집: Utensils,
  카페: Coffee,
  숙소: BedDouble,
  '바·공연': Music,
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

function SaveButton({
  saved,
  label,
  onClick,
  small = false,
}: {
  saved: boolean
  label: string
  onClick: () => void
  small?: boolean
}) {
  return (
    <button
      className={`save-button ${saved ? 'is-saved' : ''} ${small ? 'save-small' : ''}`}
      onClick={onClick}
      aria-label={`${label} ${saved ? '저장 취소' : '저장'}`}
      aria-pressed={saved}
    >
      <Heart size={small ? 17 : 20} fill={saved ? 'currentColor' : 'none'} />
    </button>
  )
}

function CityCard({
  city,
  saved,
  onSave,
  onOpen,
  compact = false,
}: {
  city: City
  saved: boolean
  onSave: () => void
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
          <img src={city.image} alt={`${city.name}의 풍경`} loading="lazy" />
        </button>
        <span className="country-tag">{city.country}</span>

        <SaveButton saved={saved} label={city.name} onClick={onSave} />
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

function PlaceCard({
  place,
  saved,
  onSave,
  onOpen,
}: {
  place: Place
  saved: boolean
  onSave: () => void
  onOpen: () => void
}) {
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

        <SaveButton saved={saved} label={place.name} onClick={onSave} small />
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
          <Icon size={13} /> 추천 코스 <span>·</span>
          <Clock3 size={13} />
          {place.duration}
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
  onCreate,
}: {
  cityId?: string
  initialName?: string
  placeId?: string
  onCreate: (trip: Trip) => void
}) {
  const [destination, setDestination] = useState(cityId || 'custom')
  const [customCity, setCustomCity] = useState(initialName)
  const [customCountry, setCustomCountry] = useState('')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(today())
  const [end, setEnd] = useState(dateAt(today(), 3))
  const [travelers, setTravelers] = useState(1)
  const [recommended, setRecommended] = useState(false)
  const [error, setError] = useState('')
  const selectedCity = getCity(destination) || {
    name: customCity.trim() || '새로운 도시',
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (
      destination === 'custom' &&
      (!customCity.trim() || !customCountry.trim())
    ) {
      setError('도시와 국가를 입력해 주세요.')
      return
    }
    const targetId =
      destination === 'custom' ? `personal-${crypto.randomUUID()}` : destination
    const count = dayCount(start, end)
    if (!Number.isFinite(count) || count < 1) {
      setError('마지막 날은 출발일과 같거나 이후여야 해요.')
      return
    }
    if (count > 21) {
      setError('한 여행은 최대 21일까지 만들 수 있어요.')
      return
    }
    const days: Stop[][] = Array.from({ length: count }, () => [])
    const initialPlaces = placeId
      ? [getPlace(placeId)!]
      : recommended
        ? places.filter((place) => place.cityId === destination).slice(0, 3)
        : []
    initialPlaces.forEach((place, index) =>
      days[0].push({
        id: crypto.randomUUID(),
        placeId: place.id,
        time: `${String(10 + index * 2).padStart(2, '0')}:00`,
        note: '',
      }),
    )
    onCreate({
      id: crypto.randomUUID(),
      title: title.trim() || `${selectedCity.name}, 나만의 여행`,
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
    })
  }
  return (
    <form className="create-form" onSubmit={submit}>
      <div className="form-intro">
        <span className="small-icon">
          <Plane size={24} />
        </span>
        <div>
          <h3>내 자유여행 만들기</h3>
        </div>
      </div>
      <label className="field">
        어디로 떠나세요?
        <select
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          disabled={!!placeId}
        >
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
      <label className="field">
        여행 이름 <span className="optional">선택</span>
        <input
          placeholder={`${selectedCity.name}, 나만의 여행`}
          value={title}
          maxLength={50}
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
            <option value={index + 1} key={index}>
              {index + 1}명{index === 0 ? ' · 나 홀로 여행' : ''}
            </option>
          ))}
        </select>
      </label>
      {!placeId && destination !== 'custom' && (
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
  onAdd,
  onCreate,
}: {
  place: Place
  trips: Trip[]
  onAdd: (tripId: string, day: number) => void
  onCreate: () => void
}) {
  const matching = trips.filter((trip) =>
    tripDestinations(trip).some(
      (destination) => destination.guideCityId === place.cityId,
    ),
  )
  const [tripId, setTripId] = useState(matching[0]?.id ?? '')
  const [day, setDay] = useState(0)
  const trip = matching.find((item) => item.id === tripId)
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
        onAdd(tripId, day)
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
            setDay(0)
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
          value={day}
          onChange={(event) => setDay(Number(event.target.value))}
        >
          {trip.days.map((_, index) => (
            <option key={index} value={index}>
              DAY {index + 1} · {formatDate(dateAt(trip.startDate, index))}
            </option>
          ))}
        </select>
      </label>
      <button className="button primary full" type="submit">
        <Plus size={18} />
        일정에 추가
      </button>
    </form>
  )
}

function PlacePicker({
  trip,
  day,
  onAdd,
  onOpen,
  savedPlaces,
  onCustom,
  onGoogleAdd,
}: {
  onGoogleAdd: (place: SearchPlace) => void
  onCustom: () => void
  trip: Trip
  day: number
  savedPlaces: string[]
  onAdd: (placeId: string) => void
  onOpen: (placeId: string) => void
}) {
  const [category, setCategory] = useState<string>('전체')
  const [query, setQuery] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const google = usePlaceSearch()
  const candidates = [
    ...new Map(
      [
        ...places,
        ...savedPlaces.map(getPlace).filter((place): place is Place => !!place),
      ].map((place) => [place.id, place]),
    ).values(),
  ]
  const available = candidates.filter(
    (place) =>
      place.cityId === destinationForDay(trip, day).guideCityId &&
      (category === '전체' || place.category === category) &&
      (!savedOnly || savedPlaces.includes(place.id)) &&
      matchesPlace(place, getCity(place.cityId)!, query),
  )
  function findPlace() {
    google.reset()
    if (!query.trim() || available.length || savedOnly) return
    const destination = destinationForDay(trip, day)
    void google.search(query.trim(), destination)
  }
  return (
    <div className="modal-body">
      <p className="muted picker-description">
        DAY {day + 1} · {formatDate(dateAt(trip.startDate, day))}에 갈 장소를
        골라보세요.
      </p>
      <button
        className="button primary full custom-stop-cta"
        onClick={onCustom}
      >
        <Plus size={17} />
        장소·숙소·이동 직접 추가
      </button>
      <div className="input-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            google.reset()
          }}
          placeholder="장소 이름 검색"
          aria-label="일정에 추가할 장소 검색"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              findPlace()
            }
          }}
        />
        <button
          className="button primary small"
          type="button"
          disabled={!query.trim() || google.loading}
          onClick={findPlace}
        >
          찾기
        </button>
      </div>
      <PlaceSearchService search={google} />
      <div className="filter-row">
        {categoryOptions.map((item) => (
          <button
            key={item}
            className={`filter ${item === category ? 'active' : ''}`}
            onClick={() => {
              setCategory(item)
              google.reset()
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        className={`saved-only-toggle ${savedOnly ? 'active' : ''}`}
        aria-pressed={savedOnly}
        onClick={() => {
          setSavedOnly(!savedOnly)
          google.reset()
        }}
      >
        <Heart size={16} /> 저장한 장소만 보기
      </button>
      <div className="picker-list">
        {available.map((place) => {
          const added = trip.days[day].some((stop) => stop.placeId === place.id)
          return (
            <div key={place.id} className="picker-item">
              <PlacePhoto place={place} alt={place.name} />
              <button
                className="picker-place-name"
                onClick={() => onOpen(place.id)}
              >
                <small>{place.category}</small>
                <strong>{place.name}</strong>
                <span>
                  <Clock3 size={12} />
                  {place.duration}
                </span>
              </button>
              <button
                className={`icon-button ${added ? 'added' : 'add-stop'}`}
                disabled={added}
                aria-label={`${place.name} ${added ? '추가됨' : '일정에 추가'}`}
                onClick={() => onAdd(place.id)}
              >
                {added ? <Check size={20} /> : <Plus size={20} />}
              </button>
            </div>
          )
        })}
        <PlaceSearchResults search={google} onSelect={onGoogleAdd} />
        {available.length === 0 &&
          !google.loading &&
          !google.error &&
          !google.searched && (
            <p className="no-results">
              {savedOnly
                ? '이 조건에 맞는 저장한 장소가 없어요. 저장한 장소 필터를 해제해 보세요.'
                : '검색 결과가 없어요. 다른 이름을 입력해보세요.'}
            </p>
          )}
      </div>
    </div>
  )
}

function Itinerary({
  trip,
  day,
  onDayChange,
  onAdd,
  onDeleteTrip,
  onEditTrip,
  onCustom,
  onUpdate,
  onOpen,
  onAttachmentsChange,
  isAttachmentShared,
}: {
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
  const [workspace, setWorkspace] = useState(
    () => journeyPreference(trip).workspace,
  )
  useEffect(() => {
    saveJourneyPreference(trip, day, workspace)
  }, [trip.id, day, workspace])
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>()
  const conflicts = timeConflicts(trip, day)
  const recordExpense = (stop?: Stop) => {
    const place = stop ? stopDetails(stop) : undefined
    setExpenseDraft({
      title: place?.name || '',
      date: dateAt(trip.startDate, day),
      category:
        place?.category === '맛집' || place?.category === '카페'
          ? '식비'
          : place?.category === '숙소'
            ? '숙박'
            : place?.category === '이동'
              ? '교통'
              : place?.category === '관광'
                ? '관광'
                : '기타',
      stopId: stop?.id,
      reservationId: stop?.reservationId,
      token: crypto.randomUUID(),
    })
    setWorkspace('expenses')
  }
  const [removed, setRemoved] = useState<{
    stop: Stop
    day: number
    index: number
  } | null>(null)
  const stops = trip.days[day] || []
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
      trip.days[target].some((item) => item.placeId === stop.placeId)
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
    const updated = [...stops]
    ;[updated[index], updated[index + direction]] = [
      updated[index + direction],
      updated[index],
    ]
    onUpdate({
      ...trip,
      days: trip.days.map((items, i) => (i === day ? updated : items)),
    })
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
      <div className="itinerary">
        <div
          className="trip-banner"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(12,36,31,.86),rgba(12,36,31,.3)), url(${city.image})`,
          }}
        >
          <div>
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
                {trip.travelers}명
              </span>
              <span>{trip.days.length}일</span>
            </div>
          </div>
          <div className="trip-management">
            <button className="trip-edit" onClick={onEditTrip}>
              <Pencil size={16} /> 여행 정보 수정
            </button>
            <button
              className="trip-delete"
              onClick={onDeleteTrip}
              aria-label="여행 삭제"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
        <div className="workspace-tabs" role="tablist" aria-label="여행 관리">
          {[
            ['schedule', '일정'],
            ['field', '여행 중'],
            ['overview', '여행 준비'],
            ['route', '동선'],
            ['files', '자료'],
            ['reservations', '예약'],
            ['checklist', '준비물'],
            ['expenses', '가계부'],
          ].map(([id, label]) => (
            <button
              key={id}
              id={`workspace-${id}`}
              role="tab"
              aria-controls="workspace-panel"
              aria-selected={workspace === id}
              onClick={() => {
                setWorkspace(id)
                if (id === 'field') {
                  const current = travelDay(trip)
                  if (current !== null) onDayChange(current)
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          id="workspace-panel"
          role="tabpanel"
          aria-labelledby={`workspace-${workspace}`}
        >
          {workspace === 'field' && (
            <FieldJourney
              trip={trip}
              day={day}
              onDay={onDayChange}
              onUpdate={onUpdate}
              onOpen={setWorkspace}
              onAdd={onAdd}
              onExpense={recordExpense}
            />
          )}
          {workspace === 'overview' && (
            <TripDashboard
              trip={trip}
              day={day}
              onUpdate={onUpdate}
              onOpen={(next, nextDay) => {
                setWorkspace(next)
                if (nextDay !== undefined) onDayChange(nextDay)
              }}
              onExpense={() => recordExpense()}
            />
          )}
          {(workspace === 'schedule' || workspace === 'route') && (
            <>
              <div className="day-tabs" role="tablist" aria-label="여행 날짜">
                {trip.days.map((_, index) => (
                  <button
                    role="tab"
                    aria-selected={index === day}
                    aria-controls="day-panel"
                    id={`day-tab-${index}`}
                    className={`day-tab ${index === day ? 'active' : ''}`}
                    key={index}
                    onClick={() => onDayChange(index)}
                  >
                    <strong>DAY {index + 1}</strong>
                    <span>{formatDate(dateAt(trip.startDate, index))}</span>
                    <small>{trip.days[index].length}곳</small>
                  </button>
                ))}
              </div>
              <JourneyRoute trip={trip} day={day} onUpdate={onUpdate} />
              <div className="planning-shortcuts">
                <button
                  className="button outline small"
                  onClick={() => {
                    const current = travelDay(trip)
                    if (current !== null) onDayChange(current)
                    setWorkspace('field')
                  }}
                >
                  여행 중 화면 열기
                </button>
                <JourneyShare trip={trip} day={day} />
              </div>
              {workspace === 'route' ? (
                <DayRoute
                  trip={trip}
                  day={day}
                  onUpdate={onUpdate}
                  onEdit={(id) => onCustom(id)}
                  onAdd={onAdd}
                />
              ) : (
                <div
                  className="day-content"
                  role="tabpanel"
                  id="day-panel"
                  aria-labelledby={`day-tab-${day}`}
                >
                  <div className="section-heading">
                    <div>
                      <h3>
                        {formatDate(dateAt(trip.startDate, day), true)}의 여행
                      </h3>
                    </div>
                    <div className="day-add-actions">
                      <button className="button primary small" onClick={onAdd}>
                        <Plus size={16} />
                        장소 추가
                      </button>
                    </div>
                  </div>
                  {stops.length > 0 && (
                    <div className="day-progress">
                      <span>
                        {stops.filter((stop) => stop.status === 'done').length}/
                        {stops.length} 방문 완료
                      </span>
                      <progress
                        aria-label="이날의 방문 진행률"
                        value={
                          stops.filter((stop) => stop.status === 'done').length
                        }
                        max={stops.length}
                      />
                    </div>
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
                  {stops.length > 1 && (
                    <div className="schedule-sort">
                      <span>
                        {stops.some(
                          (stop, index) =>
                            index > 0 && stops[index - 1].time > stop.time,
                        )
                          ? '방문 순서와 시간이 달라요. 순서대로 갈지 확인해 보세요.'
                          : `오늘 ${stops.length}개의 일정`}
                      </span>
                      <button
                        className="text-button"
                        onClick={() =>
                          onUpdate({
                            ...trip,
                            days: trip.days.map((items, index) =>
                              index === day
                                ? [...items].sort((a, b) =>
                                    a.time.localeCompare(b.time),
                                  )
                                : items,
                            ),
                          })
                        }
                      >
                        시간순 정렬 <ArrowDown size={14} />
                      </button>
                    </div>
                  )}
                  {stops.length === 0 ? (
                    <EmptyState
                      icon={<MapIcon size={32} />}
                      title="아직 비어 있는 하루"
                      description="가고 싶은 곳을 더해 나만의 하루를 만들어보세요."
                      action="첫 장소 추가하기"
                      onAction={onAdd}
                    />
                  ) : (
                    <div className="timeline">
                      {stops.map((stop, index) => {
                        const place = stopDetails(stop)
                        const Icon =
                          categoryIcon[
                            place.category as keyof typeof categoryIcon
                          ] || MapPin
                        return (
                          <article
                            className={`timeline-item ${stop.status === 'done' ? 'stop-completed' : stop.status === 'skipped' || cancelledReservation(trip, stop) ? 'stop-skipped' : ''}`}
                            key={stop.id}
                          >
                            <span className="stop-number">{index + 1}</span>
                            <div className="stop-card">
                              <div className="stop-top">
                                <input
                                  className="stop-time"
                                  type="time"
                                  value={stop.time}
                                  aria-label={`${place.name} 방문 시간`}
                                  onChange={(event) => {
                                    if (event.target.value)
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
                                  <span>
                                    <Clock3 size={12} />
                                    {place.duration}
                                  </span>
                                </button>
                                <ChevronRight size={18} />
                              </div>

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
                                    <input
                                      aria-label={`${place.name} 예상 체류 시간`}
                                      type="number"
                                      min="5"
                                      max="1440"
                                      step="5"
                                      value={stop.durationMinutes ?? ''}
                                      onChange={(event) => {
                                        const value = Number(event.target.value)
                                        if (!event.target.value)
                                          updateStop(stop.id, {
                                            durationMinutes: undefined,
                                          })
                                        else if (
                                          Number.isInteger(value) &&
                                          value >= 5 &&
                                          value <= 1440
                                        )
                                          updateStop(stop.id, {
                                            durationMinutes: value,
                                          })
                                      }}
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
                                          items.some(
                                            (item) =>
                                              item.placeId === stop.placeId,
                                          )
                                        return (
                                          <option
                                            key={index}
                                            value={index}
                                            disabled={duplicate}
                                          >
                                            DAY {index + 1} ·{' '}
                                            {formatDate(
                                              dateAt(trip.startDate, index),
                                            )}
                                            {duplicate ? ' · 이미 추가됨' : ''}
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
            </>
          )}
          {workspace === 'files' && (
            <div className="workspace-panel">
              <AttachmentsPanel all />
            </div>
          )}
          {workspace === 'reservations' && (
            <Reservations trip={trip} onUpdate={onUpdate} />
          )}
          {workspace === 'checklist' && (
            <Checklist trip={trip} onUpdate={onUpdate} />
          )}
          {workspace === 'expenses' && (
            <Expenses
              trip={trip}
              onUpdate={onUpdate}
              initialExpense={expenseDraft}
            />
          )}
        </div>
      </div>
    </AttachmentsContext.Provider>
  )
}

export default function App() {
  useGuideCatalog()
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
  const [savedCity, setSavedCity] = useState('전체')
  const [savedQuery, setSavedQuery] = useState('')
  const [savedTab, setSavedTab] = useState<'cities' | 'places'>('places')
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [toast, setToast] = useState('')
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
        `${nav.getBoundingClientRect().height}px`,
      )
    const observer = new ResizeObserver(measure)
    observer.observe(nav)
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
  const navigationRef = useRef({ page, dialog })
  navigationRef.current = { page, dialog }
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    const showHome = () => {
      setDialog(null)
      setToast('')
      setPage('home')
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('jido:launcher-open', showHome)
    return () => window.removeEventListener('jido:launcher-open', showHome)
  }, [])
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listener = NativeApp.addListener('backButton', () => {
      const preview = document.querySelector('dialog.attachment-preview[open]')
      if (preview) {
        preview.dispatchEvent(new Event('cancel', { cancelable: true }))
        return
      }
      if (navigationRef.current.dialog) setDialog(null)
      else if (navigationRef.current.page !== 'home') setPage('home')
      else void NativeApp.exitApp()
    })
    return () => {
      void listener.then((handle) => handle.remove())
    }
  }, [])
  const navigate = (target: Page) => {
    setPage(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const openCity = (id: string) => setDialog({ type: 'city', id })
  const openPlace = (id: string) => setDialog({ type: 'place', id })
  const toggleSaved = (type: 'savedCities' | 'savedPlaces', id: string) => {
    const saved = store[type].includes(id)
    setStore((previous) => ({
      ...previous,
      [type]: saved
        ? previous[type].filter((item) => item !== id)
        : [...previous[type], id],
    }))
    setToast(saved ? '저장을 취소했어요.' : '저장한 곳에 담았어요.')
  }
  const search = (event: FormEvent) => {
    event.preventDefault()
    setRegion('전체')
    setCategory('전체')
    setExploreCity('전체')
    setExploreTab(
      !cities.some((city) => matchesCity(city, query)) &&
        places.some((place) =>
          matchesPlace(place, getCity(place.cityId)!, query),
        )
        ? 'places'
        : 'cities',
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
    if (trip.days[day].some((stop) => stop.placeId === placeId)) {
      setToast('이날 일정에 이미 있는 장소예요.')
      return
    }
    const stop: Stop = {
      id: crypto.randomUUID(),
      placeId,
      time: `${String(Math.min(10 + trip.days[day].length * 2, 22)).padStart(2, '0')}:00`,
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
    setToast('일정에 장소를 추가했어요.')
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
  const savedPlaceList = store.savedPlaces
    .map(getPlace)
    .filter((place): place is Place => !!place)
  const savedCityOptions = [
    ...new Set(savedPlaceList.map((place) => place.cityId)),
  ]
  const effectiveSavedCity = savedCityOptions.includes(savedCity)
    ? savedCity
    : '전체'
  const visibleSavedPlaces = savedPlaceList.filter(
    (place) =>
      (effectiveSavedCity === '전체' || place.cityId === effectiveSavedCity) &&
      matchesPlace(place, getCity(place.cityId)!, savedQuery),
  )
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
          saved={store.savedCities.includes(city.id)}
          onSave={() => toggleSaved('savedCities', city.id)}
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
          saved={store.savedPlaces.includes(place.id)}
          onSave={() => toggleSaved('savedPlaces', place.id)}
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
                {item.id === 'saved' &&
                  store.savedPlaces.length + store.savedCities.length > 0 && (
                    <span className="nav-count" aria-hidden="true">
                      {store.savedPlaces.length + store.savedCities.length}
                    </span>
                  )}
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button header-info"
              aria-label="사진 출처"
              onClick={() => setDialog({ type: 'credits' })}
            >
              <Info size={20} />
            </button>
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
        {page === 'home' && (
          <TravelHome
            trip={activeTrip}
            trips={store.trips}
            savedCount={savedPlaceList.length}
            cities={cityCards(
              ['tokyo', 'osaka', 'kyoto', 'sapporo']
                .map(getCity)
                .filter((city): city is City => !!city),
            )}
            places={placeCards(
              [
                ...savedPlaceList,
                ...places.filter(
                  (place) =>
                    !store.savedPlaces.includes(place.id) &&
                    [
                      'tokyo-shibuya',
                      'osaka-dotonbori',
                      'kiyomizu',
                      'sapporo-odori',
                    ].includes(place.id),
                ),
              ].slice(0, 4),
            )}
            placesTitle={
              savedPlaceList.length >= 4
                ? '다시 볼 저장한 장소'
                : '여행에 담아둘 장소'
            }
            onCreate={() => setDialog({ type: 'create' })}
            onTrips={() => navigate('trips')}
            onSaved={() => navigate('saved')}
            onImport={() => setDialog({ type: 'backup' })}
            onExplore={(japan = false, showPlaces = false) => {
              setQuery('')
              setRegion(japan ? '일본' : '전체')
              setCategory('전체')
              setExploreCity('전체')
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
                onChange={(event) => setQuery(event.target.value)}
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
                가볼 만한 곳 <span>{filteredPlaces.length}</span>
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
                : filteredPlaces.length}
              개의 {exploreTab === 'cities' ? '여행지' : '장소'}
            </p>
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
                {placeCards(filteredPlaces.slice(0, placeLimit))}
                {filteredPlaces.length > placeLimit && (
                  <button
                    className="button outline full places-load-more"
                    onClick={() => setPlaceLimit((limit) => limit + 24)}
                  >
                    장소 더 보기 · {placeLimit}/{filteredPlaces.length}
                  </button>
                )}
              </>
            ) : (
              <EmptyState
                icon={<Search size={30} />}
                title="검색 결과가 없어요"
                description="검색어나 지역, 장소 유형을 바꿔보세요."
                action="모든 장소 보기"
                onAction={() => {
                  setQuery('')
                  setRegion('전체')
                  setCategory('전체')
                  setExploreCity('전체')
                }}
              />
            )}
          </section>
        )}
        {page === 'saved' && (
          <section className="page-section">
            <div className="page-title">
              <h1>
                여행 후보 장소
                <Heart className="title-heart" size={29} />
              </h1>
            </div>
            <div className="saved-notice">
              <Bookmark size={17} />
              <span>저장한 곳은 이 기기에서 다시 볼 수 있어요.</span>
            </div>
            <div className="page-tabs" role="tablist" aria-label="저장한 항목">
              <button
                role="tab"
                aria-selected={savedTab === 'places'}
                className={savedTab === 'places' ? 'active' : ''}
                onClick={() => setSavedTab('places')}
              >
                장소 <span>{store.savedPlaces.length}</span>
              </button>
              <button
                role="tab"
                aria-selected={savedTab === 'cities'}
                className={savedTab === 'cities' ? 'active' : ''}
                onClick={() => setSavedTab('cities')}
              >
                도시 <span>{store.savedCities.length}</span>
              </button>
            </div>
            {savedTab === 'places' && savedPlaceList.length > 0 && (
              <div className="saved-controls">
                <div className="input-search">
                  <Search size={18} />
                  <input
                    aria-label="저장한 장소 검색"
                    placeholder="저장한 장소에서 찾아보세요"
                    value={savedQuery}
                    onChange={(event) => setSavedQuery(event.target.value)}
                  />
                  {savedQuery && (
                    <button
                      className="icon-button"
                      aria-label="저장 검색어 지우기"
                      onClick={() => setSavedQuery('')}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                <div className="filter-row" aria-label="저장한 장소의 도시">
                  <button
                    className={`filter ${effectiveSavedCity === '전체' ? 'active' : ''}`}
                    aria-pressed={effectiveSavedCity === '전체'}
                    onClick={() => setSavedCity('전체')}
                  >
                    전체
                  </button>
                  {savedCityOptions.map((id) => (
                    <button
                      key={id}
                      className={`filter ${effectiveSavedCity === id ? 'active' : ''}`}
                      aria-pressed={effectiveSavedCity === id}
                      onClick={() => setSavedCity(id)}
                    >
                      {getCity(id)!.name}
                    </button>
                  ))}
                </div>
                <p className="result-count">
                  저장한 장소 {visibleSavedPlaces.length}곳
                </p>
              </div>
            )}
            {savedTab === 'places' ? (
              store.savedPlaces.length ? (
                visibleSavedPlaces.length ? (
                  placeCards(visibleSavedPlaces)
                ) : (
                  <EmptyState
                    icon={<Search size={30} />}
                    title="조건에 맞는 저장 장소가 없어요"
                    description="도시나 검색어를 바꿔보세요."
                    action="저장한 장소 모두 보기"
                    onAction={() => {
                      setSavedCity('전체')
                      setSavedQuery('')
                    }}
                  />
                )
              ) : (
                <EmptyState
                  icon={<Heart size={32} />}
                  title="아직 비어 있는 여행 취향"
                  description="장소의 하트를 눌러 가고 싶은 곳을 모아보세요."
                  action="장소 발견하기"
                  onAction={() => {
                    setQuery('')
                    setRegion('전체')
                    setExploreTab('places')
                    navigate('explore')
                  }}
                />
              )
            ) : store.savedCities.length ? (
              cityCards(
                store.savedCities
                  .map(getCity)
                  .filter((city): city is City => !!city),
              )
            ) : (
              <EmptyState
                icon={<Earth size={32} />}
                title="마음에 드는 도시를 담아보세요"
                description="도시의 하트를 누르면 여기에 모아둘 수 있어요."
                action="여행지 둘러보기"
                onAction={() => {
                  setQuery('')
                  setRegion('전체')
                  setExploreTab('cities')
                  navigate('explore')
                }}
              />
            )}
          </section>
        )}
        {page === 'trips' && (
          <section className="page-section trips-page">
            <div className="page-title trip-page-title">
              <div>
                <h1>내 여행</h1>
                <button
                  className="text-button"
                  onClick={() => setDialog({ type: 'backup' })}
                >
                  여행 백업·공유 <ExternalLink size={14} />
                </button>
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
                <Itinerary
                  key={activeTrip.id}
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
                  onAdd={() =>
                    setDialog({
                      type: 'custom',
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
                {item.id === 'saved' &&
                  store.savedPlaces.length + store.savedCities.length > 0 && (
                    <i />
                  )}
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
            trips={store.trips}
            activeTrip={activeTrip}
            onRestore={(trips) => {
              setStore((previous) => ({
                ...previous,
                trips: [...previous.trips, ...trips],
              }))
              setActiveTripId(trips[0]?.id || '')
              setActiveDay(0)
            }}
          />
        </Modal>
      )}
      {dialog?.type === 'create' && (
        <Modal title="새로운 여행 만들기" onClose={() => setDialog(null)}>
          <CreateTrip
            initialName={
              dialog.cityId === 'custom' ? query.trim().slice(0, 80) : ''
            }
            cityId={dialog.cityId}
            placeId={dialog.placeId}
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
              title={stop ? '직접 추가한 일정 수정' : '장소 추가'}
              onClose={() => setDialog(null)}
            >
              <CustomStopForm
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
          return (
            <Modal
              title={`${city.name} 여행 가이드`}
              onClose={() => setDialog(null)}
              wide
            >
              <div className="city-detail-hero">
                <img src={city.image} alt={`${city.name} 여행 풍경`} />

                <div>
                  <span>{city.country}</span>
                  <h2>{city.name}</h2>
                  <p>{city.tagline}</p>
                </div>
                <SaveButton
                  saved={store.savedCities.includes(city.id)}
                  label={city.name}
                  onClick={() => toggleSaved('savedCities', city.id)}
                />
              </div>
              <div className="modal-body">
                <p className="city-intro">{city.description}</p>
                <GuideContent guide={getGuide(city.id)} cityId={city.id} />
                <div className="city-facts">
                  <div>
                    <Plane size={19} />
                    <span>
                      공항·접근<strong>{city.flight}</strong>
                    </span>
                  </div>
                  <div>
                    <Clock3 size={19} />
                    <span>
                      시차<strong>{city.timeDifference}</strong>
                    </span>
                  </div>
                  <div>
                    <CalendarDays size={19} />
                    <span>
                      추천 시기<strong>{city.season}</strong>
                    </span>
                  </div>
                  <div>
                    <Earth size={19} />
                    <span>
                      통화<strong>{city.currency}</strong>
                    </span>
                  </div>
                </div>
                <button
                  className="button primary full city-plan-button"
                  onClick={() => setDialog({ type: 'create', cityId: city.id })}
                >
                  <Plus size={18} />
                  {city.name} 여행 만들기
                </button>
                <div className="detail-section-heading">
                  <h3>이 도시에서 꼭 가볼 곳</h3>
                  <span>
                    {places.filter((place) => place.cityId === city.id).length}
                    곳
                  </span>
                </div>
                <div className="detail-place-list">
                  {places
                    .filter((place) => place.cityId === city.id)
                    .map((place) => {
                      const Icon = categoryIcon[place.category]
                      return (
                        <div key={place.id}>
                          <span className="detail-place-icon">
                            <Icon size={18} />
                          </span>
                          <button onClick={() => openPlace(place.id)}>
                            <strong>{place.name}</strong>
                            <span>
                              {place.category} · {place.duration}
                            </span>
                          </button>
                          <SaveButton
                            saved={store.savedPlaces.includes(place.id)}
                            label={place.name}
                            onClick={() => toggleSaved('savedPlaces', place.id)}
                            small
                          />
                          <button
                            className="icon-button"
                            aria-label={`${place.name} 자세히 보기`}
                            onClick={() => openPlace(place.id)}
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                      )
                    })}
                </div>
              </div>
            </Modal>
          )
        })()}
      {dialog?.type === 'place' &&
        (() => {
          const place = getPlace(dialog.id)!
          const city = getCity(place.cityId)!
          return (
            <Modal title={place.name} onClose={() => setDialog(null)}>
              <div className="place-detail-photo">
                <PlacePhoto place={place} alt={place.name} />

                <span>
                  {city.name} · {place.category}
                </span>
                <SaveButton
                  saved={store.savedPlaces.includes(place.id)}
                  label={place.name}
                  onClick={() => toggleSaved('savedPlaces', place.id)}
                />
              </div>
              <div className="modal-body">
                <span className="eyebrow">
                  {city.name} · {place.category}
                </span>
                <h3 className="place-detail-title">{place.name}</h3>
                {!placeCoordinates(place) && (
                  <p className="detail-footnote">
                    정확한 지도 위치 확인이 필요한 장소입니다.
                  </p>
                )}
                {place.english && (
                  <details className="place-original-name">
                    <summary>현지 이름 확인</summary>
                    <p lang="und">{place.english}</p>
                  </details>
                )}
                <p className="city-intro">{place.description}</p>
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
                  <p>
                    <Clock3 size={17} />
                    <span>추천 체류 시간 · {place.duration}</span>
                  </p>
                  <p>
                    <Bookmark size={17} />
                    <span>{place.cost}</span>
                  </p>
                </div>
                <PlaceReviews place={place} />
                <div className="place-tip">
                  <Sparkles size={18} />
                  <div>
                    <strong>작은 여행 팁</strong>
                    <p>{place.tip}</p>
                  </div>
                </div>
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
                  <Plus size={17} />내 일정에 추가
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
            onAdd={(tripId, day) => addStop(tripId, day, dialog.placeId)}
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
      {dialog?.type === 'picker' &&
        (() => {
          const trip = store.trips.find((item) => item.id === dialog.tripId)!
          return (
            <Modal
              title={`${destinationForDay(trip, dialog.day).name}에서 가볼 곳`}
              onClose={() => setDialog(null)}
            >
              <PlacePicker
                trip={trip}
                savedPlaces={store.savedPlaces}
                onCustom={() =>
                  setDialog({
                    type: 'custom',
                    tripId: trip.id,
                    day: dialog.day,
                  })
                }
                day={dialog.day}
                onGoogleAdd={(place) => {
                  if (
                    trip.days[dialog.day].some(
                      (stop) =>
                        (place.provider === 'google'
                          ? stop.custom?.googlePlaceId
                          : stop.custom?.osmPlaceId) === place.id,
                    )
                  ) {
                    setToast('이미 일정에 있는 장소예요.')
                    return
                  }
                  updateTrip({
                    ...trip,
                    days: trip.days.map((items, index) =>
                      index === dialog.day
                        ? [
                            ...items,
                            {
                              id: crypto.randomUUID(),
                              placeId: `custom-${crypto.randomUUID()}`,
                              time: '10:00',
                              note: '',
                              custom: {
                                name: place.name,
                                kind: place.kind,
                                address: place.address,
                                link: place.link,
                                destinationId: destinationForDay(
                                  trip,
                                  dialog.day,
                                ).id,
                                ...(place.provider === 'google'
                                  ? { googlePlaceId: place.id }
                                  : { osmPlaceId: place.id }),
                                coordinates: place.coordinates,
                              },
                            },
                          ]
                        : items,
                    ),
                  })
                  setDialog(null)
                  setToast('일정에 장소를 추가했어요.')
                }}
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
              일정과 메모가 삭제돼요. 저장한 장소는 유지돼요.
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
