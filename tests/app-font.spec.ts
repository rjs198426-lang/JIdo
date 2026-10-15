import { test, expect } from '@playwright/test'

test('앱에 내장한 하이커체가 한글을 실제로 그리고 입력칸·버튼·오프라인 화면에 적용됨', async ({
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
  const { nodeId } = await session.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.home-heading h1',
  })
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', {
    nodeId,
  })
  expect(
    fonts.some(
      (font) =>
        font.isCustomFont &&
        /HiKR/i.test(font.familyName) &&
        font.glyphCount > 0,
    ),
  ).toBe(true)
  await context.setOffline(true)
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  for (const selector of ['h2', 'input', 'select', 'button']) {
    const families = await dialog
      .locator(selector)
      .evaluateAll((nodes) =>
        nodes.map((node) => getComputedStyle(node).fontFamily),
      )
    expect(families.length).toBeGreaterThan(0)
    for (const family of families)
      expect(family.split(',')[0].replaceAll(/["']/g, '').trim()).toBe('HiKR')
  }
  expect(remoteFontRequests).toEqual([])
  await context.setOffline(false)
})
