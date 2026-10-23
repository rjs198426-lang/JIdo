import type { Page } from '@playwright/test'

// Use the same real screens before and after the typography-only change.
export async function typographyFlow(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: [],
        trips: [
          {
            id: 'text-size',
            title: '교토의 느긋한 이틀',
            cityId: 'kyoto',
            startDate: '2026-11-01',
            endDate: '2026-11-02',
            travelers: 2,
            days: [
              [
                {
                  id: 'temple',
                  placeId: 'kiyomizu',
                  time: '10:00',
                  note: '천천히 산책하고 사진 남기기',
                },
              ],
              [],
            ],
            expenses: [
              {
                id: 'meal',
                title: '점심',
                amount: 2400,
                currency: 'JPY',
                date: '2026-11-01',
                category: '식비',
                payer: '나',
              },
            ],
          },
        ],
      }),
    )
  })
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  const samples: Record<string, number> = {}
  const record = async (screen: string, selectors: string[]) => {
    // Check rendered text lines, including labels that allow wrapping in CSS.
    const wrapped = await page
      .locator(
        '.button, .text-button, .workspace-tabs > button, .workspace-view-switch > button, .filter, .guide-place-categories > button',
      )
      .evaluateAll((buttons) =>
        buttons.flatMap((button) => {
          // Closed native <details> descendants may still have offsetParent.
          if (!button.checkVisibility()) return []
          const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim()) continue
            const range = document.createRange()
            range.selectNodeContents(node)
            const lines = new Set(
              Array.from(range.getClientRects())
                .filter((r) => r.width > 0.5)
                .map((r) => Math.round(r.top)),
            )
            if (lines.size > 1) return [button.textContent?.trim()]
          }
          return []
        }),
      )
    if (wrapped.length)
      throw new Error(
        `${screen}: wrapped action labels at ${width}px: ${wrapped.join(', ')}`,
      )
    for (const selector of selectors) {
      samples[`${screen}:${selector}`] = await page
        .locator(selector)
        .first()
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    }
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(`${screen}: horizontal overflow at ${width}px`)
  }
  await record('home', [
    '.brand-mark',
    '.brand-star',
    '.home-heading h1',
    '.home-journey-copy h2',
    '.home-journey-copy .button',
    '.home-phase',
    '.home-journey-dates',
    '.home-status-grid > button > strong',
    '.home-status-grid > button > span',
    '.home-status-grid small',
    '.home-next-day li strong',
  ])
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '내 여행', exact: true })
    .click()
  await record('schedule', [
    '.trip-banner h2',
    '.trip-facts',
    '.workspace-tabs button',
    '.workspace-view-switch button',
    '.day-tab strong',
    '.day-tab span',
    '.timeline-day-heading h3 > span',
    '.stop-place strong',
    '.timeline-visit-time',
    '.stop-number',
    '.schedule-note-preview p',
    '.stop-expand',
  ])
  await page.getByRole('tab', { name: '가계부', exact: true }).click()
  await record('expenses', [
    '.tool-heading h3',
    '.money-overview strong',
    '.expense-day-heading h4',
    '.expense-list h4',
    '.tool-filters input',
  ])
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  await record('expense-input', [
    '.modal-header h2',
    '.modal-body .field',
    '.modal-body input',
    '.modal-body select',
    '.simple-options > summary',
    '.modal-body .button.primary',
  ])
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .first()
    .click()
  await page.getByRole('tab', { name: '여행 준비', exact: true }).click()
  await record('preparation', [
    '.dashboard-cards strong',
    '.dashboard-cards small',
    '.simple-options > summary',
  ])
  await page.getByRole('button', { name: '새 여행', exact: true }).click()
  await record('create', [
    '.modal-header h2',
    '.form-intro',
    '.create-form .field',
    '.create-form input',
    '.create-form select',
    '.create-form .button.primary',
  ])
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '닫기', exact: true })
    .first()
    .click()
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await record('explore', [
    '.page-title h1',
    '.input-search input',
    '.city-title strong',
    '.city-title > span',
    '.tags > span',
    '.filter',
  ])
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page
    .getByRole('tablist', { name: '도시 가이드', exact: true })
    .getByRole('tab', { name: '관광', exact: true })
    .click()
  await record('guide', [
    '.modal-header h2',
    '.guide-place-categories button',
    '.detail-place-list strong',
  ])
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await record('place', [
    '.place-detail-title',
    '.city-intro',
    '.place-facts > p',
    '.place-tip p',
  ])
  return samples
}
