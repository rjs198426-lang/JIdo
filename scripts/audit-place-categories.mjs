import { writeFileSync } from 'node:fs'
import { cities, places, categoryOptions } from '../src/data.ts'

const categories = categoryOptions.slice(1)
const rows = cities.map((city) => {
  const local = places.filter((place) => place.cityId === city.id)
  return {
    city: city.name,
    total: local.length,
    ...Object.fromEntries(
      categories.map((category) => [
        category,
        local.filter((p) => p.category === category).length,
      ]),
    ),
  }
})
const summary = Object.fromEntries(
  categories.map((category) => [
    category,
    places.filter((p) => p.category === category).length,
  ]),
)
console.table(rows)
console.log(summary)
const out = process.argv.indexOf('--output')
if (out >= 0) {
  if (!process.argv[out + 1]) throw new Error('--output requires a path')
  writeFileSync(
    process.argv[out + 1],
    JSON.stringify(
      {
        scope: 'bundled catalog only; personal data not inspected',
        total: places.length,
        summary,
        cities: rows,
      },
      null,
      2,
    ) + '\n',
  )
}
if (
  rows.some(
    (row) =>
      categories.some((category) => row[category] < 1) ||
      ['맛집', '카페', '숙소'].some((category) => row[category] < 2),
  )
) {
  console.error(
    'Each destination needs all categories and at least two dining, cafe and accommodation choices.',
  )
  process.exitCode = 1
}
