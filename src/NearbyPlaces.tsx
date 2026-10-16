import { places, type Place } from './catalog'
import { placeCoordinates } from './place-location'
import { ChevronRight } from 'lucide-react'
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180,
    lat = (b.lat - a.lat) * r,
    lng = (b.lng - a.lng) * r
  const n =
    Math.sin(lat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(lng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(n), Math.sqrt(1 - n))
}
export function nearbyPlaces(place: Place) {
  const center = placeCoordinates(place)
  if (!center) return []
  return places
    .filter(
      (p) =>
        p.cityId === place.cityId && p.id !== place.id && placeCoordinates(p),
    )
    .map((p) => ({ place: p, distance: km(center, placeCoordinates(p)!) }))
    .filter((p) => p.distance <= 3)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
}
export default function NearbyPlaces({
  place,
  onOpen,
}: {
  place: Place
  onOpen: (id: string) => void
}) {
  const nearby = nearbyPlaces(place)
  if (!nearby.length) return null
  return (
    <section className="nearby-places" aria-label="주변 함께 볼 곳">
      <h3>주변 함께 볼 곳</h3>
      {nearby.map(({ place: p, distance }) => (
        <button key={p.id} onClick={() => onOpen(p.id)}>
          <span>
            <strong>{p.name}</strong>
            <small>
              {p.category} · 직선{' '}
              {distance < 1
                ? `${Math.round(distance * 1000)}m`
                : `${distance.toFixed(1)}km`}
            </small>
          </span>
          <ChevronRight size={18} />
        </button>
      ))}
    </section>
  )
}
