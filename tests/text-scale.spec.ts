import { test, expect } from '@playwright/test'
import baseline from './fixtures/typography-054.json' with { type: 'json' }
import { typographyFlow } from './typography-flow'

for (const width of [320, 393, 768, 1440] as const) {
  test(`${width}px 글자는 0.55보다 10% 크고 메뉴·버튼 줄바꿈과 가로 넘침 없음`, async ({
    page,
  }) => {
    test.setTimeout(60_000)
    const actual = await typographyFlow(page, width)
    const original = baseline[width]
    expect(Object.keys(actual)).toEqual(Object.keys(original))
    for (const [sample, size] of Object.entries(original)) {
      expect(actual[sample], sample).toBeCloseTo(size * 0.8 * 1.1, 2)
    }
  })
}
