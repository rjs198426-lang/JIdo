import { test, expect } from '@playwright/test'

test('제목·로고·본문·입력 내용은 내장 Pretendard Variable 한 계열로 오프라인에서도 실제 표시', async ({
  page,
  context,
}) => {
  const remoteFontRequests: string[] = []
  const oldFontRequests: string[] = []
  page.on('request', (request) => {
    if (
      /\/(?:HiKR|LaundryGothic|SUIT)[^/]*\.(?:woff2?|ttf)/.test(request.url())
    )
      oldFontRequests.push(request.url())
  })
  await page.route('https://**', (route) => {
    if (/\.(woff2?|ttf|otf)(?:\?|$)/.test(route.request().url()))
      remoteFontRequests.push(route.request().url())
    return route.abort()
  })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  expect(
    await page.evaluate(() =>
      document.fonts.check(
        '800 24px "Pretendard Variable"',
        '가나다 여행 123 ABC',
      ),
    ),
  ).toBe(true)
  const roles = await page.evaluate(() => {
    const read = (selector: string) => {
      const style = getComputedStyle(document.querySelector(selector)!)
      return {
        size: parseFloat(style.fontSize),
        weight: Number(style.fontWeight),
      }
    }
    return {
      title: read('.home-heading h1'),
      card: read('.city-title strong'),
      caption: read('.city-title > span'),
    }
  })
  expect(roles.title.size).toBeGreaterThanOrEqual(17.6)
  expect(roles.title.weight).toBe(700)
  expect(roles.card.weight).toBe(650)
  expect(roles.card.size).toBeGreaterThan(roles.caption.size)
  expect(roles.caption.weight).toBe(400)
  const session = await context.newCDPSession(page)
  await session.send('DOM.enable')
  await session.send('CSS.enable')
  const { root } = await session.send('DOM.getDocument')
  for (const [selector, expected] of [
    ['.home-heading h1', /Pretendard Variable/i],
    ['.brand-mark', /Pretendard Variable/i],
    ['.city-card .city-title > span', /Pretendard Variable/i],
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
    ['h2', 'Pretendard Variable'],
    ['button', 'Pretendard Variable'],
    ['input', 'Pretendard Variable'],
    ['select', 'Pretendard Variable'],
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
  expect(oldFontRequests).toEqual([])
  await context.setOffline(false)
})

test('320px 장소 상세에서 Pretendard Variable 본문·주소·팁을 읽을 크기와 대비로 표시하고 긴 주소를 자르지 않음', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.route('https://**', (route) => route.abort())
  await page.goto('/')
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.place-detail-title')).toHaveCSS(
    'font-size',
    '17.6px',
  )
  await expect(page.locator('.place-detail-title')).toHaveCSS(
    'font-weight',
    '650',
  )
  await expect(page.locator('.city-intro')).toHaveCSS('font-weight', '400')
  await expect(page.locator('.modal-header h2')).toHaveCSS('font-size', '16px')
  for (const [selector, size] of [
    ['.city-intro', 12.8],
    ['.place-facts > p', 11.2],
    ['.place-tip p', 12],
  ] as const) {
    const style = await page
      .locator(selector)
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node)
        const color = style.color
          .match(/\d+/g)!
          .slice(0, 3)
          .map(Number)
          .map((v) => {
            const n = v / 255
            return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4
          })
        const lum = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722
        return {
          size: parseFloat(style.fontSize),
          family: style.fontFamily,
          contrast: 1.05 / (lum + 0.05),
        }
      })
    expect(style.size).toBeGreaterThanOrEqual(size)
    expect(style.family).toMatch(/^["\']?Pretendard Variable/)
    expect(style.contrast).toBeGreaterThanOrEqual(4.5)
  }
  const session = await context.newCDPSession(page)
  await session.send('DOM.enable')
  await session.send('CSS.enable')
  const { root } = await session.send('DOM.getDocument')
  const { nodeId } = await session.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.city-intro',
  })
  const { fonts } = await session.send('CSS.getPlatformFontsForNode', {
    nodeId,
  })
  expect(
    fonts.some(
      (f) =>
        f.isCustomFont &&
        /Pretendard Variable/.test(f.familyName) &&
        f.glyphCount > 0,
    ),
  ).toBe(true)
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (f) =>
          f.family.replaceAll(/["']/g, '') === 'Pretendard Variable' &&
          f.weight === '100 900' &&
          f.status === 'loaded',
      ),
    ),
  ).toBe(true)
  for (const row of await page.locator('.place-facts > p > span').all()) {
    expect(
      await row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true)
  }
  await page.locator('.map-link').scrollIntoViewIfNeeded()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: 'artifacts/pretendard-place-320.png' })
})
