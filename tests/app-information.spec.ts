import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const android = readFileSync(
  new URL('../android/app/build.gradle', import.meta.url),
  'utf8',
)
const version = android.match(/^\s*versionName\s+"([^"]+)"/m)![1]
const build = android.match(/^\s*versionCode\s+(\d+)/m)![1]

test('앱 정보 토글에서 실제 Android 버전·저장 안내를 보고 다시 접을 수 있음', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.travel-home')).toBeVisible()
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  const toggle = page.getByRole('button', { name: '앱 정보', exact: true })
  const info = page.getByRole('region', { name: '앱 정보', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(info).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: '사진 출처', exact: true }),
  ).toHaveCount(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(info).toBeVisible()
  await expect(
    info.locator('dl > div').filter({ hasText: '앱 버전' }).locator('dd'),
  ).toHaveText(version)
  await expect(
    info.locator('dl > div').filter({ hasText: '빌드 번호' }).locator('dd'),
  ).toHaveText(build)
  await expect(info).toContainText('Android')
  await expect(info).toContainText('이 기기에 저장')
  await toggle.click()
  await expect(info).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})

test('바깥 터치·Escape·Android 뒤로는 정보만 닫고 현재 화면을 유지', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  const toggle = page.getByRole('button', { name: '앱 정보', exact: true })
  await toggle.click()
  await page.mouse.click(2, 150)
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await page.keyboard.press('Escape')
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await page.evaluate(() => window.dispatchEvent(new Event('jido:back')))
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(
    page.getByRole('heading', { name: '도시·장소 찾기' }),
  ).toBeVisible()
})

test('키보드로 사진 출처를 열고 모든 출처와 검색·복귀 초점을 유지', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  const toggle = page.getByRole('button', { name: '앱 정보', exact: true })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  const credits = page.getByRole('button', { name: '사진 출처', exact: true })
  await expect(credits).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: '앱 정보' })).toHaveCount(0)
  const dialog = page.getByRole('dialog', { name: '사진 출처' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.photo-credit-entry')).toHaveCount(95)
  await dialog.getByLabel('사진 출처 검색').fill('기요미즈데라')
  await expect(dialog.locator('.photo-credit-entry')).toHaveCount(2)
  await expect(
    dialog.getByRole('link', { name: '사진 원본', exact: true }).first(),
  ).toBeVisible()
  await dialog.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})

test('좁은 화면·큰 글자·가로 모드에서도 메뉴와 사진 출처 버튼이 화면 안에 위치', async ({
  page,
}) => {
  await page.goto('/')
  for (const size of [
    { width: 320, height: 720 },
    { width: 640, height: 320 },
  ]) {
    await page.setViewportSize(size)
    await page.getByRole('button', { name: '앱 정보', exact: true }).click()
    await page.addStyleTag({
      content:
        '.app-information-description,.app-information-storage,.app-information-panel dl{font-size:18px}',
    })
    const panel = page.getByRole('region', { name: '앱 정보' })
    const box = await panel.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(size.width)
    expect(box!.y + box!.height).toBeLessThanOrEqual(size.height)
    expect(
      await panel.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true)
    const credits = panel.getByRole('button', {
      name: '사진 출처',
      exact: true,
    })
    await credits.scrollIntoViewIfNeeded()
    expect((await credits.boundingBox())!.height).toBeGreaterThanOrEqual(44 * 0.9)
    await expect(credits).toBeInViewport()
    await page.screenshot({
      path: `/tmp/jido-app-information-${size.width}.png`,
    })
    await page.keyboard.press('Escape')
  }
})

test('화면 이동·런처 복귀 시 메뉴가 닫히고 검색 키보드를 자동으로 열지 않음', async ({
  page,
}) => {
  await page.goto('/')
  const toggle = page.getByRole('button', { name: '앱 정보', exact: true })
  await toggle.click()
  const search = page.getByRole('button', { name: '여행지 검색', exact: true })
  if (await search.isVisible()) await search.click()
  else
    await page
      .locator('.desktop-nav:visible, .bottom-nav:visible')
      .getByRole('button', { name: '여행지', exact: true })
      .click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('여행지와 장소 검색')).not.toBeFocused()
  await toggle.click()
  await page.evaluate(() =>
    window.dispatchEvent(new Event('jido:launcher-open')),
  )
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('.travel-home')).toBeVisible()
})
