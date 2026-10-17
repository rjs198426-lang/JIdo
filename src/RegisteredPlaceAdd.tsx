import { useState } from 'react'
import { destinationForDay, tripDestinations, type Trip } from './travel-model'
import { dateAt, formatDate } from './store'
import { sameDestination, type RegisteredPlace } from './registered-places'

export default function RegisteredPlaceAdd({
  entry,
  trips,
  activeTripId,
  initialDay,
  onAdd,
  onCreate,
  onManage,
}: {
  entry: RegisteredPlace
  trips: Trip[]
  activeTripId: string
  initialDay: number
  onAdd: (tripId: string, day: number) => void
  onCreate: () => void
  onManage: (tripId: string) => void
}) {
  const matching = trips.filter((trip) =>
    tripDestinations(trip).some((city) =>
      sameDestination(city, entry.destination),
    ),
  )
  const [tripId, setTripId] = useState(
    matching.find((trip) => trip.id === activeTripId)?.id ||
      matching[0]?.id ||
      '',
  )
  const [day, setDay] = useState<number | null>(
    matching.some((trip) => trip.id === activeTripId) ? initialDay : null,
  )
  const trip = matching.find((trip) => trip.id === tripId)
  const eligible =
    trip?.days.flatMap((_, index) =>
      sameDestination(destinationForDay(trip, index), entry.destination)
        ? [index]
        : [],
    ) || []
  const selected = day !== null && eligible.includes(day) ? day : eligible[0]
  return (
    <form
      className="modal-body"
      onSubmit={(event) => {
        event.preventDefault()
        if (trip && selected !== undefined) onAdd(trip.id, selected)
      }}
    >
      <h3>{entry.custom.name}</h3>
      <p className="muted">
        {entry.destination.name} · {entry.custom.address}
      </p>
      {trip ? (
        <>
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
              value={selected ?? ''}
              onChange={(event) => setDay(Number(event.target.value))}
            >
              {selected === undefined && (
                <option value="">이 도시의 날짜 미지정</option>
              )}
              {eligible.map((index) => (
                <option key={index} value={index}>
                  DAY {index + 1} · {formatDate(dateAt(trip.startDate, index))}
                </option>
              ))}
            </select>
          </label>
          {selected === undefined && (
            <button
              type="button"
              className="button outline full"
              onClick={() => onManage(trip.id)}
            >
              여행에서 체류 날짜 지정
            </button>
          )}
          <button
            type="submit"
            className="button primary full"
            disabled={selected === undefined}
          >
            일정에 추가
          </button>
        </>
      ) : (
        <button
          type="button"
          className="button primary full"
          onClick={onCreate}
        >
          이 장소와 여행 시작하기
        </button>
      )}
    </form>
  )
}
