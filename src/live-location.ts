import type { Place } from './data'
export type LivePosition = {
  lat: number
  lng: number
  accuracy: number
  timestamp: number
}
export function validLivePosition(position: LivePosition, now = Date.now()) {
  return (
    Number.isFinite(position.lat) &&
    Math.abs(position.lat) <= 90 &&
    Number.isFinite(position.lng) &&
    Math.abs(position.lng) <= 180 &&
    Number.isFinite(position.accuracy) &&
    position.accuracy >= 0 &&
    Number.isFinite(position.timestamp) &&
    position.timestamp <= now + 5000 &&
    now - position.timestamp <= 60000
  )
}
export function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const r = Math.PI / 180,
    dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r
  const x =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2
  return (
    6371000 *
    2 *
    Math.atan2(Math.sqrt(Math.max(0, x)), Math.sqrt(Math.max(0, 1 - x)))
  )
}
export function nearbyDining(
  places: Place[],
  position: LivePosition,
  now = Date.now(),
) {
  if (!validLivePosition(position, now)) return []
  return places
    .filter(
      (p) =>
        ['맛집', '카페'].includes(p.category) &&
        typeof p.lat === 'number' &&
        typeof p.lng === 'number' &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180,
    )
    .map((place) => ({
      place,
      distance: metersBetween(position, { lat: place.lat!, lng: place.lng! }),
    }))
    .filter((i) => i.distance <= 3000)
    .sort(
      (a, b) => a.distance - b.distance || a.place.id.localeCompare(b.place.id),
    )
    .slice(0, 6)
}
export function destinationProgress(
  current: LivePosition,
  previous: LivePosition | undefined,
  target: { lat: number; lng: number },
  now = Date.now(),
) {
  if (!validLivePosition(current, now)) return undefined
  const distance = metersBetween(current, target)
  const dy = ((target.lng - current.lng) * Math.PI) / 180,
    a = (current.lat * Math.PI) / 180,
    b = (target.lat * Math.PI) / 180
  const bearing =
    ((Math.atan2(
      Math.sin(dy) * Math.cos(b),
      Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(dy),
    ) *
      180) /
      Math.PI +
      360) %
    360
  const direction = [
    '북쪽',
    '북동쪽',
    '동쪽',
    '남동쪽',
    '남쪽',
    '남서쪽',
    '서쪽',
    '북서쪽',
  ][Math.round(bearing / 45) % 8]
  let movement = '위치를 갱신하면 이동 상황을 알려드려요.'
  if (current.accuracy > 100)
    movement = '위치 오차가 커서 이동 방향을 확인하기 어려워요.'
  else if (distance <= 80 && current.accuracy <= 50)
    movement = '다음 장소 근처에 있어요.'
  else if (
    previous &&
    validLivePosition(previous, now) &&
    current.timestamp > previous.timestamp &&
    previous.accuracy <= 100
  ) {
    const change = metersBetween(previous, target) - distance,
      margin = Math.max(25, (current.accuracy + previous.accuracy) / 2)
    movement =
      change > margin
        ? '다음 장소에 가까워지고 있어요.'
        : change < -margin
          ? '다음 장소와 거리가 멀어졌어요.'
          : '큰 거리 변화가 없어요.'
  }
  return { distance, direction, movement }
}
export function displayDistance(meters: number) {
  if (meters < 10) return '10m 이내'
  return meters < 1000
    ? `${Math.round(meters / 10) * 10}m`
    : `${(meters / 1000).toFixed(1)}km`
}
