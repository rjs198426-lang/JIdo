import { cities, places, reviewedPlaceIds } from '../src/data.ts'

const complete = process.argv.includes('--complete')
const report = cities.map((city) => {
  const entries = places.filter((place) => place.cityId === city.id)
  const reviewed = entries.filter(
    (place) => reviewedPlaceIds.has(place.id) && place.reviewSources?.length,
  )
  return {
    city: city.name,
    total: entries.length,
    reviewed: reviewed.length,
    missing: Math.max(0, 50 - reviewed.length),
  }
})
console.table(report)
console.log(
  `현재 ${places.length}곳 · 확인한 후기 기반 ${reviewedPlaceIds.size}곳`,
)
if (complete && report.some((row) => row.reviewed < 50 || row.total > 100)) {
  console.error(
    '각 여행지에 후기 원문을 확인한 장소 50곳 이상, 전체 장소 100곳 이하가 필요합니다.',
  )
  process.exitCode = 1
}
