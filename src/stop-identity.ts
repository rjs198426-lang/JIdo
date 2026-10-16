import type { Stop } from './travel-model'
export function sameStopPlace(a: Stop, b: Stop) {
  const aCatalog =
    a.custom?.catalogPlaceId || (!a.custom ? a.placeId : undefined)
  const bCatalog =
    b.custom?.catalogPlaceId || (!b.custom ? b.placeId : undefined)
  if (aCatalog && bCatalog) return aCatalog === bCatalog
  if (a.custom?.googlePlaceId && b.custom?.googlePlaceId)
    return a.custom.googlePlaceId === b.custom.googlePlaceId
  if (a.custom?.osmPlaceId && b.custom?.osmPlaceId)
    return a.custom.osmPlaceId === b.custom.osmPlaceId
  return a.placeId === b.placeId
}
