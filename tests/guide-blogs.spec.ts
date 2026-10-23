import { test, expect } from '@playwright/test'
import { cities } from '../src/data'
import { guideBlogs, blogsForCity } from '../src/guide-blogs'
import research from '../public/guide-blog-research.json' with { type: 'json' }

test('모든 여행지의 실제 블로그 글은 본문 확인 근거와 연결되고 검색·블로그 홈을 글로 표시하지 않음', () => {
  expect(new Set(guideBlogs.map((post) => post.cityId))).toEqual(
    new Set(cities.map((city) => city.id)),
  )
  expect(guideBlogs).toHaveLength(88)
  for (const city of cities) {
    const posts = blogsForCity(city.id)
    expect(posts.length).toBeGreaterThanOrEqual(1)
    expect(new Set(posts.map((post) => post.url)).size).toBe(posts.length)
    for (const post of posts) {
      const url = new URL(post.url)
      expect(url.protocol).toBe('https:')
      expect(url.username + url.password + url.search).toBe('')
      expect(
        url.hostname === 'blog.naver.com' ||
          /^[\w-]+\.tistory\.com$/.test(url.hostname),
      ).toBe(true)
      expect(url.pathname).toMatch(
        url.hostname === 'blog.naver.com'
          ? /^\/[\w-]+\/\d+$/
          : /^\/(\d+|entry\/.+)$/,
      )
      const record = research.references.find(
        (record) => record.url === post.url && record.cityId === post.cityId,
      )
      expect(record?.httpStatus).toBe(200)
      expect(record?.articleTextLength).toBeGreaterThan(400)
      expect(record?.articleTextSHA256).toMatch(/^[a-f0-9]{64}$/)
      expect(record?.screeningNote.length).toBeGreaterThan(20)
      expect(post.title.length).toBeGreaterThan(5)
      expect(post.author.length).toBeGreaterThan(0)
    }
  }
})

test('새 탭은 오프라인에서 해당 도시 글을 보여주고 원문과 더 찾기는 외부 링크로 연결', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page.getByText('추천 코스·블로그 후기', { exact: true }).click()
  const tabs = page.getByRole('tablist', { name: '실전 가이드', exact: true })
  await expect(tabs.getByRole('tab')).toHaveCount(4)
  await tabs.getByRole('tab', { name: '블로그 후기', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: '블로그 후기', exact: true })
  const posts = blogsForCity('kyoto')
  await expect(panel.locator('.guide-blog-list a')).toHaveCount(posts.length)
  for (const post of posts) {
    const link = panel.getByRole('link').filter({ hasText: post.title })
    await expect(link).toHaveAttribute('href', post.url)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  await expect(panel.locator('iframe, img')).toHaveCount(0)
  expect(
    new URL(
      (await panel
        .getByRole('link', { name: '교토 후기 더 찾기', exact: true })
        .getAttribute('href')) as string,
    ).searchParams.get('query'),
  ).toBe('교토 자유여행 후기')
  await panel.getByText('후기 선정 기준', { exact: true }).click()
  await expect(panel).toContainText('조회수·인기 순위는 확인하지 않았습니다')
  await expect(panel).toContainText('원문 확인: 2026-10-16 ~ 2026-10-18')
  const filters = panel.getByRole('group', { name: '블로그 후기 주제' })
  await filters
    .getByRole('button', { name: '관광·여행기', exact: true })
    .click()
  await expect(panel.locator('.guide-blog-list a')).toHaveCount(
    posts.filter(
      (post) =>
        !/교통|공항|철도|버스|이동|맛집|식사|음식|카페|커피|먹거리/.test(
          post.topic + post.title,
        ),
    ).length,
  )
  await filters.getByRole('button', { name: '식사·카페', exact: true }).click()
  await expect(panel.locator('.guide-blog-list a')).toHaveCount(0)
  await expect(panel).toContainText('이 주제에 확인한 후기가 없어요.')
  await filters.getByRole('button', { name: '전체', exact: true }).click()
  await expect(panel.locator('.guide-blog-list a')).toHaveCount(posts.length)
  await tabs.getByRole('tab', { name: '지역별 코스', exact: true }).click()
  await expect(page.locator('.guide-course')).toHaveCount(3)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await expect(
    page
      .getByRole('tablist', { name: '도시 가이드', exact: true })
      .getByRole('tab', { name: '준비', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
})

test('320px 확대 글자에서도 네 탭·긴 제목·원문 버튼이 잘리지 않으며 키보드로 탭 전환', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page.addStyleTag({
    content:
      '.guide-tabs button, .guide-blog-copy strong, .guide-blog-copy small, .guide-blog-copy > span { font-size: 18px !important; }',
  })
  await page.getByText('추천 코스·블로그 후기', { exact: true }).click()
  const tabs = page.getByRole('tablist', { name: '실전 가이드', exact: true })
  const first = tabs.getByRole('tab').first()
  await first.focus()
  await page.keyboard.press('End')
  await expect(
    tabs.getByRole('tab', { name: '블로그 후기', exact: true }),
  ).toBeFocused()
  await expect(
    page.getByRole('tabpanel', { name: '블로그 후기', exact: true }),
  ).toBeVisible()
  expect(
    await tabs
      .getByRole('tab')
      .evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            node.getBoundingClientRect().height >= 44 &&
            node.scrollWidth <= node.clientWidth + 1,
        ),
      ),
  ).toBe(true)
  expect(
    await page
      .locator('.guide-blog-list a')
      .evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            node.getBoundingClientRect().height >= 44 &&
            node.scrollWidth <= node.clientWidth + 1,
        ),
      ),
  ).toBe(true)
  expect(
    await page
      .getByRole('dialog')
      .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
  ).toBe(true)
  await page.screenshot({ path: '/tmp/jido-guide-blogs-320.png' })
  await page.keyboard.press('ArrowLeft')
  await expect(
    tabs.getByRole('tab', { name: '예약·현장 팁', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
})

test('다른 여행지를 열면 그 도시의 글만 표시하고 이전 후기 탭 상태를 초기화', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  for (const cityId of ['osaka', 'singapore', 'saipan']) {
    const city = cities.find((city) => city.id === cityId)!
    await page
      .getByRole('button', {
        name: `${city.name} 여행지 자세히 보기`,
        exact: true,
      })
      .click()
    await page.getByText('추천 코스·블로그 후기', { exact: true }).click()
    await expect(
      page.getByRole('tab', { name: '처음 가면', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('tab', { name: '블로그 후기', exact: true }).click()
    expect(
      await page
        .locator('.guide-blog-list a')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
    ).toEqual(blogsForCity(cityId).map((post) => post.url))
    await page.getByRole('button', { name: '닫기', exact: true }).click()
  }
})
