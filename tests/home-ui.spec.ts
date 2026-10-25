import { test, expect, type Page } from '@playwright/test'
import { places } from '../src/data'
import { tripSchema, type Trip } from '../src/travel-model'

async function navigate(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
}
const trip: Trip = {
  id: 'home-trip',
  title: '도쿄에서 교토까지 나와 동행자의 자유여행',
  cityId: 'tokyo',
  startDate: '2026-11-01',
  endDate: '2026-11-02',
  travelers: 2,
  destinations: [
    { id: 'tokyo', name: '도쿄', country: '일본', guideCityId: 'tokyo' },
    { id: 'kyoto', name: '교토', country: '일본', guideCityId: 'kyoto' },
  ],
  dayDestinationIds: ['tokyo', 'kyoto'],
  days: [
    [
      {
        id: 'tokyo-stop',
        placeId: 'tokyo-sensoji',
        time: '10:00',
        note: '출발 전 메모',
      },
    ],
    [
      {
        id: 'kyoto-stop',
        placeId: 'kiyomizu',
        time: '09:00',
        note: '둘째 날 메모',
      },
    ],
  ],
  checklist: [
    { id: 'passport', title: '여권', category: '서류', done: true },
    { id: 'adapter', title: '어댑터', category: '짐', done: false },
  ],
  expenses: [
    {
      id: 'meal',
      title: '식사',
      date: '2026-11-01',
      amount: 15000,
      currency: 'KRW',
      category: '식비',
      payer: '',
    },
  ],
}
async function seed(page: Page, value = trip) {
  expect(tripSchema.safeParse(value).success).toBe(true)
  await page.goto('/')
  await page.evaluate((value) => {
    localStorage.setItem(
      'jido-travel-v1',
      JSON.stringify({
        version: 1,
        savedCities: [],
        savedPlaces: ['kiyomizu'],
        trips: [value],
      }),
    )
    localStorage.setItem(
      `jido-view-${value.id}`,
      JSON.stringify({ day: 1, workspace: 'schedule' }),
    )
  }, value)
  await page.reload()
  await navigate(page, '홈')
}

test('첫 홈에 실물 도시·장소와 실행 가능한 바로가기를 표시', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: '나의 여행 한눈에' }),
  ).toBeVisible()
  await expect(page.locator('.travel-home .city-card')).toHaveCount(4)
  await expect(page.locator('.travel-home .place-card')).toHaveCount(4)
  await expect(page.locator('.home-status-grid')).toHaveCount(0)
  await page
    .getByRole('navigation', { name: '여행 바로가기' })
    .getByRole('button', { name: '여행 가져오기' })
    .click()
  await expect(page.getByRole('dialog')).toContainText('여행 백업·공유')
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('새로운 여행 만들기')
})

test('여행지 탭·바로가기·상단 검색 이동은 입력창을 자동 선택하지 않음', async ({
  page,
}) => {
  await page.goto('/')
  await navigate(page, '여행지')
  await expect(page.getByLabel('여행지와 장소 검색')).not.toBeFocused()
  await page.getByLabel('여행지와 장소 검색').click()
  await expect(page.getByLabel('여행지와 장소 검색')).toBeFocused()
  await navigate(page, '홈')
  await page
    .getByRole('navigation', { name: '여행 바로가기' })
    .getByRole('button', { name: '여행지 둘러보기' })
    .click()
  await expect(page.getByLabel('여행지와 장소 검색')).not.toBeFocused()
  await navigate(page, '홈')
  const headerSearch = page.getByRole('button', {
    name: '여행지 검색',
    exact: true,
  })
  if (await headerSearch.isVisible()) {
    await headerSearch.click()
    await expect(page.getByLabel('여행지와 장소 검색')).not.toBeFocused()
  }
})

test('홈 현황은 실제 기록이며 바로가기는 기억한 날짜의 해당 기능으로 이동', async ({
  page,
}) => {
  await seed(page)
  await expect(page.locator('.home-journey-card')).toContainText('도쿄 · 교토')
  await expect(page.locator('.home-next-day')).toContainText('DAY 1 · 도쿄')
  await expect(page.locator('.home-next-day')).toContainText('센소지')
  const stats = page.locator('.home-status-grid')
  await expect(stats.getByRole('button', { name: /준비물/ })).toContainText(
    '1 / 2',
  )
  await expect(stats.getByRole('button', { name: /여행 경비/ })).toContainText(
    '15,000',
  )
  await stats.getByRole('button', { name: /준비물/ }).click()
  await expect(
    page
      .getByRole('group', { name: '준비 관리', exact: true })
      .getByRole('button', { name: '준비물', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await navigate(page, '홈')
  await page
    .locator('.home-next-day')
    .getByRole('button', { name: '일정 보기' })
    .click()
  await expect(page.getByRole('tab', { name: /DAY 1/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.timeline-item')).toContainText('센소지')
  const value = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0],
  )
  expect(value.days[1][0].note).toBe('둘째 날 메모')
  expect(value.expenses).toHaveLength(1)
})

test('사진에는 이용 조건을 덧씌우지 않고 별도 출처에서 모든 원본과 라이선스에 접근', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('.photo-credit')).toHaveCount(0)
  await expect(page.locator('.travel-home')).not.toContainText('CC BY')
  await page.locator('.desktop-nav:visible,.bottom-nav:visible').getByRole('button', { name: '설정', exact: true }).click()
  await page.getByRole('button', { name: '사진 출처', exact: true }).click()
  await expect(page.locator('.photo-credit-entry')).toHaveCount(95)
  const links = await page
    .locator('.photo-credit-links a')
    .evaluateAll((links) =>
      links.map((item) => (item as HTMLAnchorElement).href),
    )
  for (const place of places.filter((place) => place.photoCredit)) {
    expect(links).toContain(place.photoCredit!.sourceUrl)
    expect(links).toContain(place.photoCredit!.licenseUrl)
  }
  await page.getByLabel('사진 출처 검색').fill('기요미즈데라')
  await expect(page.locator('.photo-credit-entry')).toHaveCount(2)
  await expect(
    page.locator('.photo-credit-entry').filter({ hasText: 'Jordy Meow' }),
  ).toHaveCount(1)
})

test('카드 행의 사진·제목 위치와 간격이 작은 화면에서도 일정', async ({
  page,
}) => {
  await page.goto('/')
  for (const width of [320, 393, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    for (const grid of ['.city-grid', '.place-grid']) {
      const rows = await page
        .locator(`.travel-home ${grid}`)
        .evaluate((grid) => {
          const cards = [...grid.children].map((card) => {
            const rect = card.getBoundingClientRect()
            const image = card
              .querySelector('.city-photo, .place-photo')!
              .getBoundingClientRect()
            const title = card
              .querySelector('.city-title, .place-card-copy > strong')!
              .getBoundingClientRect()
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              image: image.height,
              title: title.y - rect.y,
            }
          })
          return cards.reduce<(typeof cards)[]>((rows, card) => {
            const row = rows.find((row) => Math.abs(row[0].y - card.y) < 2)
            if (row) row.push(card)
            else rows.push([card])
            return rows
          }, [])
        })
      for (const row of rows)
        for (let i = 1; i < row.length; i++) {
          for (const key of ['height', 'image', 'title'] as const)
            expect(Math.abs(row[i][key] - row[0][key])).toBeLessThan(2)
          expect(
            row[i].x - row[i - 1].x - row[i - 1].width,
          ).toBeGreaterThanOrEqual(11 * 0.9)
        }
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false)
  }
})

test('긴 여행 이름과 큰 경비도 현황 정렬 및 하단 메뉴 여백을 보존', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await seed(page, {
    ...trip,
    title: '여러 도시를 함께 여행하는 나와 동행자의 아주 긴 자유여행 일정',
    expenses: Array.from({ length: 3 }, (_, index) => ({
      ...trip.expenses![0],
      id: `large-${index}`,
      amount: 999999999,
    })),
  })
  const cards = await page
    .locator('.home-status-grid > button')
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect()
        const title = node.querySelector('span')!.getBoundingClientRect()
        const amount = node.querySelector('strong')!.getBoundingClientRect()
        return {
          y: rect.y,
          height: rect.height,
          title: title.y,
          amount: amount.y,
        }
      }),
    )
  for (const card of cards) expect(card).toEqual(cards[0])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false)
  await page.addStyleTag({
    content:
      ':root {--safe-area-inset-bottom:40px;} .bottom-nav {padding-top:20px;}',
  })
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  )
  const last = page.locator('.home-discover > summary')
  await expect
    .poll(async () => {
      const tile = await last.boundingBox(),
        bar = await page.locator('.bottom-nav').boundingBox()
      return !!tile && !!bar && tile.y + tile.height < bar.y
    })
    .toBe(true)
  await page.screenshot({
    path: `artifacts/home-with-trip-${testInfo.project.name}.png`,
    fullPage: true,
  })
})

test('일본 더 보기는 남아 있던 검색어를 초기화하고 일본 도시만 표시', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByLabel('도시 또는 나라 검색').fill('발리')
  await page
    .getByRole('region', { name: '일본 도시 둘러보기' })
    .getByRole('button', { name: '더 보기' })
    .click()
  await expect(page.getByLabel('여행지와 장소 검색')).toHaveValue('')
  await expect(page.locator('.city-card')).toHaveCount(10)
  await expect(page.getByLabel('여행지와 장소 검색')).not.toBeFocused()
})

test('여행 중에는 기억한 다른 날짜 대신 오늘 일정을 열고 완료한 장소를 제외', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-11-01T12:00:00') })
  const value: Trip = {
    ...trip,
    days: [
      [
        { ...trip.days[0][0], status: 'done' },
        {
          id: 'next-stop',
          placeId: 'tokyo-shibuya',
          time: '12:00',
          note: '오후 약속',
        },
      ],
      trip.days[1],
    ],
  }
  await seed(page, value)
  await expect(page.locator('.home-phase')).toHaveText('여행 중')
  await expect(page.locator('.home-next-day')).toContainText('DAY 1 · 도쿄')
  await expect(page.locator('.home-next-day')).not.toContainText('센소지')
  await expect(page.locator('.home-next-day')).toContainText('시부야')
  await page.getByRole('button', { name: '오늘 일정', exact: true }).click()
  await expect(
    page.getByRole('tab', { name: '여행 중', exact: true }),
  ).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.field-journey')).toContainText('시부야')
})

test('홈 장소 더 보기는 가볼 만한 곳 목록으로 이동', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('region', { name: '여행에 담아둘 장소' })
    .getByRole('button', { name: '더 보기' })
    .click()
  await expect(page.getByRole('tab', { name: /가볼 만한 곳/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.place-card')).toHaveCount(24)
  await expect(
    page.getByRole('button', { name: /장소 더 보기/ }),
  ).toContainText(`24/${places.length}`)
})

test('저장한 여행이 있어도 모든 주요 화면에서 재실행하면 홈으로 시작하며 기록 보존', async ({
  page,
}) => {
  await seed(page)
  const before = await page.evaluate(() => ({
    travel: localStorage.getItem('jido-travel-v1'),
    selected: localStorage.getItem('jdo-active-trip-v1'),
    view: localStorage.getItem('jido-view-home-trip'),
  }))
  for (const name of ['내 여행', '여행지']) {
    await navigate(page, name)
    await page.reload()
    await expect(page.locator('.travel-home')).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(
      await page.evaluate(() => ({
        travel: localStorage.getItem('jido-travel-v1'),
        selected: localStorage.getItem('jdo-active-trip-v1'),
        view: localStorage.getItem('jido-view-home-trip'),
      })),
    ).toEqual(before)
  }
  await navigate(page, '내 여행')
  await expect(page.getByRole('tab', { name: /DAY 2/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.timeline-item')).toContainText('기요미즈데라')
})

test('Android 런처로 다시 열면 열린 창을 닫고 홈으로 이동, 일반 복귀는 작업 화면 유지', async ({
  page,
}) => {
  await seed(page)
  await navigate(page, '내 여행')
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.trip-banner')).toBeVisible()
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  await page.evaluate(() =>
    window.dispatchEvent(new Event('jido:launcher-open')),
  )
  await expect(page.locator('.travel-home')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
  await navigate(page, '내 여행')
  await expect(page.getByRole('tab', { name: /DAY 2/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})
