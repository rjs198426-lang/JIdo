import { test, expect, type Page } from '@playwright/test'
import {
  googleReviewMetrics,
  type GoogleReviewEvidence,
  type GoogleReview,
} from '../src/google-review-evidence'
import { createPlaceDiscovery } from '../src/place-mention-ranking'

const today = new Date('2026-11-05T10:00:00Z')
const place = { id: 'a', cityId: 'guam', name: '장소 A' }
const other = { id: 'b', cityId: 'guam', name: '장소 B' }
const review = (
  id: string,
  publishedAt?: string,
  updatedAt?: string,
): GoogleReview => ({ id, publishedAt, updatedAt, author: '검사용 작성자' })
const evidence = (
  reviews: GoogleReview[],
  extra: Partial<GoogleReviewEvidence> = {},
): GoogleReviewEvidence => ({
  place,
  googlePlaceId: 'google-a',
  checkedAt: today.toISOString(),
  ordering: 'relevance',
  reviews,
  totalRatingCount: 1000000,
  mapsUrl: 'https://www.google.com/maps/place/a',
  attributions: [],
  ...extra,
})

test('Google 1년 경계일·윤년과 미래·잘못된 날짜를 구분하며 확인일은 언급이 아님', () => {
  const result = googleReviewMetrics(
    evidence([
      review('boundary', '2025-11-05'),
      review('old', '2025-11-04'),
      review('future', '2026-11-06'),
      review('invalid', '2026-02-30'),
      review('undated'),
      review('relative', '1개월 전'),
    ]),
    place,
    today,
  )
  expect(result.recent.map((r) => r.id)).toEqual(['boundary'])
  expect(result.count).toBe(1)
  expect(
    googleReviewMetrics(
      evidence([review('leap', '2023-02-28')], {
        checkedAt: '2024-02-29T00:00:00Z',
      }),
      place,
      new Date('2024-02-29'),
    ).count,
  ).toBe(1)
})

test('명시적인 유효 수정일만 갱신 근거이며 미래 수정일·이른 수정일·수정일만 있는 자료는 제외', () => {
  const result = googleReviewMetrics(
    evidence([
      review('updated', '2023-01-01', '2026-10-01'),
      review('future-edit', '2023-01-01', '2027-01-01'),
      review('earlier-edit', '2023-01-01', '2022-01-01'),
      review('edit-only', undefined, '2026-01-01'),
    ]),
    place,
    today,
  )
  expect(result.recent.map((r) => r.id)).toEqual(['updated'])
})

test('Google 전체 평가 수·동일 리뷰 중복으로 최근 1년 언급 수를 부풀리지 않음', () => {
  const result = googleReviewMetrics(
    evidence([review('one', '2026-01-01'), review('one', '2026-01-01')]),
    place,
    today,
  )
  expect(result.count).toBe(1)
  expect(googleReviewMetrics(evidence([]), place, today)).toMatchObject({
    count: 0,
    state: 'unverified',
  })
})

test('관련도순 5개·빈 응답·실패는 무활동 증거가 아니며 완전한 최신순 확인만 만료로 판단', () => {
  const old = [review('old', '2024-01-01')]
  expect(googleReviewMetrics(evidence(old), place, today).state).toBe(
    'unverified',
  )
  expect(
    googleReviewMetrics(evidence(old, { ordering: 'newest' }), place, today)
      .state,
  ).toBe('inactive')
  expect(
    googleReviewMetrics(evidence([], { ordering: 'newest' }), place, today)
      .state,
  ).toBe('unverified')
  expect(
    googleReviewMetrics(
      evidence([...old, review('missing')], { ordering: 'newest' }),
      place,
      today,
    ).state,
  ).toBe('unverified')
  expect(googleReviewMetrics(undefined, place, today).state).toBe('unverified')
})

test('다른 장소·미래 확인일·10분을 넘긴 Google 내용은 새 정렬에 재사용하지 않음', () => {
  const fresh = evidence([review('one', '2026-01-01')])
  for (const item of [
    { ...fresh, place: other },
    { ...fresh, checkedAt: '2026-11-05T10:01:00Z' },
    { ...fresh, checkedAt: '2026-11-05T09:49:00Z' },
  ])
    expect(googleReviewMetrics(item, place, today)).toMatchObject({
      count: 0,
      state: 'unverified',
    })
})

test('블로그 3년과 Google 1년은 독립이며 유효 근거를 합산하고 오래된 Google만으로 블로그를 지우지 않음', () => {
  const blogs = [
    {
      url: 'https://example.com/blog',
      publishedAt: '2024-01-01',
      places: [place],
    },
  ]
  const old = evidence([review('old', '2024-01-01')], { ordering: 'newest' })
  const keep = createPlaceDiscovery(blogs, [], () => old)
  expect(keep.metrics(place, today)).toMatchObject({
    mentionCount: 1,
    googleReviewCount: 0,
    blogMentionCount: 1,
    state: 'recent',
  })
  expect(keep.list([place], today)).toEqual([place])
  const combined = createPlaceDiscovery(blogs, [], (p) =>
    p.id === 'b'
      ? {
          ...evidence([
            review('one', '2026-10-01'),
            review('two', '2026-10-02'),
          ]),
          place: other,
        }
      : undefined,
  )
  expect(combined.list([place, other], today)).toEqual([other, place])
  const revive = createPlaceDiscovery(
    [{ ...blogs[0], publishedAt: '2020-01-01' }],
    [],
    () => evidence([review('new', '2026-10-01')]),
  )
  expect(revive.list([place], today)).toEqual([place])
  expect(revive.list([place], new Date('2026-11-05T10:11:00Z'))).toEqual([])
})

async function fixture(
  page: Page,
  mode: 'recent' | 'empty' | 'delayed' = 'recent',
) {
  await page.clock.install({ time: today })
  await page.route('https://**', (route) => route.abort())
  await page.addInitScript((mode) => {
    const w = window as any
    w.reviewCalls = []
    w.google = {
      maps: {
        importLibrary: async () => ({
          Place: class {
            id: string
            reviews: any[] | undefined
            userRatingCount = 1000000
            googleMapsURI = 'https://www.google.com/maps/place/nikkofixture'
            attributions = [{ provider: 'Google Maps' }]
            constructor(options: any) {
              this.id = options.id
            }
            static async searchByText(request: any) {
              w.reviewCalls.push({ kind: 'search', request })
              return {
                places: [
                  {
                    id: 'fixture-nikko-google',
                    displayName: '닛코호텔 괌',
                    formattedAddress: '245 Gun Beach Road',
                    location: { lat: () => 13.52, lng: () => 144.8 },
                    types: ['hotel'],
                    googleMapsURI:
                      'https://www.google.com/maps/place/nikkofixture',
                    attributions: [],
                  },
                ],
              }
            }
            async fetchFields(request: any) {
              w.reviewCalls.push({ kind: 'details', request })
              if (mode === 'delayed')
                await new Promise((resolve) => {
                  w.finishReview = resolve
                })
              this.reviews =
                mode === 'empty'
                  ? undefined
                  : [
                      {
                        publishTime: new Date('2026-10-01T00:00:00Z'),
                        authorAttribution: {
                          displayName: '최근 리뷰 작성자',
                          uri: 'https://www.google.com/maps/contrib/new',
                        },
                        googleMapsURI:
                          'https://www.google.com/maps/reviews/new',
                        rating: 4,
                      },
                      {
                        publishTime: new Date('2026-10-02T00:00:00Z'),
                        authorAttribution: {
                          displayName: '두 번째 작성자',
                          uri: 'https://www.google.com/maps/contrib/new2',
                        },
                        googleMapsURI:
                          'https://www.google.com/maps/reviews/new2',
                        rating: 5,
                      },
                      {
                        publishTime: new Date('2024-01-01T00:00:00Z'),
                        authorAttribution: {
                          displayName: '오래된 작성자',
                          uri: 'https://www.google.com/maps/contrib/old',
                        },
                        googleMapsURI:
                          'https://www.google.com/maps/reviews/old',
                        rating: 5,
                      },
                    ]
              return { place: this }
            }
          },
        }),
      },
    }
    localStorage.setItem('jdo-content-auto-v1', 'false')
  }, mode)
  await page.goto('/')
  await page
    .locator('.bottom-nav')
    .getByRole('button', { name: '여행지', exact: true })
    .click()
  await page.getByRole('tab', { name: /가볼 만한 곳/ }).click()
  await page
    .locator('select')
    .filter({ has: page.locator('option[value="guam"]') })
    .selectOption('guam')
  await page
    .getByRole('button', { name: '호텔 닛코 괌 자세히 보기', exact: true })
    .click()
  return page.getByRole('region', { name: 'Google 지도 리뷰', exact: true })
}

test('명시적인 Google 조회와 장소 선택 후에만 최근 리뷰를 집계하며 출처·작성자와 전체 기간을 구별', async ({
  page,
}) => {
  const panel = await fixture(page)
  const originalNames = await page.locator('.place-card-copy > strong').allTextContents()
  expect(await page.evaluate(() => (window as any).reviewCalls)).toHaveLength(0)
  await panel
    .getByRole('button', { name: 'Google 리뷰 확인', exact: true })
    .click()
  await panel
    .getByRole('group', { name: '리뷰를 확인할 Google 장소 선택' })
    .getByRole('button')
    .click()
  await expect(panel).toContainText('최근 1년 확인된 리뷰 2개')
  await expect(panel).not.toContainText('오래된 작성자')
  await expect(panel).toContainText('전체 기간 평가 1,000,000개')
  await expect(
    panel.getByRole('link', { name: '최근 리뷰 작성자', exact: true }),
  ).toHaveAttribute('href', 'https://www.google.com/maps/contrib/new')
  const serialized = await page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
    }),
  )
  expect(serialized).not.toMatch(
    /최근 리뷰 작성자|fixture-nikko-google|1000000/,
  )
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect.poll(async () => (await page.locator('.place-card-copy > strong').allTextContents()).indexOf('호텔 닛코 괌')).toBeLessThan(originalNames.indexOf('호텔 닛코 괌'))
})

test('Google가 전체 평가 수만 주고 리뷰를 생략해도 무활동·삭제로 판단하지 않음', async ({
  page,
}) => {
  const panel = await fixture(page, 'empty')
  await panel
    .getByRole('button', { name: 'Google 리뷰 확인', exact: true })
    .click()
  await panel
    .getByRole('group', { name: '리뷰를 확인할 Google 장소 선택' })
    .getByRole('button')
    .click()
  await expect(panel).toContainText('최근 리뷰 확인 필요')
  await expect(panel).toContainText('최신 리뷰가 없는지는 Google 지도에서 확인')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect(
    page.locator('.place-card-copy').filter({ hasText: '호텔 닛코 괌' }),
  ).toBeVisible()
})

test('창을 닫고 도착한 Google 응답이 다른 화면의 순위에 붙지 않음', async ({
  page,
}) => {
  const panel = await fixture(page, 'delayed')
  await panel
    .getByRole('button', { name: 'Google 리뷰 확인', exact: true })
    .click()
  await panel
    .getByRole('group', { name: '리뷰를 확인할 Google 장소 선택' })
    .getByRole('button')
    .click()
  await expect
    .poll(() => page.evaluate(() => !!(window as any).finishReview))
    .toBe(true)
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  const before = await page
    .locator('.place-card-copy > strong')
    .allTextContents()
  await page.evaluate(() => (window as any).finishReview())
  await expect(page.locator('.place-card-copy > strong')).toHaveText(before)
})

test('백그라운드 전환과 10분 경과 시 Google 메모리를 지우고 순위는 원래 공개 근거로 돌아감', async ({
  page,
}) => {
  const panel = await fixture(page)
  await panel
    .getByRole('button', { name: 'Google 리뷰 확인', exact: true })
    .click()
  await panel
    .getByRole('group', { name: '리뷰를 확인할 Google 장소 선택' })
    .getByRole('button')
    .click()
  await expect(panel).toContainText('최근 1년 확인된 리뷰 2개')
  await page.clock.fastForward(10 * 60_000 + 1)
  await expect(
    panel.getByRole('button', { name: 'Google 리뷰 확인', exact: true }),
  ).toBeVisible()
  await panel
    .getByRole('button', { name: 'Google 리뷰 확인', exact: true })
    .click()
  await expect(
    panel.getByRole('group', { name: '리뷰를 확인할 Google 장소 선택' }),
  ).toBeVisible()
  await page.evaluate(() => dispatchEvent(new Event('pagehide')))
  await expect(
    panel.getByRole('group', { name: '리뷰를 확인할 Google 장소 선택' }),
  ).toHaveCount(0)
})
