import { test, expect, type Page } from '@playwright/test'
import { cities, places } from '../src/data'
import posts from '../src/place-blogs.json' with { type: 'json' }
import stories from '../src/place-story-updates.json' with { type: 'json' }
import evidence from '../public/place-blog-research.json' with { type: 'json' }
import { blogsForPlace } from '../src/place-blogs'
import { withBlogNotes } from '../src/blog-place-notes'
import { placeIntroduction } from '../src/place-introduction'
import { guideSchema } from '../src/guide-schema'

async function explore(page: Page, city = 'guam') {
  await page.goto('/')
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page.getByLabel('가볼 만한 곳의 도시').selectOption(city)
}

async function openPlace(page: Page, name: string) {
  await page
    .locator('.place-card')
    .filter({ has: page.locator('strong', { hasText: name }) })
    .locator('.place-card-copy')
    .click()
  return page.getByRole('dialog')
}

test('장소별 블로그는 읽은 원문 근거와 일치하고 다른 도시·동명 장소에 전파하지 않음', () => {
  expect(posts.length).toBeGreaterThanOrEqual(29)
  const seen = new Set<string>()
  for (const post of posts) {
    expect(seen.has(post.url)).toBe(false)
    seen.add(post.url)
    const proof = evidence.references.find(
      (reference) => reference.url === post.url,
    )!
    expect(proof).toBeDefined()
    expect(proof.httpStatus).toBe(200)
    expect(proof.articleTextLength).toBeGreaterThan(300)
    expect(proof.articleTextSHA256).toMatch(/^[a-f0-9]{64}$/)
    expect(proof.places).toEqual(post.places)
    expect(post.checkedAt).toBe(proof.checkedAt)
    expect(new URL(post.url).protocol).toBe('https:')
    expect(new URL(post.url).search).toBe('')
    for (const match of post.places) {
      const place = places.find((place) => place.id === match.id)!
      expect(place.name).toBe(match.name)
      expect(place.cityId).toBe(match.cityId)
      expect(blogsForPlace(place).some((entry) => entry.url === post.url)).toBe(
        true,
      )
      expect(
        blogsForPlace({
          ...place,
          name: '내가 수정한 다른 이름',
          reviewSources: [],
        }),
      ).toEqual([])
    }
  }
})

test('괌 29곳의 설명·팁을 구체화하고 원본 ID·개인 수정은 보존', () => {
  expect(stories.filter((story) => story.cityId === 'guam')).toHaveLength(29)
  for (const story of stories) {
    const place = places.find((place) => place.id === story.id)!
    expect(place.description).toBe(story.description)
    expect(place.description.length).toBeGreaterThan(100)
    expect(placeIntroduction(place).length).toBeLessThan(
      place.description.length,
    )
    expect(placeIntroduction(place)).not.toMatch(
      /체류시간|체류 시간|공식.*확인/,
    )
    const custom = {
      ...place,
      description: '직접 고친 소개',
      tip: '직접 고친 팁',
      lat: 1,
      lng: 2,
    }
    expect(withBlogNotes(custom)).toMatchObject(custom)
    expect(
      withBlogNotes({
        ...place,
        description: story.previousDescription,
        tip: story.previousTip,
      }),
    ).toMatchObject({ description: story.description, tip: story.tip })
  }
})

test('괌 가이드의 목록은 체류시간 대신 장소별 한 문장 소개를 표시', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page
    .getByRole('button', { name: '괌 여행지 자세히 보기', exact: true })
    .click()
  const list = page.getByLabel('가이드 가볼 만한 곳')
  await expect(list).not.toContainText(/체류시간|체류 시간|일정에 맞게 조절/)
  for (const name of [
    '투몬 비치',
    '메스클라 도스 투몬',
    '에그앤띵스 괌',
    '호텔 닛코 괌',
    '버디스 빌리어즈 앤 브루',
  ]) {
    const place = places.find((place) => place.name === name)!
    await expect(
      list.getByRole('button', { name: new RegExp(name) }).first(),
    ).toContainText(placeIntroduction(place))
  }
  await page.screenshot({
    path: '/tmp/jido-place-details/guam-guide.png',
    fullPage: true,
  })
})

test('상세에서 반복 안내와 추천 체류시간을 없애고 실제 메뉴·블로그·지도 동작 제공', async ({
  page,
}) => {
  await explore(page)
  await page.getByRole('button', { name: '맛집', exact: true }).click()
  const dialog = await openPlace(page, '메스클라 도스 투몬')
  await expect(dialog.locator('.city-intro')).toContainText('새우버거')
  await expect(dialog.locator('.city-intro')).toContainText('대기')
  await expect(dialog).not.toContainText(
    /정확한 지도 위치 확인|추천 체류|공식.*확인/,
  )
  const post = dialog.getByRole('link', { name: /도스버거.*내돈내산 후기/ })
  await expect(post).toHaveAttribute(
    'href',
    'https://blog.naver.com/dadablog00/224425286682',
  )
  await expect(post).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(
    dialog.getByRole('link', { name: '지도에서 위치 보기' }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: '내 일정에 추가', exact: true }),
  ).toBeVisible()
})

test('후기가 없는 장소에도 정확한 도시·장소 검색을 제공하고 허위 원문은 표시하지 않음', async ({
  page,
}) => {
  const place = places.find(
    (place) => place.cityId === 'guam' && !blogsForPlace(place).length,
  )!
  await explore(page)
  await page.getByRole('button', { name: place.category, exact: true }).click()
  const dialog = await openPlace(page, place.name)
  await expect(dialog).not.toContainText('정확한 지도 위치 확인')
  await expect(
    dialog.getByRole('link', { name: '지도에서 이름으로 찾기' }),
  ).toBeVisible()
  const section = dialog.getByRole('region', { name: '장소 블로그 후기' })
  await expect(section.getByRole('link')).toHaveCount(1)
  const href = await section.getByRole('link').getAttribute('href')
  expect(new URL(href!).searchParams.get('query')).toBe(
    `괌 ${place.name} 방문 후기`,
  )
})

test('320px 큰 글자에서도 소개·블로그를 자르지 않고 오프라인에서 읽으며 외부 요청하지 않음', async ({
  page,
  context,
}) => {
  const external: string[] = []
  page.on('request', (request) => {
    if (/blog\.naver|\.tistory|search\.naver/.test(request.url()))
      external.push(request.url())
  })
  await page.setViewportSize({ width: 320, height: 720 })
  await explore(page)
  await page.getByRole('button', { name: '카페', exact: true }).click()
  await context.setOffline(true)
  const dialog = await openPlace(page, '에그앤띵스 괌')
  await page.addStyleTag({
    content: '.city-intro,.place-review-sources strong{font-size:18px}',
  })
  await expect(dialog).toContainText('팬케이크')
  await expect(
    dialog.getByRole('link', { name: /에그앤띵스 후기/ }),
  ).toBeVisible()
  const size = await dialog.evaluate((element) => ({
    width: element.clientWidth,
    scroll: element.scrollWidth,
  }))
  expect(size.scroll).toBeLessThanOrEqual(size.width + 1)
  for (const link of await dialog
    .locator('.place-review-sources a:visible')
    .all()) {
    const rect = await link.boundingBox()
    expect(rect!.height).toBeGreaterThanOrEqual(44)
  }
  expect(external).toEqual([])
  await page.screenshot({
    path: '/tmp/jido-place-details/guam-detail-320.png',
    fullPage: true,
  })
})

test('옛 괌 가이드 캐시에서도 새 설명과 블로그가 보이며 개인 사진·텍스트를 덮어쓰지 않음', async ({
  page,
}) => {
  const city = cities.find((city) => city.id === 'guam')!
  const original = stories.find((story) => story.id === 'guam-tumon-beach')!
  const beach = places.find((place) => place.id === original.id)!
  const custom = places.find((place) => place.id === 'guam-fish-eye')!
  const guide = guideSchema.parse({
    id: city.id,
    scope: 'city',
    city,
    places: [
      {
        ...beach,
        description: original.previousDescription,
        tip: original.previousTip,
      },
      {
        ...custom,
        description: '내가 직접 적은 물고기 관찰 소개',
        image: '/images/city-guam.jpg',
      },
    ],
    sections: [],
    sources: [],
    status: 'published',
    requestId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    publishedAt: '2026-01-01T00:00:00Z',
  })
  await page.addInitScript(
    (guide) =>
      localStorage.setItem(
        'jdo-guide-catalog-v1',
        JSON.stringify({
          available: [guide],
          retained: [guide],
          usingServer: true,
        }),
      ),
    guide,
  )
  await explore(page)
  let dialog = await openPlace(page, '투몬 비치')
  await expect(dialog.locator('.city-intro')).toHaveText(original.description)
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '체험', exact: true }).click()
  dialog = await openPlace(page, '피시아이 마린파크')
  await expect(dialog.locator('.city-intro')).toHaveText(
    '내가 직접 적은 물고기 관찰 소개',
  )
  await expect(
    dialog.getByRole('region', { name: '장소 블로그 후기' }),
  ).toContainText('피시아이')
})
