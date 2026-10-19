import { openDisclosure, openCreateOptions } from './navigation'
import { test, expect, type Page } from '@playwright/test'
import { homeJourney, journeyPhase } from '../src/home-journey'
import { tripSchema, type Trip } from '../src/travel-model'
import { cities, places } from '../src/data'
import { dateAt } from '../src/store'

const now = new Date('2026-10-18T03:00:00Z')
function makeTrip(id: string, startDate: string, cityId = 'bangkok'): Trip {
  const city = cities.find((city) => city.id === cityId)!
  return tripSchema.parse({
    id,
    title: id === 'next' ? '방콕과 발리, 다음 자유여행' : `${id} 여행`,
    cityId,
    startDate,
    endDate: dateAt(startDate, 1),
    travelers: 2,
    destinations: [
      {
        id: cityId,
        name: city.name,
        country: city.country,
        guideCityId: cityId,
      },
    ],
    dayDestinationIds: [cityId, cityId],
    days: [[], []],
    checklist: [],
    reservations: [],
    expenses: [],
  })
}
const near = makeTrip('next', '2026-11-10')
near.destinations!.push({
  id: 'bali',
  name: '발리',
  country: '인도네시아',
  guideCityId: 'bali',
})
near.dayDestinationIds![1] = 'bali'
near.days[1] = [
  { id: 'ubud-stop', placeId: 'ubud', time: '10:00', note: '쌀 테라스 메모' },
]
near.checklist = [
  { id: 'passport', title: '여권', done: true },
  { id: 'adapter', title: '어댑터', done: false },
]
near.expenses = [
  {
    id: 'deposit',
    title: '예약금',
    amount: 5000,
    currency: 'KRW',
    date: '2026-11-10',
    category: '숙박',
    payer: '',
  },
]
const past = makeTrip('past', '2026-09-01', 'tokyo')
const far = makeTrip('far', '2026-12-10', 'osaka')

async function seed(
  page: Page,
  trips: Trip[],
  activeId = 'past',
  savedDay = 1,
) {
  await page.clock.install({ time: now })
  for (const trip of trips)
    expect(tripSchema.safeParse(trip).success, trip.id).toBe(true)
  await page.goto('/')
  await page.evaluate(
    ({ trips, activeId, savedDay }) => {
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({ version: 1, savedCities: [], savedPlaces: [], trips }),
      )
      localStorage.setItem('jdo-active-trip-v1', activeId)
      for (const trip of trips)
        localStorage.setItem(
          `jido-view-${trip.id}`,
          JSON.stringify({ day: savedDay, workspace: 'schedule' }),
        )
    },
    { trips, activeId, savedDay },
  )
  await page.reload()
  await openDisclosure(page, '.home-discover')
}
async function nav(page: Page, name: string) {
  await page
    .locator('.desktop-nav:visible, .bottom-nav:visible')
    .getByRole('button', { name, exact: true })
    .click()
  if (name === '홈') await openDisclosure(page, '.home-discover')
}

test('진행 중인 여행 → 가장 가까운 예정 여행 → 과거 기록 순으로 선택하고 입력 순서와 기록을 보존', () => {
  const input = [far, near, past]
  const before = structuredClone(input)
  expect(homeJourney(input, 'past', now)?.trip.id).toBe('next')
  expect(homeJourney([...input].reverse(), 'far', now)?.trip.id).toBe('next')
  const current = makeTrip('current', '2026-10-18', 'guam')
  expect(homeJourney([...input, current], 'past', now)?.trip.id).toBe('current')
  expect(homeJourney([...input, current], 'past', now)?.phase).toBe('ongoing')
  expect(homeJourney([past], 'past', now)?.personalized).toBe(false)
  expect(homeJourney([], '', now)).toBeUndefined()
  expect(input).toEqual(before)
})

test('현지 자정과 날짜 변경선을 반영하고 같은 출발일에서는 기존 선택을 존중', () => {
  const guam = makeTrip('guam', '2026-10-19', 'guam')
  const bangkok = makeTrip('bangkok', '2026-10-19', 'bangkok')
  const instant = new Date('2026-10-18T15:30:00Z')
  expect(journeyPhase(guam, instant).phase).toBe('ongoing')
  expect(journeyPhase(bangkok, instant).phase).toBe('upcoming')
  expect(homeJourney([guam, bangkok], 'bangkok', now)?.trip.id).toBe('bangkok')
})

test('기억한 날짜의 도시·사진·새 추천을 사용하고 일정에 넣은 장소와 직접 복사한 장소는 추천에서 제외', async ({
  page,
  context,
}) => {
  const added = places.find(
    (p) => p.cityId === 'bali' && p.category === '맛집',
  )!
  const trip = structuredClone(near)
  trip.days[1].push({
    id: 'copied',
    placeId: 'custom-copy',
    time: '12:00',
    note: '내 점심',
    custom: {
      name: added.name,
      kind: added.category,
      address: added.address,
      link: '',
      destinationId: 'bali',
      catalogPlaceId: added.id,
    },
  })
  await seed(page, [far, trip, past])
  await context.setOffline(true)
  await expect(
    page.getByRole('heading', { name: '다음 여행 준비', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.home-journey-card')).toContainText(near.title)
  await expect(page.locator('.home-journey-photo')).toHaveAttribute(
    'alt',
    '발리 여행 풍경',
  )
  await expect(page.locator('.home-journey-photo')).toHaveAttribute(
    'src',
    cities.find((c) => c.id === 'bali')!.image,
  )
  const cards = page
    .getByRole('region', { name: '이번 여행의 도시' })
    .locator('.city-card')
  await expect(cards).toHaveCount(2)
  await expect(
    page.getByRole('region', { name: '일본 도시 둘러보기' }),
  ).toHaveCount(0)
  await expect(page.getByLabel('도시 또는 나라 검색')).toHaveCount(0)
  const recommendations = page.getByRole('region', {
    name: '발리에서 더 가볼 곳',
  })
  const expected = places.filter(
    (p) => p.cityId === 'bali' && !['ubud', added.id].includes(p.id),
  )
  await expect(recommendations.locator('.place-card')).toHaveCount(4)
  for (const title of await recommendations
    .locator('.place-card-copy > strong')
    .allTextContents())
    expect(expected.some((p) => p.name === title)).toBe(true)
  await expect(recommendations).not.toContainText('뜨갈랄랑 라이스 테라스')
  await expect(page.locator('.home-next-day')).toContainText('DAY 2 · 발리')
  await expect(page.locator('.home-status-grid')).toContainText('5,000')
  await expect(page.locator('.home-status-grid')).toContainText('1개 남음')
})

test('홈 바로가기와 더 보기는 같은 여행·날짜·도시로 연결하고 단순 홈 조회는 선택 기록을 바꾸지 않음', async ({
  page,
}) => {
  await seed(page, [far, near, past])
  const before = await page.evaluate(() => ({
    travel: localStorage.getItem('jido-travel-v1'),
    active: localStorage.getItem('jdo-active-trip-v1'),
    view: localStorage.getItem('jido-view-next'),
  }))
  await nav(page, '여행지')
  await nav(page, '홈')
  expect(
    await page.evaluate(() => ({
      travel: localStorage.getItem('jido-travel-v1'),
      active: localStorage.getItem('jdo-active-trip-v1'),
      view: localStorage.getItem('jido-view-next'),
    })),
  ).toEqual(before)
  await page
    .getByRole('region', { name: '발리에서 더 가볼 곳' })
    .getByRole('button', { name: '더 보기', exact: true })
    .click()
  await expect(page.getByLabel('가볼 만한 곳의 도시')).toHaveValue('bali')
  await expect(page.getByLabel('여행지와 장소 검색')).toHaveValue('')
  await expect(page.getByLabel('여행지와 장소 검색')).not.toBeFocused()
  await nav(page, '홈')
  await page
    .locator('.home-next-day')
    .getByRole('button', { name: '일정 보기', exact: true })
    .click()
  await expect(page.locator('.trip-banner')).toContainText(near.title)
  await expect(page.getByRole('tab', { name: /DAY 2/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(
    await page.evaluate(() => localStorage.getItem('jdo-active-trip-v1')),
  ).toBe('next')
  await nav(page, '홈')
  await page
    .locator('.home-status-grid')
    .getByRole('button', { name: /예약/ })
    .click()
  await expect(
    page
      .getByRole('group', { name: '준비 관리', exact: true })
      .getByRole('button', { name: '예약', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('jido-travel-v1')!).trips.find(
          (t: Trip) => t.id === 'next',
        ).days[1][0].note,
    ),
  ).toBe('쌀 테라스 메모')
})

test('직접 정한 여행지에는 이름과 실제 일정을 표시하고 다른 도시의 사진·추천을 섞지 않음', async ({
  page,
}) => {
  const trip = tripSchema.parse({
    ...makeTrip('custom', '2026-11-05'),
    cityId: 'personal-custom',
    destinations: [{ id: 'paris', name: '파리', country: '프랑스' }],
    dayDestinationIds: ['paris', 'paris'],
    days: [
      [
        {
          id: 'museum',
          placeId: 'custom-museum',
          time: '10:00',
          note: '예약 확인',
          custom: {
            name: '내가 정한 미술관',
            kind: '관광',
            destinationId: 'paris',
            address: 'Paris',
            link: '',
          },
        },
      ],
      [],
    ],
  })
  await seed(page, [trip], trip.id, 0)
  await expect(page.locator('.home-journey-card')).toContainText('파리')
  await expect(page.locator('.home-journey-photo')).toHaveAttribute(
    'src',
    '/images/guide-placeholder.svg',
  )
  await expect(page.locator('.home-next-day')).toContainText('내가 정한 미술관')
  await expect(page.locator('.travel-home .city-card')).toHaveCount(0)
  await expect(page.locator('.travel-home .place-card')).toHaveCount(0)
  await expect(
    page.getByRole('region', { name: '이번 여행의 도시' }),
  ).toContainText('파리')
  await expect(
    page.getByRole('button', { name: '이 여행의 장소 직접 정하기' }),
  ).toBeVisible()
})

test('320px 긴 다도시 여행에서도 제목·바로가기·관련 카드가 넘치지 않고 빈 일정은 등록 동작 제공', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  const trip = {
    ...near,
    title: '친구와 함께 여러 도시를 천천히 돌아보는 아주 긴 다음 자유여행',
    days: [[], []],
  }
  await seed(page, [trip], trip.id)
  await expect(
    page.getByRole('button', { name: '이날의 첫 장소 정하기' }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  for (const button of await page.locator('.home-shortcuts > button').all())
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({
    path: '/tmp/jido-home-next-trip-320.png',
    fullPage: true,
  })
})

test('새 여행을 만들거나 출발일을 바꾸면 재실행 없이 가장 가까운 여행으로 홈이 전환', async ({
  page,
}) => {
  await seed(page, [past])
  await nav(page, '내 여행')
  await page.getByRole('button', { name: '새 여행', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByLabel('어디로 떠나세요?').selectOption('bangkok')
  await openCreateOptions(page)
  await dialog.getByLabel(/여행 이름/).fill('새로 계획한 방콕 여행')
  await dialog.getByLabel('출발일', { exact: true }).fill('2026-11-05')
  await dialog.getByLabel('마지막 날', { exact: true }).fill('2026-11-06')
  await dialog
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await nav(page, '홈')
  await expect(page.locator('.home-heading h1')).toHaveText('다음 여행 준비')
  await expect(page.locator('.home-journey-card')).toContainText(
    '새로 계획한 방콕 여행',
  )
  await expect(
    page
      .getByRole('region', { name: '이번 여행의 도시' })
      .locator('.city-card'),
  ).toHaveCount(1)
  await expect(
    page
      .getByRole('region', { name: '방콕에서 더 가볼 곳' })
      .locator('.place-card'),
  ).toHaveCount(4)
  await page.getByRole('button', { name: '여행 보기', exact: true }).click()
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  dialog = page.getByRole('dialog')
  await dialog.getByLabel('출발일', { exact: true }).fill('2026-09-20')
  await dialog.getByLabel('마지막 날', { exact: true }).fill('2026-09-21')
  await dialog
    .getByRole('button', { name: '변경사항 저장', exact: true })
    .click()
  await nav(page, '홈')
  await expect(page.locator('.home-phase')).toHaveText('여행 기록')
  await expect(
    page.getByRole('region', { name: '일본 도시 둘러보기' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '다음 여행 준비', exact: true }),
  ).toHaveCount(0)
})

test('여행 중인 일정이 있으면 다른 예정 여행보다 우선하며 오늘 도시와 장소를 표시', async ({
  page,
}) => {
  const current: Trip = {
    ...near,
    id: 'current',
    title: '지금 떠난 방콕과 발리',
    startDate: '2026-10-17',
    endDate: '2026-10-18',
  }
  await seed(page, [far, current, past], far.id, 0)
  await expect(page.locator('.home-heading h1')).toHaveText('오늘의 여행')
  await expect(page.locator('.home-journey-card')).toContainText(current.title)
  await expect(page.locator('.home-next-day')).toContainText('DAY 2 · 발리')
  await expect(page.locator('.home-journey-photo')).toHaveAttribute(
    'alt',
    '발리 여행 풍경',
  )
  await expect(
    page
      .getByRole('region', { name: '발리에서 더 가볼 곳' })
      .locator('.place-card'),
  ).toHaveCount(4)
})

test('홈 추천 장소 담기는 같은 도시의 과거 여행이 있어도 다음 여행과 기억한 날짜를 기본 선택', async ({
  page,
}) => {
  const old = makeTrip('old-bali', '2026-09-01', 'bali')
  await seed(page, [old, near], old.id, 1)
  await page
    .getByRole('region', { name: '발리에서 더 가볼 곳' })
    .locator('.place-card')
    .first()
    .getByRole('button', { name: /자세히 보기/ })
    .click()
  await page.getByRole('button', { name: '일정에 추가', exact: true }).click()
  await expect(
    page.getByRole('combobox', { name: '추가할 여행', exact: true }),
  ).toHaveValue(near.id)
  await expect(
    page.getByRole('combobox', { name: '어느 날에 갈까요?', exact: true }),
  ).toHaveValue('1')
  await page.getByRole('button', { name: '일정에 추가', exact: true }).click()
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('jido-travel-v1')!).trips,
  )
  expect(saved.find((trip: Trip) => trip.id === near.id).days[1]).toHaveLength(
    2,
  )
  expect(
    saved.find((trip: Trip) => trip.id === old.id).days.flat(),
  ).toHaveLength(0)
})

test('홈을 열어 둔 채 현지 여행 날짜가 바뀌어 복귀해도 오늘의 여행·도시로 갱신하고 기록 보존', async ({
  page,
}) => {
  await seed(page, [near, past], past.id)
  await expect(page.locator('.home-heading h1')).toHaveText('다음 여행 준비')
  const before = await page.evaluate(() =>
    localStorage.getItem('jido-travel-v1'),
  )
  await page.clock.setSystemTime(new Date('2026-11-10T17:30:00Z'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.locator('.home-heading h1')).toHaveText('오늘의 여행')
  await expect(page.locator('.home-next-day')).toContainText('DAY 2 · 발리')
  expect(
    await page.evaluate(() => localStorage.getItem('jido-travel-v1')),
  ).toBe(before)
})
