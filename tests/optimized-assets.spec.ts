import { readFileSync, readdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
const audit = JSON.parse(readFileSync('dist/image-optimizations.json', 'utf8'))

test('내장 WebP 사진 99장이 외부 요청 없이 실제 디코딩됨', async ({ page }) => {
  await page.route('https://**', (route) => route.abort())
  await page.goto('/')
  const results = await page.evaluate(
    async (paths: string[]) =>
      Promise.all(
        paths.map(
          (src) =>
            new Promise<{ src: string; width: number; height: number }>(
              (resolve, reject) => {
                const image = new Image()
                image.onload = () =>
                  resolve({
                    src,
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                  })
                image.onerror = () => reject(new Error(src))
                image.src = src
              },
            ),
        ),
      ),
    audit.images.map((photo: { file: string }) => photo.file),
  )
  expect(results).toHaveLength(99)
  for (const image of results) {
    expect(Math.min(image.width, image.height), image.src).toBeGreaterThan(0)
    expect(Math.max(image.width, image.height), image.src).toBeLessThanOrEqual(
      1280,
    )
  }
  expect(
    readdirSync('dist/fonts').filter((file) =>
      /\.(woff2?|ttf|otf)$/.test(file),
    ),
  ).toEqual(['PretendardVariable.woff2'])
})
