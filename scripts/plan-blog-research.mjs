// Public research plan only. No remote requests, credentials or private stores.
import { readFile } from 'node:fs/promises'
import {
  cityBlogSearches,
  placeBlogSearches,
  blogSearchRange,
} from '../src/blog-search.ts'
const option = (name) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3)
const cityId = option('city')
const category = option('category')
const limit = Number(option('limit') || 5)
if (!cityId || !Number.isInteger(limit) || limit < 1 || limit > 50)
  throw new Error('Use --city=<public-guide-id> and --limit=1..50')
const index = JSON.parse(
  await readFile(
    new URL('../guidebook-database/index.json', import.meta.url),
    'utf8',
  ),
)
const item = index.guides.find((guide) => guide.id === cityId)
if (!item) throw new Error('Unknown public guide city')
const { guide } = JSON.parse(
  await readFile(
    new URL('../guidebook-database/' + item.file, import.meta.url),
    'utf8',
  ),
)
const matches = guide.places.filter(
  (place) => !category || place.category === category,
)
if (category && !matches.length)
  throw new Error('No places match this category')
console.log(
  JSON.stringify(
    {
      cityId,
      city: guide.city.name,
      publicationWindow: blogSearchRange(),
      state: 'planned-not-researched',
      citySearches: cityBlogSearches(guide.city.name),
      totalMatchedPlaces: matches.length,
      places: matches.slice(0, limit).map((place) => ({
        id: place.id,
        name: place.name,
        category: place.category,
        searches: placeBlogSearches(guide.city.name, place),
      })),
      verification:
        '여러 검색어로 후보를 찾고 원문 게시일·실제 방문 시점·지점/주소·협찬/제휴를 확인한다. 검색 결과·HTTP200·확인일을 최신 사실이나 언급 수로 간주하지 않는다. 요금·영업·예약·안전은 공식 원문으로 교차확인하며 검색어별 순위를 하나의 노출 순위로 합치지 않는다.',
    },
    null,
    2,
  ),
)
