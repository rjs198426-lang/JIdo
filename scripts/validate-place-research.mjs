import { cities, places, reviewedPlaceIds } from '../src/data.ts'
import { expandedGuideById } from '../src/expanded-guides.ts'
import { resortGuideById } from '../src/resort-guides.ts'

const complete = process.argv.includes('--complete')
const report = cities.map((city) => {
  const entries = places.filter((place) => place.cityId === city.id)
  const reviewed = entries.filter(
    (place) => reviewedPlaceIds.has(place.id) && place.reviewSources?.length,
  )
  const required =
    expandedGuideById.has(city.id) || resortGuideById.has(city.id) ? 20 : 50
  return {
    city: city.name,
    total: entries.length,
    reviewed: reviewed.length,
    required,
    missing: Math.max(0, required - reviewed.length),
  }
})
console.table(report)
console.log(
  `현재 ${places.length}곳 · 출처 자료가 있는 장소 ${reviewedPlaceIds.size}곳`,
)
if (complete && report.some((row) => row.missing > 0 || row.total > 100)) {
  console.error(
    '기존 여행지는 출처 장소 50곳, 추가 여행지는 20곳 이상이며 전체 장소는 여행지당 100곳 이하가 필요합니다.',
  )
  process.exitCode = 1
}
