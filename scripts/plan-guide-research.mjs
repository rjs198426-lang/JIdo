// Plan public research only: no API credentials, network requests or personal data.
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const normalize = (value) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·&-]+/g, '')
export function planNewCities(queue, index, limit = 5) {
  if (!Number.isInteger(limit) || limit < 5 || limit > 10)
    throw new Error('New-city batches must contain 5–10 cities.')
  const ids = new Set(index.guides.map((g) => g.id)),
    names = new Set(
      index.guides.map((g) => normalize(g.country) + '/' + normalize(g.name)),
    )
  const selected = []
  for (const city of queue.cities) {
    const key = normalize(city.country) + '/' + normalize(city.name)
    if (ids.has('book-' + city.slug) || ids.has(city.slug) || names.has(key))
      continue
    ids.add('book-' + city.slug)
    names.add(key)
    selected.push(city)
    if (selected.length === limit) break
  }
  return {
    mode: 'new',
    target: limit,
    minCompleted: 5,
    maxCompleted: 10,
    selected,
    needsMoreCandidates: selected.length < 5,
  }
}
export function planRefresh(
  index,
  today = new Date().toISOString().slice(0, 10),
) {
  const end = Date.parse(today + 'T00:00:00Z')
  if (!Number.isFinite(end)) throw new Error('Invalid review date')
  return {
    mode: 'refresh',
    today,
    selected: index.guides
      .map((g) => ({
        ...g,
        reviewPriorityDate: g.lastReviewedAt || g.sourceCheckedAt || null,
        daysSinceSourceCheck: g.sourceCheckedAt
          ? Math.floor(
              (end - Date.parse(g.sourceCheckedAt + 'T00:00:00Z')) / 86400000,
            )
          : null,
      }))
      .sort(
        (a, b) =>
          (a.reviewPriorityDate || '').localeCompare(
            b.reviewPriorityDate || '',
          ) || a.id.localeCompare(b.id),
      ),
    note: '확인일은 게시일이 아님. 오래된 확인일·변동 정보·최근 운영 변경을 우선하고 HTTP 200만으로 최신 검토 완료 처리하지 않음.',
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const index = JSON.parse(
    await readFile(
      new URL('../guidebook-database/index.json', import.meta.url),
      'utf8',
    ),
  )
  const mode = process.argv[2] || 'new'
  let result
  if (mode === 'new')
    result = planNewCities(
      JSON.parse(
        await readFile(
          new URL('../research/guidebooks/city-queue.json', import.meta.url),
          'utf8',
        ),
      ),
      index,
      Number(process.argv.find((v) => v.startsWith('--limit='))?.slice(8) || 5),
    )
  else if (mode === 'refresh') result = planRefresh(index)
  else throw new Error('Use new or refresh')
  console.log(JSON.stringify(result, null, 2))
}
