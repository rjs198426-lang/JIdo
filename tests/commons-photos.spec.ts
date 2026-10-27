import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import review from '../research/photos/review-2026-10-27.json' with { type: 'json' }
import credits from '../src/photos-069.json' with { type: 'json' }
import { places } from '../src/data'

test('새 사진 105장의 날짜·원본 근거·실제 내장 해시·출처와 장소 연결 검증', () => {
  expect(review.newPhotos).toHaveLength(105)
  expect(Object.keys(credits)).toHaveLength(105)
  for (const photo of review.newPhotos) {
    expect(
      photo.capturedAt >= '2023-10-27' && photo.capturedAt <= '2026-10-27',
    ).toBe(true)
    const place = places.find((p) => p.id === photo.placeId)!
    expect(place.cityId).toBe(photo.cityId)
    expect(place.image).toBe(photo.bundledFile)
    expect(place.photoCredit?.sourceUrl).toBe(photo.sourceUrl)
    expect(place.photoCredit?.licenseUrl).toBe(photo.licenseUrl)
    expect(place.photoCredit?.author).toBeTruthy()
    expect(photo.license).toMatch(/^CC(?: BY(?:-SA)?|0)/)
    expect(
      photo.apiMetadata.imageinfo[0].extmetadata.LicenseUrl.value.replace(
        /^http:/,
        'https:',
      ),
    ).toBe(photo.licenseUrl)
    expect(
      createHash('sha256')
        .update(readFileSync(`public${photo.bundledFile}`))
        .digest('hex'),
    ).toBe(photo.downloadedSHA256)
    expect(photo.downloadedWidth).toBeGreaterThan(0)
    expect(photo.downloadedHeight).toBeGreaterThan(0)
    if (!photo.originalSHA256)
      expect(photo.originalHashStatus).toContain('not downloaded')
  }
  expect(review.newPhotos.filter((p) => p.originalSHA256)).toHaveLength(29)
  expect(review.rateLimit.status).toBe(429)
  for (const promotion of review.existingBlogPromotions) {
    expect(places.find((p) => p.id === promotion.placeId)?.image).toBe(
      promotion.file,
    )
    expect(
      createHash('sha256')
        .update(readFileSync(`public${promotion.file}`))
        .digest('hex'),
    ).toBe(promotion.sha256)
  }
})

test('새 장소 사진 전체를 Android 로컬 자산 모형으로 오프라인 디코딩', async ({
  page,
  context,
}) => {
  const map = JSON.parse(
    readFileSync('.runtime/public-assets/image-map.json', 'utf8'),
  ) as Record<string, string>
  await context.route('**/images/**', (route) => {
    const file = new URL(route.request().url()).pathname
    return route.fulfill({
      body: readFileSync(`dist${file}`),
      contentType: file.endsWith('.svg') ? 'image/svg+xml' : 'image/webp',
    })
  })
  await page.goto('/')
  await context.setOffline(true)
  const result = await page.evaluate(
    async (sources) =>
      Promise.all(
        sources.map(
          (src) =>
            new Promise<boolean>((resolve) => {
              const image = new Image()
              image.onload = () =>
                resolve(image.naturalWidth > 0 && image.naturalHeight > 0)
              image.onerror = () => resolve(false)
              image.src = src
            }),
        ),
      ),
    review.newPhotos.map(
      (photo) => map[photo.bundledFile] || photo.bundledFile,
    ),
  )
  expect(result).toEqual(Array(105).fill(true))
})
