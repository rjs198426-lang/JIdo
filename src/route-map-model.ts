import { getPlace } from './catalog'
import { stopName, type Stop } from './travel-model'
export type RoutePoint = {
  stopId: string
  number: number
  name: string
  lat: number
  lng: number
}
export function routePoints(stops: Stop[]): RoutePoint[] {
  let previousLongitude: number | undefined
  return stops.flatMap((stop, index) => {
    const position = stop.custom
      ? stop.custom.coordinates ||
        (stop.custom.catalogPlaceId
          ? getPlace(stop.custom.catalogPlaceId)
          : undefined)
      : getPlace(stop.placeId)
    if (
      !position ||
      typeof position.lat !== 'number' ||
      typeof position.lng !== 'number' ||
      !Number.isFinite(position.lat) ||
      !Number.isFinite(position.lng) ||
      Math.abs(position.lat) > 90 ||
      Math.abs(position.lng) > 180
    )
      return []
    let lng = position.lng
    if (previousLongitude !== undefined) {
      while (lng - previousLongitude > 180) lng -= 360
      while (lng - previousLongitude < -180) lng += 360
    }
    previousLongitude = lng
    return [
      {
        stopId: stop.id,
        number: index + 1,
        name: stopName(stop),
        lat: position.lat,
        lng,
      },
    ]
  })
}
export function routeSegments(points: RoutePoint[]) {
  const segments: RoutePoint[][] = []
  for (const point of points) {
    const last = segments.at(-1)
    if (last?.at(-1)?.number === point.number - 1) last.push(point)
    else segments.push([point])
  }
  return segments.filter((segment) => segment.length > 1)
}
