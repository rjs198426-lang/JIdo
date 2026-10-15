import { test, expect } from '@playwright/test'
import { cities, places } from '../src/data'
import {
  officialGuidebooks,
  officialGuidebooksForCity,
} from '../src/official-guidebooks'
import checks from '../public/official-guidebook-checks.json' with { type: 'json' }
import { expandedGuides } from '../src/expanded-guides'
import { resortGuides } from '../src/resort-guides'
import { japanGuides } from '../src/japan-guides'

test('공식 자료는 한국어·영어 발행물만 연결하고 기존 작성 안내·코스는 제거', () => {
  expect(cities).toHaveLength(21)
  expect(places).toHaveLength(887)
  expect(officialGuidebooks).toHaveLength(14)
  const covered = new Set(officialGuidebooks.flatMap((book) => book.cityIds))
  expect(covered.size).toBe(14)
  for (const book of officialGuidebooks) {
    expect(['한국어', '영어']).toContain(book.language)
    expect(book.url).toMatch(/^https:\/\//)
    expect(book.publisher).toBeTruthy()
    expect(book.sourceUrl).toMatch(/^https:\/\//)
    for (const id of book.cityIds)
      expect(cities.some((city) => city.id === id)).toBe(true)
    const record = checks.records.find(
      (record) => record.url === book.sourceUrl,
    )
    expect(record?.status).toBe(200)
  }
  for (const guide of [...expandedGuides, ...resortGuides, ...japanGuides]) {
    expect(guide).not.toHaveProperty('sections')
  }
  for (const id of checks.unverifiedCityIds)
    expect(officialGuidebooksForCity(id)).toEqual([])
})

test('320px 오프라인 화면에서 공식 가이드북 링크·언어·기관을 읽고 기존 안내는 표시하지 않음', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  await context.setOffline(true)
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  const books = dialog.getByRole('region', { name: '공식 가이드북' })
  await expect(books).toBeVisible()
  const link = books.getByRole('link', {
    name: /간사이 공식 관광 가이드 2026–2027/,
  })
  await expect(link).toHaveAttribute(
    'href',
    'https://members.jnto.go.jp/simg/pamph/2798.pdf',
  )
  await expect(link).toContainText('영어')
  await expect(link).toContainText('간사이관광본부')
  await expect(link).toContainText('파일 접속 미확인')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(dialog.locator('.city-facts')).toHaveCount(0)
  await expect(dialog.locator('.city-detail-hero p')).toHaveCount(0)
  await expect(dialog).not.toContainText('상세 안내·기존 자료')
  await expect(dialog).not.toContainText('이 코스 일정에 담기')
  await expect(
    dialog.getByRole('tablist', { name: '실전 가이드' }),
  ).toHaveCount(0)
  const geometry = await books.evaluate((node) => ({
    fits: node.scrollWidth <= node.clientWidth + 1,
    links: [...node.querySelectorAll('a')].map((link) => ({
      width: link.getBoundingClientRect().width,
      height: link.getBoundingClientRect().height,
    })),
  }))
  expect(geometry.fits).toBe(true)
  for (const rect of geometry.links) {
    expect(rect.height).toBeGreaterThanOrEqual(48)
    expect(rect.width).toBeLessThanOrEqual(320)
  }
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.getByLabel('도시 또는 나라 검색').fill('발리')
  await page.getByRole('button', { name: '여행지 찾기', exact: true }).click()
  await page
    .getByRole('button', { name: '발리 여행지 자세히 보기', exact: true })
    .click()
  await expect(dialog).toContainText(
    '확인된 한국어·영어 공식 가이드북이 없습니다.',
  )
  await expect(dialog.locator('.official-guidebooks a')).toHaveCount(0)
  expect(
    requests.filter((url) => !url.startsWith('http://127.0.0.1:5174/')),
  ).toEqual([])
})
