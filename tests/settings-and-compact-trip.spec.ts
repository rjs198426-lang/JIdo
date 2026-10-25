import { test, expect } from '@playwright/test'
import { openTrips } from './navigation'

test('날짜·요일만 표시하고 한 줄 메모와 커진 관리 버튼을 좁은 화면에서 사용', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('jido-travel-v1', JSON.stringify({
    version: 1, savedCities: [], savedPlaces: [], trips: [{
      id: 'compact', title: '크리스마스 괌', cityId: 'guam',
      startDate: '2026-12-22', endDate: '2026-12-23', travelers: 2,
      days: [[{ id: 'memo', placeId: 'custom-hotel', time: '', note: '이른 도착이면 짐부터 보관하고 프런트에서 체크인 시간을 확인해 주세요.\n예약자 이름과 요청한 방 종류도 확인합니다.', custom: { name: '우리 숙소', kind: '숙소', destinationId: 'guam', address: '', link: '' } }], []],
    }],
  })))
  await page.reload()
  await openTrips(page)
  const before = await page.evaluate(() => localStorage.getItem('jido-travel-v1'))
  for (const width of [320, 393, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.timeline-find')).toHaveCount(0)
    const tabs = page.getByRole('tablist', { name: '여행 날짜', exact: true })
    await expect(tabs.getByRole('tab').first()).toHaveText('12월 22일 (화)')
    await expect(tabs.locator('small,strong')).toHaveCount(0)
    const summary = page.locator('.schedule-note-preview p')
    await expect(summary).toContainText('예약자 이름')
    expect(await summary.evaluate(el => {
      const style = getComputedStyle(el)
      return style.whiteSpace === 'nowrap' && style.textOverflow === 'ellipsis' && el.getBoundingClientRect().height <= parseFloat(style.lineHeight) + 1
    })).toBe(true)
    const button = await page.getByRole('button', { name: '여행 정보 수정', exact: true }).boundingBox()
    expect(button!.width).toBeGreaterThanOrEqual(39)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(await page.evaluate(() => localStorage.getItem('jido-travel-v1'))).toBe(before)
})

test('설정 탭에서 앱 버전·알림·위치·출처를 열고 돌아오기', async ({ page }) => {
  await page.goto('/')
  for (const width of [320, 393, 1440]) {
    await page.setViewportSize({ width, height: 850 })
    await page.locator('.bottom-nav:visible,.desktop-nav:visible').getByRole('button', { name: '설정', exact: true }).click()
    await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible()
    await expect(page.locator('.settings-version')).toContainText('0.66')
    await page.getByRole('button', { name: '여행 알림 설정', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveAccessibleName('여행 알림 설정')
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
    await page.getByRole('button', { name: '현재 위치·내 주변', exact: true }).click()
    await expect(page.getByRole('button', { name: '현재 위치 켜기', exact: true })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
    await page.getByRole('button', { name: '사진 출처', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveAccessibleName('사진 출처')
    await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click()
    await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
