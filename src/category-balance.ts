import { placeCategories, type PlaceCategory } from './place-categories.ts'
import updates from './place-category-updates.json' with { type: 'json' }

const byId = new Map(updates.map((entry) => [entry.id, entry]))
// Only migrate a known bundled default. Personal categories and unrelated places
// with the same name or ID must retain the author's values.
export function currentPlaceCategory<
  T extends {
    id: string
    cityId: string
    name: string
    category: PlaceCategory
  },
>(place: T): T {
  const update = byId.get(place.id)
  return update &&
    place.cityId === update.cityId &&
    place.name === update.name &&
    place.category === update.previousCategory
    ? { ...place, category: update.category as PlaceCategory }
    : place
}

// Rotate categories for discovery without changing catalog order or itineraries.
export function balancedPlaces<T extends { category: PlaceCategory }>(
  places: T[],
): T[] {
  const buckets = placeCategories.map((category) =>
    places.filter((place) => place.category === category),
  )
  const result: T[] = []
  for (let index = 0; result.length < places.length; index++) {
    for (const bucket of buckets) if (bucket[index]) result.push(bucket[index])
  }
  return result
}
