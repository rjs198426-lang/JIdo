import { test, expect } from '@playwright/test'
import { openTrips, openWorkspace } from './navigation'

test('작은 글자·상단 중복·가계부 필터를 정리해도 원본과 합계를 보존', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('jido-travel-v1', JSON.stringify({ version: 1, savedCities: [], savedPlaces: [], trips: [{
    id: 'polish', title: '교토의 느긋한 이틀', cityId: 'kyoto', startDate: '2026-11-01', endDate: '2026-11-02', travelers: 2,
    days: [[{id:'temple',placeId:'kiyomizu',time:'',note:'천천히 산책하고 사진 남기기'},{id:'market',placeId:'nishiki',time:'12:00',note:'점심 먹기'}],[]],
    expenses: [{id:'meal',title:'점심',amount:2400,currency:'JPY',date:'2026-11-01',category:'식비',payer:'나'},{id:'train',title:'열차',amount:3600,currency:'JPY',date:'2026-11-01',category:'교통',payer:'나'}],
  }]})))
  await page.reload()
  await openTrips(page)
  const original = await page.evaluate(() => localStorage.getItem('jido-travel-v1'))
  for (const width of [320,393]) {
    await page.setViewportSize({width,height:850})
    await openWorkspace(page,'일정')
    await page.evaluate(() => scrollTo(0,0))
    await expect(page.locator('.trip-quick-links')).toHaveCount(0)
    expect((await page.locator('.timeline-item').first().boundingBox())!.y).toBeLessThan(490)
    expect(await page.locator('.bottom-nav > button').first().evaluate(el => parseFloat(getComputedStyle(el).fontSize)*Number(getComputedStyle(document.getElementById('root')!).zoom))).toBeGreaterThanOrEqual(11.24)
    await openWorkspace(page,'가계부')
    await page.evaluate(() => scrollTo(0,0))
    await expect(page.getByLabel('지출 검색')).toBeHidden()
    expect((await page.locator('.expense-list > article').first().boundingBox())!.y).toBeLessThan(610)
    await page.locator('.expense-filter-toggle').click()
    await page.getByLabel('지출 검색').fill('점심')
    await expect(page.locator('.expense-list > article')).toHaveCount(1)
    await expect(page.locator('.expense-filter-summary')).toContainText('2,400')
    await page.locator('.expense-filter-toggle').click()
    await expect(page.locator('.expense-filter-summary')).toContainText('2,400')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('.expense-filter-toggle').click()
    await page.getByRole('button',{name:'필터 초기화',exact:true}).click()
    await page.locator('.expense-filter-toggle').click()
  }
  expect(await page.evaluate(() => localStorage.getItem('jido-travel-v1'))).toBe(original)
})
