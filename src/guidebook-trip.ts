import type { Place } from './data'
import type { CustomPlace } from './travel-model'
// A downloaded guide is disposable public content; a personal itinerary isn't.
export function guidebookPlaceSnapshot(
  place: Place,
  destinationId: string,
): CustomPlace | undefined {
  if (!place.cityId.startsWith('book-')) return undefined
  return {
    name: place.name,
    kind: place.category,
    address: place.address,
    link: '',
    destinationId,
    catalogPlaceId: place.id,
    ...(place.lat !== undefined && place.lng !== undefined
      ? { coordinates: { lat: place.lat, lng: place.lng } }
      : {}),
  }
}
