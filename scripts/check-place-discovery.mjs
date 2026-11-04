// Audit only public guide records; never read personal runtime data or credentials.
import { readFile } from 'node:fs/promises'
import {
  placeDiscovery,
  canonicalMentionUrl,
  placeIdentityKey,
} from '../src/place-mention-ranking.ts'
import mentions from '../src/place-blogs.json' with { type: 'json' }
import samples from '../src/place-search-exposure.json' with { type: 'json' }
const read = async (file) =>
  JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'))
const index = await read('../guidebook-database/index.json')
const places = (
  await Promise.all(
    index.guides.map(
      async (guide) =>
        (await read(`../guidebook-database/${guide.file}`)).guide.places,
    ),
  )
).flat()
const identities = new Set(places.map(placeIdentityKey))
const articles = new Set()
for (const post of mentions) {
  const url = canonicalMentionUrl(post.url)
  if (!url || articles.has(url))
    throw new Error(`Invalid article URL: ${post.title}`)
  articles.add(url)
  if (
    !post.publishedAt ||
    !/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt) ||
    new Date(post.publishedAt).toISOString().slice(0, 10) !== post.publishedAt
  )
    throw new Error(`Invalid publication date: ${post.title}`)
  for (const match of post.places)
    if (!identities.has(placeIdentityKey(match)))
      throw new Error(`Unmatched identity: ${match.id}`)
}
for (const sample of samples) {
  if (
    !index.guides.some((guide) => guide.id === sample.cityId) ||
    !sample.query.trim() ||
    !Number.isFinite(Date.parse(sample.observedAt))
  )
    throw new Error('Invalid search sample')
  const ranks = new Set()
  for (const result of sample.results) {
    if (
      !canonicalMentionUrl(result.url) ||
      !Number.isSafeInteger(result.rank) ||
      result.rank <= 0 ||
      ranks.has(result.rank)
    )
      throw new Error('Invalid search result position')
    ranks.add(result.rank)
  }
}
const asOf =
  process.argv.find((arg) => arg.startsWith('--as-of='))?.slice(8) ||
  new Date().toISOString().slice(0, 10)
const today = new Date(`${asOf}T12:00:00Z`)
const metrics = places.map((place) => ({
  ...place,
  ...placeDiscovery.metrics(place, today),
}))
console.log(
  JSON.stringify(
    {
      asOf,
      guideCount: index.guideCount,
      placeCount: places.length,
      articleCount: mentions.length,
      recent: metrics.filter((p) => p.state === 'recent').length,
      expired: metrics.filter((p) => p.state === 'expired').length,
      unverified: metrics.filter((p) => p.state === 'unverified').length,
      measuredExposure: metrics.filter((p) => p.searchRank !== null).length,
      cities: index.guides.map((guide) => {
        const local = metrics.filter((p) => p.cityId === guide.id)
        return {
          id: guide.id,
          name: guide.name,
          total: local.length,
          recent: local.filter((p) => p.state === 'recent').length,
          expired: local.filter((p) => p.state === 'expired').length,
          unverified: local.filter((p) => p.state === 'unverified').length,
          measuredExposure: local.filter((p) => p.searchRank !== null).length,
        }
      }),
    },
    null,
    2,
  ),
)
