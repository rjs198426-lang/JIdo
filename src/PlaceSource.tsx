import type { Stop } from './travel-model'
import { getPlace } from './catalog'
export default function PlaceSource({ stop }: { stop: Stop }) {
  const catalog = getPlace(stop.custom?.catalogPlaceId || stop.placeId)
  if (!stop.custom?.osmPlaceId && !catalog?.osmPlaceId) return null
  return (
    <small className="place-source">
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >
        © OpenStreetMap contributors · ODbL
      </a>
    </small>
  )
}
