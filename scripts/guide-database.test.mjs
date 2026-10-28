import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { cities, places } from '../src/data.ts'
import { withBlogNotes } from '../src/blog-place-notes.ts'
import { currentPlaceCategory } from '../src/category-balance.ts'
import { guideSchema } from '../src/guide-schema.ts'
import { planNewCities, planRefresh } from './plan-guide-research.mjs'
const root = new URL('../guidebook-database/', import.meta.url)
const index = JSON.parse(readFileSync(new URL('index.json', root), 'utf8'))
const queue = JSON.parse(
  readFileSync(
    new URL('../research/guidebooks/city-queue.json', import.meta.url),
    'utf8',
  ),
)
const read = (name) => JSON.parse(readFileSync(new URL(name, root), 'utf8'))
test('all bundled guides and places are imported with unchanged IDs, notes and photo credits', () => {
  const bundled = index.guides.filter((g) => g.origin === 'bundled')
  assert.deepEqual(
    bundled.map((g) => g.id).sort(),
    cities.map((c) => c.id).sort(),
  )
  for (const city of cities) {
    const content = read(`records/${city.id}.json`)
    const parsed = guideSchema.parse(content.guide)
    assert.deepEqual(parsed.city, city)
    const expected = places
      .filter((p) => p.cityId === city.id)
      .map((p) => withBlogNotes(currentPlaceCategory(p)))
    assert.deepEqual(
      parsed.places,
      expected.map((p) => guideSchema.shape.places.element.parse(p)),
    )
    assert.equal(content.practicalGuide.cityId, city.id)
    assert.equal(content.plans.cityId, city.id)
    const dates = content.practicalGuide.sources
      .filter((s) => s.status === 'read')
      .map((s) => s.checkedAt)
      .sort()
    assert.equal(
      index.guides.find((g) => g.id === city.id).sourceCheckedAt,
      dates[0] || null,
      'Import must preserve original check dates, including unknown',
    )
  }
  assert.equal(
    bundled.reduce((n, g) => n + g.placeCount, 0),
    places.length,
  )
})
test('downloaded originals exactly match database records and have separate origins', () => {
  const downloadable = index.guides.filter((g) => g.origin === 'downloadable')
  const manifest = JSON.parse(
    readFileSync(
      new URL('../guidebooks/manifest.json', import.meta.url),
      'utf8',
    ),
  )
  assert.equal(downloadable.length, manifest.books.length)
  for (const entry of downloadable) {
    const original = JSON.parse(
      readFileSync(
        new URL('../guidebook-sources/' + entry.id + '.json', import.meta.url),
        'utf8',
      ),
    )
    assert.deepEqual(read(entry.file).guide, original)
  }
  assert.equal(index.guideCount, cities.length + manifest.books.length)
  assert.equal(
    index.placeCount,
    places.length + manifest.books.reduce((n, g) => n + g.placeCount, 0),
  )
})
test('SQLite and JSON content hashes match, foreign keys and integrity hold', () => {
  const db = new DatabaseSync(new URL('guides.sqlite', root).pathname, {
    readOnly: true,
  })
  try {
    assert.equal(
      db.prepare('PRAGMA integrity_check').get().integrity_check,
      'ok',
    )
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
    const rows = db.prepare('SELECT * FROM guides').all()
    assert.equal(rows.length, index.guideCount)
    for (const row of rows) {
      const entry = index.guides.find((g) => g.id === row.id)
      const expected = readFileSync(new URL(entry.file, root), 'utf8')
      assert.equal(row.json, expected)
      assert.equal(
        row.content_hash,
        createHash('sha256').update(expected).digest('hex'),
      )
      assert.equal(
        db.prepare('SELECT count(*) n FROM places WHERE guide_id=?').get(row.id)
          .n,
        entry.placeCount,
      )
    }
    assert.equal(
      db.prepare('SELECT count(*) n FROM places').get().n,
      index.placeCount,
    )
  } finally {
    db.close()
  }
})
test('research batches select five to ten new cities, skip duplicates and reject invalid counts', () => {
  const first = planNewCities(queue, index, 5)
  assert.equal(first.selected.length, 5)
  assert.equal(first.needsMoreCandidates, false)
  const added = {
    guides: [
      ...index.guides,
      ...first.selected.map((c) => ({
        id: 'book-' + c.slug,
        name: c.name,
        country: c.country,
      })),
    ],
  }
  const next = planNewCities(queue, added, 10)
  assert.equal(next.selected.length, 10)
  assert.ok(
    next.selected.every((c) => !first.selected.some((p) => p.slug === c.slug)),
  )
  for (const invalid of [0, 4, 11, 5.5, NaN])
    assert.throws(() => planNewCities(queue, index, invalid))
  const duplicate = {
    cities: [
      queue.cities[0],
      queue.cities[0],
      {
        slug: 'alias',
        name: queue.cities[0].name,
        country: queue.cities[0].country,
      },
    ],
  }
  assert.equal(planNewCities(duplicate, index, 5).selected.length, 1)
  assert.equal(
    planNewCities({ cities: [] }, index, 5).needsMoreCandidates,
    true,
  )
})
test('refresh prioritizes missing or old evidence, preserves dates and source records', () => {
  const before = JSON.stringify(index)
  const plan = planRefresh(index, '2026-10-28')
  assert.equal(plan.selected.length, index.guideCount)
  assert.equal(plan.selected[0].origin, 'bundled')
  assert.ok(plan.selected.some((g) => g.daysSinceSourceCheck > 0))
  assert.equal(JSON.stringify(index), before)
  const fixture = {
    guides: [
      { id: 'fresh', sourceCheckedAt: '2026-10-28' },
      { id: 'old', sourceCheckedAt: '2020-01-01' },
      { id: 'unknown', sourceCheckedAt: null },
    ],
  }
  assert.deepEqual(
    planRefresh(fixture, '2026-10-28').selected.map((g) => g.id),
    ['unknown', 'old', 'fresh'],
  )
})

test('a real recent review changes priority without rewriting the original source date', () => {
  const data = {
    guides: [
      {
        id: 'recent-review',
        sourceCheckedAt: '2026-01-01',
        lastReviewedAt: '2026-10-28',
      },
      { id: 'unreviewed', sourceCheckedAt: '2026-10-01', lastReviewedAt: null },
    ],
  }
  const result = planRefresh(data, '2026-10-28')
  assert.deepEqual(
    result.selected.map((g) => g.id),
    ['unreviewed', 'recent-review'],
  )
  assert.equal(result.selected[1].sourceCheckedAt, '2026-01-01')
  assert.equal(result.selected[1].reviewPriorityDate, '2026-10-28')
})
