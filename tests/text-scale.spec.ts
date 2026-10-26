import { test, expect } from '@playwright/test'
import { typographyFlow } from './typography-flow'

for (const width of [320, 393, 768, 1440]) {
  test(`${width}px 90% UI에서 작은 글자 하한과 가로 메뉴·화면 넘침 없음`, async ({ page }) => {
    test.setTimeout(120000)
    const actual = await typographyFlow(page, width)
    expect(Object.keys(actual).length).toBeGreaterThan(35)
    for (const [sample, value] of Object.entries(actual))
      expect(value, sample).toBeGreaterThanOrEqual(11.24)
    expect(await page.locator('#root').evaluate(el => Number(getComputedStyle(el).zoom))).toBe(.9)
  })
}
