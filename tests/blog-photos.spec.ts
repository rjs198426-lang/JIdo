import { readFileSync } from 'node:fs'
import { optimizedImage } from './optimized-image'
import { createHash } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import photos from '../src/blog-photos.json' with { type: 'json' }
import review from '../research/photos/blog-review-1.43.json' with { type: 'json' }
import { cities, places } from '../src/data'
import { isRecentBlog } from '../src/blog-recency'
import { blogsForCity } from '../src/guide-blogs'
import { guideBlogs } from '../src/guide-blogs'
import { blogsForPlace } from '../src/place-blogs'
import { guideSchema } from '../src/guide-schema'

async function city(page: Page, name: string) {
  await page.getByRole('button', { name: 'J★Do 홈', exact: true }).click()
  await page.getByLabel('도시 또는 나라 검색').fill(name)
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await page.getByRole('button', { name: `${name} 여행지 자세히 보기` }).click()
  return page.getByRole('dialog')
}

test('최근 3년 날짜 경계·미래·날짜 미상·윤년을 검사하며 확인일로 대체하지 않음', () => {
  const asOf = new Date('2026-10-18T10:00:00Z')
  for (const publishedAt of ['2023-10-18', '2024-02-29', '2026-10-18'])
    expect(isRecentBlog({ publishedAt }, asOf)).toBe(true)
  for (const publishedAt of [
    undefined,
    '',
    '2023-10-17',
    '2026-10-19',
    '2024-02-30',
    '2024-13-01',
  ])
    expect(isRecentBlog({ publishedAt }, asOf)).toBe(false)
  expect(
    isRecentBlog(
      { publishedAt: '2021-02-28' },
      new Date('2024-02-29T00:00:00Z'),
    ),
  ).toBe(true)
  expect(
    isRecentBlog(
      { publishedAt: '2021-02-27' },
      new Date('2024-02-29T00:00:00Z'),
    ),
  ).toBe(false)
  for (const destination of cities) {
    expect(blogsForCity(destination.id).length).toBeGreaterThan(0)
    for (const post of blogsForCity(destination.id))
      expect(isRecentBlog(post, asOf)).toBe(true)
  }
  for (const place of places)
    for (const post of blogsForPlace(place))
      expect(isRecentBlog(post, asOf)).toBe(true)
  expect(
    guideBlogs.some((post) =>
      [
        'https://dasado.tistory.com/1019',
        'https://liih.tistory.com/186',
      ].includes(post.url),
    ),
  ).toBe(false)
})

test('21개 지역의 재사용 사진·원본 근거·정확한 장소 연결과 기존 대표 사진 보존', () => {
  expect(photos).toHaveLength(21)
  expect(new Set(photos.map((photo) => photo.cityId))).toEqual(
    new Set(cities.map((city) => city.id)),
  )
  expect(photos.filter((photo) => photo.placeIds.length)).toHaveLength(11)
  for (const photo of photos) {
    const evidence = review.photos.find((entry) => entry.id === photo.id)!
    const bytes = readFileSync(`public${photo.image}`)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      evidence.downloadedSHA256,
    )
    expect(bytes.length).toBe(evidence.bytes)
    expect(evidence.licenseEvidence).toContain('rel="license"')
    expect(evidence.licenseEvidence).toContain(photo.photoCredit.licenseUrl)
    expect(photo.photoCredit.license).toMatch(/^CC BY-NC(?:-ND|-SA)? 4\.0$/)
    expect(isRecentBlog(photo)).toBe(true)
    for (const id of photo.placeIds)
      expect(places.find((place) => place.id === id)?.cityId).toBe(photo.cityId)
  }
  expect(
    places.find((place) => place.id === 'osaka-umeda-sky')!.image,
  ).not.toContain('blog-')
})

for (const destination of cities) {
  test(`${destination.name}: 320px·오프라인에서 해당 지역 사진·설명·게시일·원문 표시`, async ({
    page,
    context,
  }) => {
    // Android serves bundled assets locally even without a network connection.
    await context.route('**/images/**', (route) => {
      const file = new URL(route.request().url()).pathname
      return route.fulfill({
        body: readFileSync(`dist${file}`),
        contentType: file.endsWith('.webp')
          ? 'image/webp'
          : file.endsWith('.svg')
            ? 'image/svg+xml'
            : file.endsWith('.png')
              ? 'image/png'
              : 'image/jpeg',
      })
    })
    await page.setViewportSize({ width: 320, height: 740 })
    await page.goto('/')
    await context.setOffline(true)
    const dialog = await city(page, destination.name)
    const gallery = dialog.getByRole('region', { name: '사진으로 보는 여행지' })
    const photo = photos.find((photo) => photo.cityId === destination.id)!
    await expect(gallery.locator('img')).toHaveCount(1)
    const img = gallery.getByRole('img', { name: photo.caption, exact: true })
    await img.scrollIntoViewIfNeeded()
    await expect
      .poll(() => img.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(480)
    await expect(gallery).toContainText(photo.description)
    await expect(gallery.getByRole('link')).toHaveAttribute(
      'href',
      photo.photoCredit.sourceUrl,
    )
    await expect(gallery.getByRole('link')).toContainText(photo.publishedAt)
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true)
    expect((await img.boundingBox())!.height).toBeLessThanOrEqual(400)
    if (['guam', 'osaka', 'hiroshima'].includes(destination.id))
      await page.screenshot({
        path: `/workspace/jido-research-143/${destination.id}-320.png`,
      })
  })
}

test('개인 대표 사진·기존 출처와 장소 소개의 새 사진을 함께 유지', async ({
  page,
}) => {
  await page.goto('/')
  let dialog = await city(page, '도쿄')
  await dialog
    .getByRole('tablist', { name: '도시 가이드', exact: true })
    .getByRole('tab', { name: '관광', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: '도쿄 타워 자세히 보기', exact: true })
    .click()
  dialog = page.getByRole('dialog')
  const photo = photos.find((photo) => photo.cityId === 'tokyo')!
  await expect(dialog.locator('.blog-photos img')).toHaveAttribute(
    'src',
    optimizedImage(photo.image),
  )
  await dialog.getByLabel('도쿄 타워 개인 사진 파일').setInputFiles({
    name: '내 사진.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4jIAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await expect(dialog.locator('.place-detail-photo img')).toHaveAttribute(
    'src',
    /^blob:/,
  )
  await expect(dialog.locator('.blog-photos img')).toHaveAttribute(
    'src',
    optimizedImage(photo.image),
  )
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '앱 정보', exact: true }).click()
  await page.getByRole('button', { name: '사진 출처', exact: true }).click()
  await expect(page.locator('.photo-credit-entry')).toHaveCount(95)
  for (const photo of photos) {
    const entry = page.locator('.photo-credit-entry').filter({
      has: page.locator(`img[src="${optimizedImage(photo.image)}"]`),
    })
    await expect(entry).toContainText(photo.photoCredit.author)
    await expect(
      entry.getByRole('link', { name: '사진 원본', exact: true }),
    ).toHaveAttribute('href', photo.photoCredit.sourceUrl)
    await expect(
      entry.getByRole('link', { name: photo.photoCredit.license, exact: true }),
    ).toHaveAttribute('href', photo.photoCredit.licenseUrl)
  }
})

test('넓은 화면에서도 사진 전체 구도와 안내 버튼 영역을 유지', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  await page.goto('/')
  const dialog = await city(page, '히로시마')
  const image = dialog.locator('.blog-photos img')
  await image.scrollIntoViewIfNeeded()
  await expect(image).toHaveCSS('object-fit', 'contain')
  expect((await image.boundingBox())!.height).toBeLessThanOrEqual(400)
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true)
  await page.screenshot({
    path: '/workspace/jido-research-143/hiroshima-wide.png',
  })
})

test('이전 가이드의 기간 밖 사진만 교체하고 개인 소개·일정은 보존', async ({
  page,
}) => {
  const destination = cities.find((city) => city.id === 'osaka')!
  const place = places.find(
    (place) => place.id === 'osaka-review-b0660bf9b758',
  )!
  const guide = guideSchema.parse({
    id: destination.id,
    scope: 'city',
    city: destination,
    places: [
      {
        ...place,
        description: '내가 따로 적은 설명',
        image: '/images/blog-osaka-tsutenkaku.jpg',
        photoCredit: {
          file: '/images/blog-osaka-tsutenkaku.jpg',
          author: 'eundol-meow',
          license: 'CC BY 4.0',
          licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          sourceUrl: 'https://eundol-meow.tistory.com/',
          verifiedAt: '2026-10-18',
        },
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
  await page.goto('/')
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  let dialog = await city(page, '오사카')
  await dialog
    .getByRole('tablist', { name: '도시 가이드', exact: true })
    .getByRole('tab', { name: '관광', exact: true })
    .click()
  await dialog
    .getByRole('button', { name: '쓰텐카쿠 자세히 보기', exact: true })
    .click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('내가 따로 적은 설명')
  await expect(
    dialog.locator('img[src="/images/blog-osaka-tsutenkaku.jpg"]'),
  ).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})
