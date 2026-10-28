// Compile reviewed public travel articles. No AI keys, personal data or runtime code.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { guideSchema } from '../src/guide-schema.ts'
import { guidebookIndexSchema } from '../src/guidebook-schema.ts'
const source = new URL('../guidebook-sources/', import.meta.url),
  out = new URL('../guidebooks/', import.meta.url)
const entries = []
const check = process.argv.includes('--check')
async function output(name, text) {
  if (check) {
    if ((await readFile(new URL(name, out), 'utf8')) !== text)
      throw new Error(`Guidebook output differs: ${name}`)
  } else {
    await writeFile(new URL(name, out), text)
  }
}
await mkdir(out, { recursive: true })
for (const name of (await readdir(source))
  .filter((f) => f.endsWith('.json'))
  .sort()) {
  const guide = guideSchema.parse(
    JSON.parse(await readFile(new URL(name, source), 'utf8')),
  )
  if (
    guide.status !== 'published' ||
    guide.scope !== 'city' ||
    !guide.id.startsWith('book-') ||
    !guide.city.timeZone ||
    guide.sources.length < 1 ||
    guide.sections.length < 6 ||
    guide.places.length < 5
  )
    throw new Error(`Incomplete reviewed guidebook: ${name}`)
  if (
    guide.city.image !== '/images/guide-placeholder.svg' ||
    guide.places.some(
      (p) =>
        p.image !== '/images/place-placeholder.svg' ||
        !p.id.startsWith(guide.id + '-'),
    )
  )
    throw new Error(`Unverified image or place namespace: ${name}`)
  const today = new Date().toISOString().slice(0, 10)
  for (const source of guide.sources)
    if (source.accessedAt > today || source.accessedAt < '2023-10-28')
      throw new Error(`Invalid source verification date: ${name}`)
  const text = JSON.stringify(guide, null, 2) + '\n',
    bytes = Buffer.byteLength(text),
    revision = createHash('sha256').update(text).digest('hex'),
    file = `${guide.id}-${revision}.json`
  await output(file, text)
  entries.push({
    id: guide.id,
    name: guide.city.name,
    english: guide.city.english,
    country: guide.city.country,
    summary: guide.city.tagline,
    region: guide.city.region,
    revision,
    file,
    bytes,
    updatedAt: guide.updatedAt,
    minBuild: 73,
    placeCount: guide.places.length,
  })
}
const index = guidebookIndexSchema.parse({
  schemaVersion: 1,
  updatedAt:
    entries
      .map((b) => b.updatedAt)
      .sort()
      .at(-1) || '2026-10-28T00:00:00.000Z',
  books: entries,
})
await output('manifest.json', JSON.stringify(index, null, 2) + '\n')
console.log(
  JSON.stringify({
    mode: check ? 'verified' : 'built',
    countries: new Set(entries.map((b) => b.country)).size,
    cities: entries.length,
    places: entries.reduce((n, b) => n + b.placeCount, 0),
    bytes: entries.reduce((n, b) => n + b.bytes, 0),
  }),
)
