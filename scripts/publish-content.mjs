// Publish data only, never executable code or personal trip records.
import { cities, places } from '../src/data.ts'
import {
  publicContentSchema,
  contentManifestSchema,
} from '../src/content-schema.ts'
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const directory = new URL('../content/', import.meta.url)
const content = publicContentSchema.parse({ schemaVersion: 1, cities, places })
const bytes = Buffer.from(JSON.stringify(content))
const revision = createHash('sha256').update(bytes).digest('hex')
let previous
try {
  previous = JSON.parse(
    await readFile(new URL('manifest.json', directory), 'utf8'),
  )
} catch {}
if (previous?.revision === revision) {
  console.log('Public travel data is unchanged.')
  process.exit(0)
}
const manifest = contentManifestSchema.parse({
  schemaVersion: 1,
  sequence: (previous?.sequence || 0) + 1,
  revision,
  file: `catalog-${revision}.json`,
  bytes: bytes.length,
  minBuild: 58,
  publishedAt: new Date().toISOString(),
})
await mkdir(directory, { recursive: true })
await writeFile(new URL(manifest.file, directory), bytes)
await writeFile(
  new URL('manifest.json', directory),
  JSON.stringify(manifest, null, 2) + '\n',
)
// Git history retains prior immutable releases without shipping them in APKs.
for (const name of await readdir(directory))
  if (/^catalog-[a-f0-9]{64}\.json$/.test(name) && name !== manifest.file)
    await unlink(new URL(name, directory))
console.log(
  `Prepared content sequence ${manifest.sequence}: ${cities.length} cities, ${places.length} places, ${bytes.length} bytes.`,
)
