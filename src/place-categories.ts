// Shared by guides, saved stops and backups so categories survive round trips.
export const placeCategories = [
  '관광',
  '맛집',
  '카페',
  '숙소',
  '바·공연',
  '쇼핑',
  '체험',
] as const
export type PlaceCategory = (typeof placeCategories)[number]
export const customPlaceKinds = [...placeCategories, '이동', '기타'] as const

export function osmPlaceKind(
  key: string,
  value: string,
): (typeof customPlaceKinds)[number] {
  if (value === 'cafe') return '카페'
  if (['restaurant', 'fast_food', 'food_court'].includes(value)) return '맛집'
  if (['hotel', 'hostel', 'guest_house', 'motel'].includes(value)) return '숙소'
  if (['station', 'aerodrome', 'bus_station', 'halt'].includes(value))
    return '이동'
  if (['bar', 'pub', 'nightclub', 'theatre', 'music_venue'].includes(value))
    return '바·공연'
  if (key === 'shop' || value === 'marketplace') return '쇼핑'
  if (
    [
      'water_park',
      'theme_park',
      'sports_centre',
      'fitness_centre',
      'swimming_pool',
      'bowling_alley',
      'cinema',
      'public_bath',
      'spa',
    ].includes(value)
  )
    return '체험'
  return '관광'
}

export function googlePlaceKind(
  types: string[],
): (typeof customPlaceKinds)[number] {
  const has = (candidates: string[]) =>
    types.some((type) => candidates.includes(type))
  if (has(['cafe'])) return '카페'
  if (has(['restaurant'])) return '맛집'
  if (has(['lodging'])) return '숙소'
  if (has(['airport', 'train_station', 'transit_station'])) return '이동'
  if (has(['bar', 'night_club', 'performing_arts_theater'])) return '바·공연'
  if (
    has([
      'shopping_mall',
      'department_store',
      'supermarket',
      'book_store',
      'store',
    ])
  )
    return '쇼핑'
  if (
    has([
      'amusement_park',
      'water_park',
      'spa',
      'bowling_alley',
      'movie_theater',
      'sports_complex',
      'swimming_pool',
    ])
  )
    return '체험'
  return '관광'
}
