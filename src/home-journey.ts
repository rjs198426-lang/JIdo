import { getCity, places, type City } from './catalog'
import { balancedPlaces } from './category-balance'
import { tripClock } from './destination-time'
import { journeyPreference } from './journey-personal'
import { dateAt, dayCount } from './store'
import {
  destinationForDay,
  tripCity,
  tripDestinations,
  type Trip,
} from './travel-model'

export function journeyPhase(trip: Trip, now = new Date()) {
  // A destination can be one calendar day either side of UTC. Check only
  // nearby itinerary days so long, archived trips do not slow down Home.
  const utcDay = dayCount(trip.startDate, now.toISOString().slice(0, 10)) - 1
  const currentDay =
    [utcDay - 1, utcDay, utcDay + 1].find(
      (day) =>
        day >= 0 &&
        day < trip.days.length &&
        dateAt(trip.startDate, day) === tripClock(trip, day, now).date,
    ) ?? -1
  const departureDate = tripClock(trip, 0, now).date
  return {
    phase:
      currentDay >= 0
        ? ('ongoing' as const)
        : trip.startDate > departureDate
          ? ('upcoming' as const)
          : ('past' as const),
    currentDay: currentDay >= 0 ? currentDay : null,
    until: dayCount(departureDate, trip.startDate) - 1,
  }
}

// Reading Home must never change the selected trip, saved day or trip contents.
export function homeJourney(
  trips: Trip[],
  activeTripId: string,
  now = new Date(),
) {
  const states = trips.map((trip) => ({ trip, ...journeyPhase(trip, now) }))
  const ongoing = states
    .filter((entry) => entry.phase === 'ongoing')
    .sort(
      (a, b) =>
        Number(b.trip.id === activeTripId) -
          Number(a.trip.id === activeTripId) ||
        b.trip.startDate.localeCompare(a.trip.startDate) ||
        a.trip.id.localeCompare(b.trip.id),
    )
  const upcoming = states
    .filter((entry) => entry.phase === 'upcoming')
    .sort(
      (a, b) =>
        a.trip.startDate.localeCompare(b.trip.startDate) ||
        Number(b.trip.id === activeTripId) -
          Number(a.trip.id === activeTripId) ||
        a.trip.id.localeCompare(b.trip.id),
    )
  const past = states
    .filter((entry) => entry.phase === 'past')
    .sort(
      (a, b) =>
        b.trip.endDate.localeCompare(a.trip.endDate) ||
        a.trip.id.localeCompare(b.trip.id),
    )
  const selected =
    ongoing[0] ||
    upcoming[0] ||
    past.find((entry) => entry.trip.id === activeTripId) ||
    past[0]
  if (!selected) return undefined
  const { trip } = selected
  const day = selected.currentDay ?? journeyPreference(trip).day
  const destination = destinationForDay(trip, day)
  const city = getCity(destination.guideCityId || '')
  const heroCity: City = city || {
    ...tripCity(trip),
    id: destination.id,
    name: destination.name,
    country: destination.country,
    image: '/images/guide-placeholder.svg',
    photoCredit: undefined,
  }
  const cities = [
    ...new Map(
      tripDestinations(trip).flatMap((destination) => {
        const city = getCity(destination.guideCityId || '')
        return city ? [[city.id, city] as const] : []
      }),
    ).values(),
  ]
  const planned = new Set(
    trip.days.flat().map((stop) => stop.custom?.catalogPlaceId || stop.placeId),
  )
  const recommendations = city
    ? balancedPlaces(
        places.filter(
          (place) => place.cityId === city.id && !planned.has(place.id),
        ),
      ).slice(0, 4)
    : []
  return {
    ...selected,
    day,
    destination,
    city,
    heroCity,
    cities,
    recommendations,
    personalized: selected.phase !== 'past',
  }
}
export type HomeJourney = NonNullable<ReturnType<typeof homeJourney>>
