import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cities, places } from '../src/data.ts'

const root = resolve(import.meta.dirname, '..')
function audit(kind, item) {
  const credit = item.photoCredit
  let reason = ''
  if (!credit || credit.file !== item.image) reason = 'missing-licensed-photo'
  else if (!item.image.startsWith('/images/')) reason = 'not-bundled-offline'
  else {
    try {
      const data = readFileSync(resolve(root, 'public', item.image.slice(1)))
      const jpeg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      const png = data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      const webp =
        data.toString('ascii', 0, 4) === 'RIFF' &&
        data.toString('ascii', 8, 12) === 'WEBP'
      if (!jpeg && !png && !webp) reason = 'missing-or-invalid-photo-bytes'
      if (!credit.sourceUrl || !credit.author || !credit.license)
        reason = 'incomplete-credit'
    } catch {
      reason = 'missing-photo-file'
    }
  }
  return {
    kind,
    id: item.id,
    name: item.name,
    cityId: item.cityId || item.id,
    image: item.image,
    ready: !reason,
    reason,
  }
}
const records = [
  ...cities.map((city) => audit('destination', city)),
  ...places.map((place) => audit('place', place)),
]
const summary = ['destination', 'place'].map((kind) => {
  const entries = records.filter((record) => record.kind === kind)
  return {
    kind,
    total: entries.length,
    ready: entries.filter((record) => record.ready).length,
    missing: entries.filter((record) => !record.ready).length,
  }
})
console.table(summary)
const output = process.argv.indexOf('--output')
if (output >= 0) {
  if (!process.argv[output + 1])
    throw new Error('--output requires a file path')
  writeFileSync(
    process.argv[output + 1],
    JSON.stringify(
      {
        scope: 'bundled-catalog-only; user photos are not inspected',
        summary,
        missing: records.filter((record) => !record.ready),
      },
      null,
      2,
    ) + '\n',
  )
}
if (
  process.argv.includes('--complete') &&
  records.some((record) => !record.ready)
)
  process.exitCode = 1
