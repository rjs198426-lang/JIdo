import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  blogSearchRange,
  cityBlogSearches,
  placeBlogSearches,
} from '../src/blog-search'
import { isRecentBlog } from '../src/blog-recency'
import { placeCategories } from '../src/place-categories'
import { blogsForCity } from '../src/guide-blogs'
import evidence from '../research/guidebooks/runs/20261105T_blog-search-refresh.json' with { type: 'json' }

const today = new Date('2026-11-05T12:00:00Z')
const repository = fileURLToPath(new URL('../', import.meta.url))
test('모든 분류는 장소명 기본 질의와 서로 다른 주제 조합을 제공하고 후기를 필수 단어로 넣지 않음', () => {
  const expected = [
    '볼거리',
    '메뉴',
    '디저트',
    '객실',
    '공연',
    '쇼핑리스트',
    '준비물',
  ]
  placeCategories.forEach((category, index) => {
    const searches = placeBlogSearches(
      '괌',
      { name: '테스트 장소', category },
      today,
    )
    expect(searches).toHaveLength(5)
    expect(new Set(searches.map((s) => s.query)).size).toBe(5)
    expect(searches[0].query).toBe('괌 테스트 장소')
    expect(searches.some((s) => s.query.includes(expected[index]))).toBe(true)
    for (const item of searches) {
      expect(item.query).not.toContain('방문 후기')
      const url = new URL(item.url)
      expect(url.origin).toBe('https://search.naver.com')
      expect(url.searchParams.get('where')).toBe('blog')
      expect(url.searchParams.get('query')).toBe(item.query)
      expect(url.searchParams.get('nso')).toBe(
        'so:r,p:from20231105to20261105,a:all',
      )
    }
  })
})

test('PIC 별칭·영문명은 별도 질의로 넓히고 지역 중복·URL 기호를 안전하게 처리', () => {
  const searches = placeBlogSearches(
    '괌',
    {
      name: '퍼시픽 아일랜드 클럽 괌',
      category: '숙소',
      english: 'Pacific Islands Club Guam',
    },
    today,
  )
  expect(searches.find((s) => s.id === 'alias')?.query).toBe('괌 PIC')
  const odd = placeBlogSearches(
    '괌',
    {
      name: '괌 호텔 & 카페 #1?',
      category: '기타',
      english: 'Hotel & Cafe #1?',
    },
    today,
  )
  expect(odd[0].query).toBe('괌 호텔 & 카페 #1?')
  expect(new URL(odd[0].url).searchParams.get('query')).toBe(odd[0].query)
  expect(new URL(odd[0].url).hash).toBe('')
  expect(odd.find((s) => s.id === 'alias')?.query).toBe('괌 Hotel & Cafe #1?')
})

test('최근3년 검색 범위는 게시일 필터와 같은 경계·윤년 규칙이며 확인일을 쓰지 않음', () => {
  for (const date of ['2026-11-05', '2024-02-29', '2025-01-01']) {
    const now = new Date(date),
      range = blogSearchRange(now)
    expect(isRecentBlog({ publishedAt: range.start }, now)).toBe(true)
    const old = new Date(range.start)
    old.setUTCDate(old.getUTCDate() - 1)
    expect(
      isRecentBlog({ publishedAt: old.toISOString().slice(0, 10) }, now),
    ).toBe(false)
    expect(range.end).toBe(date)
  }
  expect(blogSearchRange(new Date('2024-02-29')).start).toBe('2021-02-28')
  expect(cityBlogSearches('괌', today).map((s) => s.id)).toEqual([
    'all',
    'course',
    'stay',
    'food',
    'transport',
    'shopping',
    'preparation',
  ])
})

test('조사 계획은 공개 DB의 도시와 분류만 사용하고 후보 계획을 실제 조사로 표시하지 않음', () => {
  const raw = execFileSync(
    process.execPath,
    [
      '--experimental-strip-types',
      'scripts/plan-blog-research.mjs',
      '--city=guam',
      '--category=숙소',
      '--limit=2',
    ],
    { cwd: repository, encoding: 'utf8' },
  )
  const plan = JSON.parse(raw)
  expect(plan.state).toBe('planned-not-researched')
  expect(plan.places).toHaveLength(2)
  expect(
    plan.places.every(
      (p: any) =>
        p.category === '숙소' && p.searches.some((s: any) => s.id === 'rooms'),
    ),
  ).toBe(true)
  expect(plan.citySearches).toHaveLength(7)
  expect(() =>
    execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/plan-blog-research.mjs',
        '--city=../../private',
      ],
      { cwd: repository, stdio: 'pipe' },
    ),
  ).toThrow()
})

test('적용한 괌 원문은 최근 게시일·본문 해시·명시적 보류와 연결하고 전체 재검토로 부풀리지 않음', () => {
  const added = blogsForCity('guam').filter(
    (post) => post.checkedAt === '2026-11-05',
  )
  expect(added).toHaveLength(6)
  expect(evidence.articlesRead).toBe(8)
  expect(evidence.counts.fullyReviewedCities).toBe(0)
  expect(evidence.blockedArticles).toHaveLength(2)
  for (const post of added) {
    const source = evidence.acceptedArticles.find((s) => s.url === post.url)
    expect(source?.publishedAt).toBe(post.publishedAt)
    expect(source?.articleTextSHA256).toMatch(/^[a-f0-9]{64}$/)
    expect(source?.photoDecision).toContain('not-copied')
    expect(evidence.blockedArticles.some((s) => s.url === post.url)).toBe(false)
  }
})

test('장소 상세에서 다양한 검색을 펼쳐도 외부 조회·개인 자료 변경 없이 가로 링크를 표시', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  const naverRequests: string[] = []
  page.on('request', (request) => {
    if (/naver.com/.test(request.url())) naverRequests.push(request.url())
  })
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page
    .locator('select')
    .filter({ has: page.locator('option[value="guam"]') })
    .selectOption('guam')
  await page
    .getByRole('button', { name: '호텔 닛코 괌 자세히 보기', exact: true })
    .click()
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  await page.getByText('주제별 블로그 검색', { exact: true }).click()
  const group = page.getByRole('group', {
    name: '주제별 블로그 검색',
    exact: true,
  })
  const meal = group.getByRole('link', { name: '조식·식사', exact: true })
  expect(
    new URL((await meal.getAttribute('href'))!).searchParams.get('query'),
  ).toBe('괌 호텔 닛코 괌 조식 식당')
  for (const link of await group.getByRole('link').all()) {
    await link.scrollIntoViewIfNeeded()
    const box = await link.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(43.5)
    expect(box!.width).toBeGreaterThan(90)
    expect(
      await link.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  expect(
    await page
      .getByRole('dialog')
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  expect(naverRequests).toEqual([])
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
  await page.screenshot({
    path: testInfo.outputPath('lodging-search-320.png'),
  })
})

test('도시 가이드는 오프라인에서 새 원문을 보여주고 주제별로 서로 다른 검색어를 제공', async ({
  page,
  context,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await context.setOffline(true)
  await page
    .getByRole('button', { name: '괌 여행지 자세히 보기', exact: true })
    .click()
  await page.getByText('추천 코스·블로그 후기', { exact: true }).click()
  await page.getByRole('tab', { name: '블로그 후기', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: '블로그 후기', exact: true })
  await expect(panel.locator('.guide-blog-list a')).toHaveCount(
    blogsForCity('guam').length,
  )
  await expect(panel).toContainText('PIC 식사 포함 상품 비교')
  await panel.getByText('주제별 블로그 검색', { exact: true }).click()
  const query = await panel
    .getByRole('link', { name: '쇼핑·기념품', exact: true })
    .getAttribute('href')
  expect(new URL(query!).searchParams.get('query')).toBe('괌 쇼핑리스트 기념품')
})
