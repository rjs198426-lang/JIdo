import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import photos from '../src/blog-photos.json' with { type: 'json' }
import review from '../research/photos/blog-review-2026-10-18.json' with { type: 'json' }
import { places } from '../src/data'

async function city(page: Page, name: string) {
  await page.getByRole('button', { name: 'J★Do 홈', exact: true }).click()
  await page.getByLabel('도시 또는 나라 검색').fill(name)
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await page.getByRole('button', { name: `${name} 여행지 자세히 보기` }).click()
  return page.getByRole('dialog')
}

test('검토한 원본 바이트·CC BY 근거와 정확한 도시·장소 연결', async () => {
  expect(photos).toHaveLength(5)
  expect(new Set(photos.map((photo) => photo.cityId)).size).toBe(3)
  for (const photo of photos) {
    const evidence = review.photos.find((entry) => entry.id === photo.id)!
    const bytes = readFileSync(`public${photo.image}`)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      evidence.originalSHA256,
    )
    expect(bytes.length).toBe(evidence.bytes)
    expect(evidence.licenseEvidence).toContain('rel="license"')
    expect(evidence.licenseEvidence).toContain(photo.photoCredit.licenseUrl)
    expect(photo.photoCredit.license).toBe('CC BY 4.0')
    for (const id of photo.placeIds)
      expect(places.find((place) => place.id === id)?.cityId).toBe(photo.cityId)
  }
  expect(
    photos
      .filter((photo) => photo.cityId === 'danang')
      .every((photo) => !photo.placeIds.length),
  ).toBe(true)
  expect(
    places.find((place) => place.id === 'osaka-umeda-sky')!.image,
  ).not.toContain('blog-')
})

test('기기 내 자산만으로 지역 소개 사진을 열고 320px에서도 캡션·원문 접근', async ({
  page,
  context,
}) => {
  // Android serves bundled assets locally, even without a network connection.
  await context.route('**/images/**', (route) => {
    const file = new URL(route.request().url()).pathname
    return route.fulfill({
      body: readFileSync(`public${file}`),
      contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg',
    })
  })
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  await context.setOffline(true)
  for (const [name, id] of [
    ['오사카', 'osaka'],
    ['센다이', 'sendai'],
    ['다낭·호이안', 'danang'],
  ]) {
    const dialog = await city(page, name)
    const gallery = dialog.getByRole('region', { name: '사진으로 보는 여행지' })
    const expected = photos.filter((photo) => photo.cityId === id)
    await expect(gallery.locator('img')).toHaveCount(expected.length)
    for (const photo of expected) {
      const img = gallery.getByRole('img', { name: photo.caption, exact: true })
      await img.scrollIntoViewIfNeeded()
      await expect
        .poll(() =>
          img.evaluate((image: HTMLImageElement) => image.naturalWidth),
        )
        .toBeGreaterThan(480)
      await expect(
        gallery
          .getByRole('link')
          .filter({ hasText: photo.photoCredit.author })
          .first(),
      ).toHaveAttribute('href', photo.photoCredit.sourceUrl)
    }
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true)
    await gallery.locator('figure').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: `/tmp/jido-blog-${id}-320.png` })
    await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  }
})

test('장소 사진·개인 대표 사진과 새 출처 5개를 함께 보존', async ({ page }) => {
  await page.goto('/')
  let dialog = await city(page, '오사카')
  await dialog
    .getByRole('button', { name: '쓰텐카쿠 자세히 보기', exact: true })
    .click()
  dialog = page.getByRole('dialog')
  await expect(dialog.locator('.place-detail-photo img')).toHaveAttribute(
    'src',
    '/images/blog-osaka-tsutenkaku.jpg',
  )
  // The primary photo is not repeated immediately below its description.
  await expect(dialog.locator('.blog-photos')).toHaveCount(0)
  await dialog.getByLabel('쓰텐카쿠 개인 사진 파일').setInputFiles({
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
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  dialog = await city(page, '오사카')
  await dialog
    .getByRole('button', {
      name: '우메다 스카이 빌딩 자세히 보기',
      exact: true,
    })
    .click()
  dialog = page.getByRole('dialog')
  await expect(dialog.locator('.blog-photos img')).toHaveAttribute(
    'src',
    '/images/blog-osaka-umeda-night.jpg',
  )
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByRole('button', { name: '앱 정보', exact: true }).click()
  await page.getByRole('button', { name: '사진 출처', exact: true }).click()
  await expect(page.locator('.photo-credit-entry')).toHaveCount(79)
  for (const photo of photos) {
    const entry = page
      .locator('.photo-credit-entry')
      .filter({ has: page.locator(`img[src="${photo.image}"]`) })
    await expect(entry).toContainText(photo.photoCredit.author)
    await expect(
      entry.getByRole('link', { name: '사진 원본', exact: true }),
    ).toHaveAttribute('href', photo.photoCredit.sourceUrl)
    await expect(
      entry.getByRole('link', { name: 'CC BY 4.0', exact: true }),
    ).toHaveAttribute('href', photo.photoCredit.licenseUrl)
  }
})
