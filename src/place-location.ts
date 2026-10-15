export function placeCoordinates(place?: { lat?: number; lng?: number }) {
  if (
    typeof place?.lat !== 'number' ||
    typeof place.lng !== 'number' ||
    !Number.isFinite(place.lat) ||
    !Number.isFinite(place.lng) ||
    Math.abs(place.lat) > 90 ||
    Math.abs(place.lng) > 180
  )
    return undefined
  return { lat: place.lat, lng: place.lng }
}

export function placeMapQuery(place: {
  name: string
  english: string
  address: string
  lat?: number
  lng?: number
}) {
  const position = placeCoordinates(place)
  return position
    ? `${position.lat},${position.lng}`
    : [place.english.split(' · ')[0] || place.name, place.address].join(' ')
}
