import { test, expect } from '@playwright/test'

test('주요 제목은 하이커체, 본문·입력 내용은 내장 런드리고딕으로 오프라인에서도 실제 표시', async ({
  page,
  context,
}) => {
  const remoteFontRequests: string[] = []
  await page.route('https://**', (route) => {
    if (/\.(woff2?|ttf|otf)(?:\?|$)/.test(route.request().url()))
      remoteFontRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  expect(
    await page.evaluate(() =>
      document.fonts.check('16px HiKR', '가나다 여행 123 ABC'),
    ),
  ).toBe(true)
  const session = await context.newCDPSession(page)
  await session.send('DOM.enable')
  await session.send('CSS.enable')
  const { root } = await session.send('DOM.getDocument')
  for (const [selector, expected] of [
    ['.home-heading h1', /HiKR/i],
    ['.city-card .city-title > span', /LaundryGothic/i],
  ] as const) {
    const { nodeId } = await session.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector,
    })
    const { fonts } = await session.send('CSS.getPlatformFontsForNode', {
      nodeId,
    })
    expect(
      fonts.some(
        (font) =>
          font.isCustomFont &&
          expected.test(font.familyName) &&
          font.glyphCount > 0,
      ),
    ).toBe(true)
  }
  await context.setOffline(true)
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  for (const [selector, expectedFamily] of [
    ['h2', 'HiKR'],
    ['button', 'HiKR'],
    ['input', 'LaundryGothic'],
    ['select', 'LaundryGothic'],
  ] as const) {
    const families = await dialog
      .locator(selector)
      .evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).fontFamily),
      )
    expect(families.length).toBeGreaterThan(0)
    for (const family of families)
      expect(family.split(',')[0].replaceAll(/["']/g, '').trim()).toBe(
        expectedFamily,
      )
  }
  expect(remoteFontRequests).toEqual([])
  await context.setOffline(false)
})
