import { test, expect } from '@playwright/test'
import { places, categoryOptions } from '../src/data'
import { placeIntroduction } from '../src/place-introduction'
import { withBlogNotes } from '../src/blog-place-notes'
import { reviewSourceSchema } from '../src/review-source'
import notes from '../src/blog-place-notes.json' with { type: 'json' }
import research from '../public/blog-place-research.json' with { type: 'json' }

async function openKyoto(page: import('@playwright/test').Page) {
  await page
    .getByRole('button', { name: '교토 여행지 자세히 보기', exact: true })
    .first()
    .click()
}

test('가이드 분류는 전체가 먼저이며 분류별 목록·개수와 장소 연결을 오프라인으로 유지', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await context.setOffline(true)
  await openKyoto(page)
  const section = page.getByRole('region', { name: '가이드 가볼 만한 곳' })
  const group = page.getByRole('group', { name: '가볼 만한 곳 분류' })
  const kyoto = places.filter((p) => p.cityId === 'kyoto')
  expect(
    await group
      .getByRole('button')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label'))),
  ).toEqual(categoryOptions)
  await expect(
    group.getByRole('button', { name: '전체', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(section.locator('.detail-place-list > div')).toHaveCount(
    kyoto.length,
  )
  for (const category of categoryOptions.slice(1)) {
    const count = kyoto.filter((p) => p.category === category).length
    const button = group.getByRole('button', { name: category, exact: true })
    if (!count) {
      await expect(button).toBeDisabled()
      continue
    }
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(section.locator('.detail-place-list > div')).toHaveCount(count)
    expect(
      await section
        .locator('.detail-place-list > div > button > span')
        .allTextContents(),
    ).toEqual(
      kyoto
        .filter((p) => p.category === category)
        .map((p) => `${p.category} · ${placeIntroduction(p)}`),
    )
  }
  await group.getByRole('button', { name: '관광', exact: true }).click()
  await section
    .getByRole('button', { name: '기요미즈데라 자세히 보기', exact: true })
    .click()
  await expect(
    page
      .locator('.place-review-sources')
      .getByRole('link', { name: /교토 자유여행, 청수사/ }),
  ).toHaveAttribute('href', 'https://gnrlfhdns.tistory.com/201')
  await expect(page.locator('.place-review-sources')).toContainText(
    '방문 후기 · 링크 확인 2026-10-16',
  )
  await expect(page.locator('.place-review-sources')).toContainText(
    '네이버 블로그',
  )
  await expect(page.getByText(notes[0].tip, { exact: true })).toBeVisible()
})

test('320px에서 분류 버튼 44px·가로 넘침 방지·다시 열 때 전체 복원', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')
  await openKyoto(page)
  const group = page.getByRole('group', { name: '가볼 만한 곳 분류' })
  await group.scrollIntoViewIfNeeded()
  const sizes = await group
    .getByRole('button')
    .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().height))
  expect(sizes.every((h) => h >= 44)).toBe(true)
  expect(
    await group
      .getByRole('button')
      .first()
      .evaluate((n) => parseFloat(getComputedStyle(n).fontSize)),
  ).toBeGreaterThanOrEqual(14)
  await group.getByRole('button', { name: '카페', exact: true }).click()
  expect(
    await page
      .getByRole('dialog')
      .evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
  ).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: '/tmp/jido-guide-categories-320.png' })
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await openKyoto(page)
  await expect(
    group.getByRole('button', { name: '전체', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByText('상세 안내·기존 자료', { exact: true }),
  ).toHaveCount(0)
})

test('블로그 보강은 실제 본문 확인 기록과 연결되며 사용자가 고친 내용·좌표·사진·원본을 보존', () => {
  const garden = places.find((p) => p.id === 'kyoto-review-3ad4fafd578f')!
  const corrected = withBlogNotes({
    ...garden,
    reviewSources: [
      reviewSourceSchema.parse(notes[0].reviewSources[1]),
      ...(garden.reviewSources || []),
    ],
  })
  expect(
    corrected.reviewSources?.some((source) => source.url.includes('alrg0411')),
  ).toBe(false)
  expect(
    corrected.reviewSources?.some((source) => source.kind === 'traveler-guide'),
  ).toBe(true)
  expect(research.references).toHaveLength(5)
  expect(
    research.references.filter(
      (s) => new URL(s.url).hostname === 'blog.naver.com',
    ),
  ).toHaveLength(2)
  expect(
    research.references.filter((s) =>
      new URL(s.url).hostname.endsWith('.tistory.com'),
    ),
  ).toHaveLength(3)
  for (const note of notes) {
    const place = places.find((p) => p.id === note.id)!
    expect(place.description).toBe(note.description)
    for (const source of note.reviewSources) {
      const record = research.references.find((r) => r.url === source.url)!
      expect(record.httpStatus).toBe(200)
      expect(record.articleTextLength).toBeGreaterThan(1000)
      expect(record.articleTextSHA256).toMatch(/^[a-f0-9]{64}$/)
      expect(record.placeIds).toContain(place.id)
    }
    const custom = {
      ...place,
      description: '내 설명',
      tip: '개인 예약 메모',
      lat: 35,
      lng: 135,
      image: 'https://example.com/my-photo.jpg',
    }
    const original = JSON.stringify(custom)
    const upgraded = withBlogNotes(custom)
    expect(upgraded).toMatchObject({
      description: custom.description,
      tip: custom.tip,
      lat: 35,
      lng: 135,
      image: custom.image,
    })
    expect(JSON.stringify(custom)).toBe(original)
    expect(new Set(upgraded.reviewSources?.map((s) => s.url)).size).toBe(
      upgraded.reviewSources?.length,
    )
    expect(withBlogNotes({ ...custom, name: '내가 등록한 별도 장소' })).toEqual(
      { ...custom, name: '내가 등록한 별도 장소' },
    )
  }
})
