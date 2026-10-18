import type { Place } from './data'

// Lists use a complete opening sentence; visit duration remains an itinerary field.
export function placeIntroduction(place: Pick<Place, 'description'>) {
  return place.description.split(/(?<=[.!?。])\s|\n/)[0].trim()
}

export function meaningfulCost(cost: string) {
  return !!cost.trim() && !/확인|공식|미정|별도 문의/.test(cost)
}
