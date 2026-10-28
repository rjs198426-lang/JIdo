// Public guide data only. Never read runtime stores, personal guides or credentials.
import { DatabaseSync } from 'node:sqlite'
import { createHash, randomUUID } from 'node:crypto'
import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  rename,
  unlink,
} from 'node:fs/promises'
import { cities, places } from '../src/data.ts'
import { currentPlaceCategory } from '../src/category-balance.ts'
import { withBlogNotes } from '../src/blog-place-notes.ts'
import { z } from 'zod'
import { guideSchema } from '../src/guide-schema.ts'
import profiles from '../src/practical-guides.json' with { type: 'json' }
import plans from '../src/guide-plans.json' with { type: 'json' }

const root = new URL('../guidebook-database/', import.meta.url)
const check = process.argv.includes('--check')
const hash = (text) => createHash('sha256').update(text).digest('hex')
const json = (data) => JSON.stringify(data, null, 2) + '\n'
const reviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviews: z
      .array(
        z
          .object({
            guideId: z.string().min(1).max(100),
            checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            contentHash: z.string().regex(/^[a-f0-9]{64}$/),
            result: z.enum(['changed', 'unchanged', 'blocked']),
            urls: z
              .array(
                z
                  .string()
                  .url()
                  .refine((v) => v.startsWith('https://')),
              )
              .min(1)
              .max(30),
            evidencePath: z
              .string()
              .regex(/^research\/guidebooks\/runs\/[a-zA-Z0-9_-]+\.json$/),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict()
const reviews = reviewSchema.parse(
  JSON.parse(
    await readFile(
      new URL('../research/guidebooks/reviews.json', import.meta.url),
      'utf8',
    ),
  ),
).reviews
for (const review of reviews) {
  if (review.checkedAt > new Date().toISOString().slice(0, 10))
    throw new Error('Future research date')
  await readFile(new URL('../' + review.evidencePath, import.meta.url), 'utf8')
}
const rows = []
const importedAt = '2026-10-28'
function record(guide, origin, extra = {}) {
  guide = guideSchema.parse(guide)
  const dates = guide.sources.map((s) => s.accessedAt).sort()
  const content = { guide, ...extra }
  return {
    id: guide.id,
    name: guide.city.name,
    country: guide.city.country,
    origin,
    importedAt:
      origin === 'bundled'
        ? importedAt
        : (guide.publishedAt || guide.createdAt).slice(0, 10),
    sourceCheckedAt: dates[0] || null,
    latestSourceCheckedAt: dates.at(-1) || null,
    // Source dates describe existing evidence, not a new check by the importer.
    lastReviewedAt:
      reviews
        .filter(
          (r) =>
            r.guideId === guide.id &&
            r.contentHash === hash(json(content)) &&
            r.result !== 'blocked',
        )
        .map((r) => r.checkedAt)
        .sort()
        .at(-1) || null,
    contentHash: hash(json(content)),
    file: `records/${guide.id}.json`,
    content,
  }
}
const pairs = (items = []) =>
  items.map((item) => `${item.name}: ${item.advice}`).join('\n\n')
for (const city of cities) {
  const profile = profiles.find((p) => p.cityId === city.id)
  if (!profile) throw new Error(`Missing bundled practical guide: ${city.id}`)
  const sources = profile.sources
    .filter((s) => s.status === 'read')
    .map((s) => ({ title: s.title, url: s.url, accessedAt: s.checkedAt }))
  const sections = [
    ['overview', '도시 소개', profile.firstVisit],
    ['before', '출발 전 준비', profile.before.join('\n\n')],
    ['arrival', '공항과 시내 이동', pairs(profile.arrival)],
    ['stay', '숙소 지역 선택', pairs(profile.bases)],
    ['plan', '일정 계획', pairs(profile.timePlan)],
    ['notes', '현장 팁', profile.pitfalls.join('\n\n')],
    ['rain', '비 오는 날', profile.rainPlan],
  ].map(([id, title, body]) => ({ id: `${city.id}-${id}`, title, body }))
  const lastDate =
    sources
      .map((s) => s.accessedAt)
      .sort()
      .at(-1) || importedAt
  const timestamp = `${lastDate}T00:00:00.000Z`
  const guide = {
    id: city.id,
    scope: 'city',
    city,
    places: places
      .filter((p) => p.cityId === city.id)
      .map((p) => withBlogNotes(currentPlaceCategory(p))),
    sections,
    sources,
    status: 'published',
    requestId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: timestamp,
  }
  rows.push(
    record(guide, 'bundled', {
      practicalGuide: profile,
      plans: plans.find((p) => p.cityId === city.id) || null,
    }),
  )
}
for (const name of (
  await readdir(new URL('../guidebook-sources/', import.meta.url))
)
  .filter((n) => n.endsWith('.json'))
  .sort()) {
  rows.push(
    record(
      JSON.parse(
        await readFile(
          new URL('../guidebook-sources/' + name, import.meta.url),
          'utf8',
        ),
      ),
      'downloadable',
    ),
  )
}
rows.sort((a, b) => a.id.localeCompare(b.id, 'en'))
if (new Set(rows.map((r) => r.id)).size !== rows.length)
  throw new Error('Duplicate guide IDs')
const index = {
  schemaVersion: 1,
  description:
    '공개 여행 가이드만 수집한 데이터베이스. 개인 일정·사진·메모·기기 캐시는 포함하지 않음.',
  guideCount: rows.length,
  countryCount: new Set(rows.map((r) => r.country)).size,
  placeCount: rows.reduce((n, r) => n + r.content.guide.places.length, 0),
  origins: {
    bundled: rows.filter((r) => r.origin === 'bundled').length,
    downloadable: rows.filter((r) => r.origin === 'downloadable').length,
  },
  guides: rows.map(({ content, ...metadata }) => ({
    ...metadata,
    placeCount: content.guide.places.length,
    sectionCount: content.guide.sections.length,
  })),
}
await mkdir(new URL('records/', root), { recursive: true })
async function output(name, text) {
  const path = new URL(name, root)
  if (check) {
    if ((await readFile(path, 'utf8')) !== text)
      throw new Error(`Guide database differs: ${name}`)
  } else {
    await writeFile(path, text)
  }
}
for (const row of rows) await output(row.file, json(row.content))
await output('index.json', json(index))
const filename = new URL('guides.sqlite', root)
if (check) {
  const db = new DatabaseSync(filename.pathname, { readOnly: true })
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
      throw new Error('SQLite integrity failed')
    const actual = db
      .prepare(
        'SELECT id, origin, content_hash, last_reviewed_at, json FROM guides ORDER BY id',
      )
      .all()
    if (actual.length !== rows.length)
      throw new Error('SQLite guide count differs')
    for (const row of rows) {
      const saved = actual.find((r) => r.id === row.id)
      if (
        !saved ||
        saved.origin !== row.origin ||
        saved.content_hash !== row.contentHash ||
        saved.last_reviewed_at !== row.lastReviewedAt ||
        saved.json !== json(row.content)
      )
        throw new Error(`SQLite guide differs: ${row.id}`)
    }
    const counts = db
      .prepare(
        'SELECT (SELECT count(*) FROM places) places, (SELECT count(*) FROM sources) sources',
      )
      .get()
    if (
      counts.places !== index.placeCount ||
      counts.sources !==
        rows.reduce((n, r) => n + r.content.guide.sources.length, 0)
    )
      throw new Error('SQLite child counts differ')
    for (const row of rows) {
      const actualPlaces = db
        .prepare('SELECT id, json FROM places WHERE guide_id=? ORDER BY id')
        .all(row.id)
      for (const p of row.content.guide.places)
        if (actualPlaces.find((v) => v.id === p.id)?.json !== json(p))
          throw new Error(`SQLite place differs: ${p.id}`)
      const actualSources = db
        .prepare(
          'SELECT title,url,checked_at FROM sources WHERE guide_id=? ORDER BY ordinal',
        )
        .all(row.id)
      const expectedSources = row.content.guide.sources.map((s) => ({
        title: s.title,
        url: s.url,
        checked_at: s.accessedAt,
      }))
      if (JSON.stringify(actualSources) !== JSON.stringify(expectedSources))
        throw new Error(`SQLite sources differ: ${row.id}`)
    }
  } finally {
    db.close()
  }
} else {
  const temporary = new URL(`guides-${randomUUID()}.tmp`, root)
  const db = new DatabaseSync(temporary.pathname)
  try {
    db.exec(`PRAGMA foreign_keys=ON;
      CREATE TABLE guides(id TEXT PRIMARY KEY,name TEXT NOT NULL,country TEXT NOT NULL,last_reviewed_at TEXT,origin TEXT NOT NULL CHECK(origin IN ('bundled','downloadable')),imported_at TEXT NOT NULL,source_checked_at TEXT,latest_source_checked_at TEXT,content_hash TEXT NOT NULL,json TEXT NOT NULL CHECK(json_valid(json)));
      CREATE TABLE places(guide_id TEXT NOT NULL REFERENCES guides(id),id TEXT NOT NULL,name TEXT NOT NULL,category TEXT NOT NULL,json TEXT NOT NULL CHECK(json_valid(json)),PRIMARY KEY(guide_id,id));
      CREATE TABLE sources(guide_id TEXT NOT NULL REFERENCES guides(id),ordinal INTEGER NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,checked_at TEXT NOT NULL,PRIMARY KEY(guide_id,ordinal));
      CREATE INDEX guides_by_country ON guides(country);
      CREATE INDEX guides_by_review ON guides(source_checked_at);
      CREATE INDEX places_by_guide_category ON places(guide_id,category);`)
    db.exec('BEGIN IMMEDIATE')
    const insert = db.prepare(
        'INSERT INTO guides VALUES (?,?,?,?,?,?,?,?,?,?)',
      ),
      place = db.prepare('INSERT INTO places VALUES (?,?,?,?,?)'),
      source = db.prepare('INSERT INTO sources VALUES (?,?,?,?,?)')
    for (const row of rows) {
      insert.run(
        row.id,
        row.name,
        row.country,
        row.lastReviewedAt,
        row.origin,
        row.importedAt,
        row.sourceCheckedAt,
        row.latestSourceCheckedAt,
        row.contentHash,
        json(row.content),
      )
      for (const p of row.content.guide.places)
        place.run(row.id, p.id, p.name, p.category, json(p))
      row.content.guide.sources.forEach((s, i) =>
        source.run(row.id, i, s.title, s.url, s.accessedAt),
      )
    }
    db.exec('COMMIT')
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
      throw new Error('SQLite integrity failed')
  } catch (e) {
    db.close()
    await unlink(temporary).catch(() => {})
    throw e
  }
  db.close()
  await rename(temporary, filename)
}
console.log(
  JSON.stringify({
    mode: check ? 'verified' : 'built',
    guides: index.guideCount,
    countries: index.countryCount,
    places: index.placeCount,
    ...index.origins,
  }),
)
