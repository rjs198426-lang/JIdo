import type { City, Place } from './data'

// Ignore case and repeated spacing, while allowing words in any order.
export function matchesSearch(query: string, ...fields: string[]) {
  const normalize = (value: string) =>
    value.normalize('NFKC').toLocaleLowerCase().trim()
  const haystack = normalize(fields.join(' '))
  return normalize(query)
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}
export function matchesCity(city: City, query: string) {
  return matchesSearch(
    query,
    city.name,
    city.english,
    city.country,
    ...city.tags,
  )
}
export function matchesPlace(place: Place, city: City, query: string) {
  return matchesSearch(
    query,
    place.name,
    place.english,
    place.category,
    place.area || '',
    city.name,
    city.english,
    city.country,
  )
}
