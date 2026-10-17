import { places } from './catalog'
import {
  tripDestinations,
  type Trip,
  type Destination,
  type CustomPlace,
} from './travel-model'
import { matchesSearch } from './search'

const normalized = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
export function registeredPlaceKey(place: CustomPlace) {
  if (place.catalogPlaceId) return `catalog:${place.catalogPlaceId}`
  if (place.googlePlaceId) return `google:${place.googlePlaceId}`
  if (place.osmPlaceId) return `osm:${place.osmPlaceId}`
  return `manual:${normalized(place.name)}:${normalized(place.address)}`
}
export type RegisteredPlace = {
  key: string
  custom: CustomPlace
  destination: Destination
}
export function sameDestination(source: Destination, destination: Destination) {
  return source.guideCityId && destination.guideCityId
    ? source.guideCityId === destination.guideCityId
    : normalized(source.name) === normalized(destination.name) &&
        normalized(source.country) === normalized(destination.country)
}
export function registeredPlaces(trips: Trip[], destination?: Destination) {
  const found = new Map<string, RegisteredPlace>()
  for (const trip of trips) {
    for (const stop of trip.days.flat()) {
      if (!stop.custom) continue
      const source = tripDestinations(trip).find(
        (city) => city.id === stop.custom!.destinationId,
      )
      if (!source) continue
      if (destination && !sameDestination(source, destination)) continue
      if (
        stop.custom.catalogPlaceId &&
        places.some((place) => place.id === stop.custom!.catalogPlaceId)
      )
        continue
      const key = `${source.guideCityId || normalized(source.country) + ':' + normalized(source.name)}:${registeredPlaceKey(stop.custom)}`
      if (!found.has(key))
        found.set(key, { key, custom: stop.custom, destination: source })
    }
  }
  return [...found.values()]
}
export function matchesRegisteredPlace(place: RegisteredPlace, query: string) {
  return matchesSearch(
    query,
    place.custom.name,
    place.custom.address,
    place.custom.kind,
    place.destination.name,
    place.destination.country,
  )
}
