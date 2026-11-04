import { test, expect } from '@playwright/test'
import { cities, places } from '../src/data'
import { guideSchema } from '../src/guide-schema'
import { openTrips } from './navigation'
import {
  createPlaceDiscovery,
  canonicalMentionUrl,
  placeDiscovery,
  type MentionEvidence,
  type SearchSample,
} from '../src/place-mention-ranking'

const today = new Date('2026-11-04T12:00:00Z')
const a = { id: 'a', cityId: 'test', name: '첫 장소' }
const b = { id: 'b', cityId: 'test', name: '다음 장소' }
const unknown = { id: 'unknown', cityId: 'test', name: '미조사 장소' }
const post = (
  place: typeof a,
  url: string,
  publishedAt?: string,
): MentionEvidence => ({ url, publishedAt, places: [place] })
const sample: SearchSample = {
  cityId: 'test',
  query: '테스트 여행 후기',
  observedAt: '2026-11-04',
  results: [
    { url: 'https://example.com/a', rank: 5 },
    { url: 'https://example.com/b', rank: 1 },
  ],
}

test('언급 수가 검색 순위보다 우선하고 동률에서는 검증된 노출 순위로 정렬', () => {
  const evidence = [
    post(a, 'https://example.com/a', '2026-10-01'),
    post(b, 'https://example.com/b', '2026-10-01'),
  ]
  const equal = createPlaceDiscovery(evidence, [sample])
  expect(equal.list([unknown, a, b], today)).toEqual([b, a, unknown])
  const more = createPlaceDiscovery(
    [...evidence, post(a, 'https://example.com/a2', '2025-01-01')],
    [sample],
  )
  const input = [unknown, b, a]
  expect(more.list(input, today)).toEqual([a, b, unknown])
  expect(input).toEqual([unknown, b, a])
  expect(more.list(input, today)[0]).toBe(a)
})

test('네이버 모바일·PostView 및 추적 링크는 한 글이며 다른 게시물은 합치지 않음', () => {
  const urls = [
    'https://blog.naver.com/writer/123',
    'https://m.blog.naver.com/writer/123?from=search#top',
    'https://blog.naver.com/PostView.naver?blogId=writer&logNo=123',
  ]
  expect(new Set(urls.map(canonicalMentionUrl)).size).toBe(1)
  expect(canonicalMentionUrl('https://x.tistory.com/m/12?utm_source=a')).toBe(
    'https://x.tistory.com/12',
  )
  expect(
    canonicalMentionUrl('https://theqoo.net/travel/123?listStyle=viewer'),
  ).toBe('https://theqoo.net/travel/123')
  const discovery = createPlaceDiscovery(
    urls.map((url) => post(a, url, '2025-01-01')),
  )
  expect(discovery.metrics(a, today).mentionCount).toBe(1)
  expect(canonicalMentionUrl('https://example.com/post?id=1')).not.toBe(
    canonicalMentionUrl('https://example.com/post?id=2'),
  )
})

test('확인일·미래일·없는 날짜·위험 링크·날짜 충돌로 최근 언급을 만들지 않음', () => {
  const invalid = [
    post(a, 'https://example.com/check-only'),
    post(a, 'https://example.com/future', '2026-11-05'),
    post(a, 'https://example.com/invalid', '2026-02-30'),
    post(a, 'javascript:alert(1)', '2026-01-01'),
    post(a, 'https://user:secret@example.com/a', '2026-01-01'),
    post(a, 'https://example.com/conflict', '2020-01-01'),
    post(a, 'https://example.com/conflict', '2026-01-01'),
  ]
  expect(createPlaceDiscovery(invalid).metrics(a, today)).toMatchObject({
    state: 'unverified',
    mentionCount: 0,
    searchRank: null,
  })
  expect(createPlaceDiscovery(invalid).list([a], today)).toEqual([a])
})

test('3년 경계일과 윤년은 포함하고 만료 시 추천에서만 제외, 미조사와 개인 가이드 보존', () => {
  const discovery = createPlaceDiscovery([
    post(a, 'https://example.com/a', '2023-11-04'),
    post(b, 'https://example.com/b', '2023-11-03'),
  ])
  expect(discovery.metrics(a, today).state).toBe('recent')
  expect(discovery.metrics(b, today).state).toBe('expired')
  expect(discovery.list([unknown, b, a], today)).toEqual([a, unknown])
  expect(discovery.list([b, unknown], today, (p) => p.id === b.id)).toEqual([
    b,
    unknown,
  ])
  expect(discovery.list([a, unknown], new Date('2026-11-05'))).toEqual([
    unknown,
  ])
  const leap = createPlaceDiscovery([
    post(a, 'https://example.com/a', '2021-02-28'),
  ])
  expect(leap.metrics(a, new Date('2024-02-29')).state).toBe('recent')
})

test('도시·ID·이름이 일치하지 않는 다른 지점이나 개인 장소에 근거를 옮기지 않음', () => {
  const discovery = createPlaceDiscovery([
    post(a, 'https://example.com/a', '2026-01-01'),
  ])
  for (const other of [
    { ...a, id: 'other' },
    { ...a, cityId: 'other' },
    { ...a, name: '다른 지점' },
  ])
    expect(discovery.metrics(other, today).state).toBe('unverified')
})

test('노출 순위는 최근 글과 실제 검색 표본에만 연결하고 30일 후·미래·다른 도시는 무효', () => {
  const evidence = [post(a, 'https://example.com/a', '2026-10-01')]
  expect(
    createPlaceDiscovery(evidence, [sample]).metrics(a, today).searchRank,
  ).toBe(5)
  for (const s of [
    { ...sample, observedAt: '2026-10-01' },
    { ...sample, observedAt: '2026-11-05' },
    { ...sample, cityId: 'other' },
    { ...sample, results: [{ url: 'https://example.com/not-read', rank: 1 }] },
  ])
    expect(
      createPlaceDiscovery(evidence, [s]).metrics(a, today).searchRank,
    ).toBeNull()
  expect(
    createPlaceDiscovery(
      [post(a, 'https://example.com/a', '2020-01-01')],
      [sample],
    ).metrics(a, today).searchRank,
  ).toBeNull()
})

test('동률·미조사는 원래 순서를 보존하고 실제 장소 원본은 삭제하지 않음', () => {
  const input = structuredClone(places)
  const result = placeDiscovery.list(places, today)
  expect(places).toEqual(input)
  expect(result).toHaveLength(1066)
  const ranks = result.map((p) => placeDiscovery.metrics(p, today).mentionCount)
  expect(ranks).toEqual([...ranks].sort((a, b) => b - a))
  const missing = result.filter(
    (p) => placeDiscovery.metrics(p, today).state === 'unverified',
  )
  expect(missing).toEqual(
    places.filter(
      (p) => placeDiscovery.metrics(p, today).state === 'unverified',
    ),
  )
})

test('모바일 가이드·전체 검색·분류를 바꿔도 최근 언급순이며 오프라인 조회가 외부 검색하지 않음', async ({
  page,
  context,
}) => {
  await page.clock.install({ time: today })
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  await page.goto('/')
  await context.setOffline(true)
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page
    .getByRole('button', { name: '괌 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page
    .getByRole('tablist', { name: '도시 가이드', exact: true })
    .getByRole('tab', { name: '관광', exact: true })
    .click()
  const section = page.getByRole('region', { name: '가이드 가볼 만한 곳' })
  await section.getByRole('button', { name: '전체', exact: true }).click()
  const expected = placeDiscovery.list(
    places.filter((p) => p.cityId === 'guam'),
    today,
  )
  const names = section.locator('.detail-place-list > div > button > strong')
  await expect(names).toHaveText(expected.map((p) => p.name))
  await expect(section).toContainText('최근 언급순 · 미조사 장소는 뒤에')
  await section.getByRole('button', { name: '관광', exact: true }).click()
  await expect(names).toHaveText(
    expected.filter((p) => p.category === '관광').map((p) => p.name),
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼/ }).click()
  await page
    .locator('select')
    .filter({ has: page.locator('option[value="guam"]') })
    .selectOption('guam')
  await expect(page.locator('.place-card-copy > strong')).toHaveText(
    expected.slice(0, 24).map((p) => p.name),
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true)
})

test('근거가 만료된 장소는 추천에서 사라져도 기존 일정·메모·상세 참조와 직접 등록 재사용은 보존', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2030-11-05T12:00:00Z') })
  await page.addInitScript(() =>
    localStorage.setItem('jdo-content-auto-v1', 'false'),
  )
  await page.goto('/')
  await page.evaluate(() =>
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: ['guam-tumon-beach'],
        trips: [
          {
            id: 'keep-expired',
            title: '기존 괌 여행',
            cityId: 'guam',
            startDate: '2026-12-22',
            endDate: '2026-12-22',
            travelers: 1,
            days: [
              [
                {
                  id: 'old-stop',
                  placeId: 'guam-tumon-beach',
                  time: '',
                  note: '보존할 해변 메모',
                },
                {
                  id: 'my-stop',
                  placeId: 'custom-cafe',
                  time: '',
                  note: '개인 식사 메모',
                  custom: {
                    name: '내가 찾은 식당',
                    kind: '맛집',
                    address: '',
                    link: '',
                    destinationId: 'guam',
                  },
                },
              ],
            ],
          },
        ],
      }),
    ),
  )
  await page.reload()
  const homePlaces = page.getByRole('region', { name: '여행에 담아둘 장소', exact: true })
  await expect(homePlaces.locator('.place-card')).toHaveCount(4)
  await expect(homePlaces).not.toContainText('시부야 스크램블 교차로')
  await openTrips(page)
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  await expect(page.locator('.stop-card').first()).toContainText('투몬 비치')
  await expect(page.locator('.stop-card').first()).toContainText(
    '보존할 해변 메모',
  )
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  const picker = page.getByRole('dialog')
  await expect(
    picker.locator('.picker-item').filter({ hasText: '내가 찾은 식당' }),
  ).toBeVisible()
  await expect(picker.locator('.picker-place-name > strong')).not.toContainText(
    ['투몬 비치'],
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page.locator('.stop-place > button').first().click()
  await expect(page.getByRole('dialog')).toContainText('투몬 비치')
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})

test('같은 ID·이름의 개인 가이드는 공개 후기 만료로 숨기거나 공공 원문으로 덮어쓰지 않음', async ({
  page,
}) => {
  const place = places.find((p) => p.id === 'guam-tumon-beach')!
  const guide = guideSchema.parse({
    id: 'guam',
    scope: 'city',
    city: cities.find((c) => c.id === 'guam'),
    places: [{ ...place, description: '내가 작성한 해변 소개' }],
    sections: [],
    sources: [],
    status: 'published',
    requestId: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    publishedAt: '2026-01-01',
  })
  const cache = JSON.stringify({
    available: [guide],
    retained: [guide],
    usingServer: true,
  })
  await page.clock.install({ time: new Date('2030-11-05T12:00:00Z') })
  await page.addInitScript((cache) => {
    localStorage.setItem('jdo-guide-catalog-v1', cache)
    localStorage.setItem('jdo-content-auto-v1', 'false')
  }, cache)
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page
    .getByRole('button', { name: '괌 여행지 자세히 보기', exact: true })
    .first()
    .click()
  await page
    .getByRole('tablist', { name: '도시 가이드', exact: true })
    .getByRole('tab', { name: '관광', exact: true })
    .click()
  const section = page.getByRole('region', { name: '가이드 가볼 만한 곳' })
  await expect(
    section.getByRole('button', { name: '투몬 비치 자세히 보기', exact: true }),
  ).toContainText('내가 작성한 해변 소개')
  expect(
    await page.evaluate(() => localStorage.getItem('jdo-guide-catalog-v1')),
  ).toBe(cache)
})
