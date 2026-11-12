import { getPlace } from './catalog'
import { placeCoordinates, placeMapQuery } from './place-location'
import { mapsSearch } from './google-maps'
import {
  tripDestinations,
  type Trip,
  type Destination,
  type CustomPlace,
  type Stop,
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
export function stopMatchesCustom(stop: Stop, place: CustomPlace) {
  return stop.custom
    ? registeredPlaceKey(stop.custom) === registeredPlaceKey(place)
    : !!place.catalogPlaceId && stop.placeId === place.catalogPlaceId
}
export type RegisteredPlace = {
  key: string
  personalId?: string
  description?: string
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
      const legacy = stop.custom ? undefined : getPlace(stop.placeId)
      const source = tripDestinations(trip).find((city) =>
        stop.custom
          ? city.id === stop.custom.destinationId
          : city.guideCityId === legacy?.cityId,
      )
      if (!source) continue
      if (destination && !sameDestination(source, destination)) continue
      const custom: CustomPlace | undefined =
        stop.custom ||
        (legacy
          ? {
              name: legacy.name,
              kind: legacy.category,
              address: legacy.address,
              destinationId: source.id,
              catalogPlaceId: legacy.id,
              coordinates: placeCoordinates(legacy),
              link: mapsSearch(placeMapQuery(legacy)),
            }
          : undefined)
      if (!custom) continue
      const key = `${source.guideCityId || normalized(source.country) + ':' + normalized(source.name)}:${registeredPlaceKey(custom)}`
      if (!found.has(key)) found.set(key, { key, custom, destination: source })
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
    place.description || '',
    place.destination.name,
    place.destination.country,
    /퍼시픽\s*아일랜드\s*클럽|pacific\s+islands?\s+club/i.test(
      place.custom.name,
    )
      ? 'PIC'
      : '',
  )
}
