import { Plane } from 'lucide-react'
import type { Stop, Trip } from './travel-model'
import { dayTransferLegs } from './transfer-planning'

export function timelineDistance(
  trip: Trip,
  day: number,
  stop: Stop,
  visibleIds: string[],
  legs = dayTransferLegs(trip, day),
) {
  const stops = trip.days[day],
    index = stops.findIndex((item) => item.id === stop.id)
  const previous = stops[index - 1]
  if (!previous || !visibleIds.includes(previous.id)) return undefined
  const leg = legs.find(
    (item) => item.previous.id === previous.id && item.stop.id === stop.id,
  )
  if (leg?.distance === undefined) return undefined
  return leg.distance < 1
    ? `${Math.round(leg.distance * 1000)}m`
    : `${leg.distance.toLocaleString('ko-KR', { maximumFractionDigits: leg.distance >= 1000 ? 0 : 1 })}km`
}
export default function TimelineRail({
  trip,
  stop,
  index,
  distance,
}: {
  trip: Trip
  stop: Stop
  index: number
  distance?: string
}) {
  const kind = trip.reservations?.find(
    (item) => item.id === stop.reservationId,
  )?.kind
  const Icon = kind === '항공' ? Plane : undefined
  return (
    <div className="timeline-rail">
      {distance !== undefined && (
        <div
          className="timeline-distance"
          aria-label={`이전 장소에서 직선 거리 ${distance}`}
        >
          <small>직선</small>
          <span>{distance}</span>
        </div>
      )}
      <span className="stop-number">
        {Icon ? (
          <>
            <Icon size={17} />
            <span className="timeline-a11y">
              {index + 1}번 {kind}
            </span>
          </>
        ) : (
          index + 1
        )}
      </span>
      {stop.time && (
        <time className="timeline-visit-time" dateTime={stop.time}>
          {stop.time}
        </time>
      )}
    </div>
  )
}
