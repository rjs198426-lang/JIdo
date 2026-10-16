import { openTrips, openWorkspace } from './navigation'
import { test, expect, type Page } from '@playwright/test'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4jIAAAAASUVORK5CYII=',
  'base64',
)
async function seed(page: Page, extra: Record<string, unknown> = {}) {
  await page.goto('/')
  await page.evaluate(
    (extra) =>
      localStorage.setItem(
        'jido-travel-v1',
        JSON.stringify({
          version: 1,
          savedCities: [],
          savedPlaces: [],
          trips: [
            {
              id: 'files-trip',
              title: '자료 여행',
              cityId: 'custom-paris',
              startDate: '2026-11-01',
              endDate: '2026-11-02',
              travelers: 1,
              days: [
                [
                  {
                    id: 'tower',
                    placeId: 'custom-tower',
                    time: '10:00',
                    note: '',
                    custom: {
                      name: '에펠탑',
                      kind: '관광',
                      address: 'Paris',
                      link: '',
                      destinationId: 'paris',
                    },
                  },
                ],
                [],
              ],
              destinations: [{ id: 'paris', name: '파리', country: '프랑스' }],
              dayDestinationIds: ['paris', 'paris'],
              ...extra,
            },
          ],
        }),
      ),
    extra,
  )
  await page.reload()
  await openTrips(page)
}
async function tab(page: Page, name: string) {
  await openWorkspace(page, name)
}
async function fileCount(page: Page) {
  return await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].attachments
        ?.length || 0,
  )
}

test('자료 파일의 실제 내용은 별도 저장소에 보관하고 재실행·오프라인 미리보기', async ({
  page,
  context,
}) => {
  await seed(page)
  await tab(page, '자료')
  const body = '예약 안내 · 기차표와 숙소 정보를 보관합니다.\n본문 원본입니다.'
  await page.getByLabel('첨부할 자료 파일').setInputFiles([
    {
      name: '여행 안내.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(body),
    },
    { name: '영수증.png', mimeType: 'image/png', buffer: png },
  ])
  await expect(
    page.getByRole('button', { name: '여행 안내.txt 자료 열기' }),
  ).toBeVisible()
  await expect.poll(() => fileCount(page)).toBe(2)
  const raw = await page.evaluate(() => localStorage.getItem('jido-travel-v1')!)
  expect(raw).not.toContain('본문 원본입니다.')
  expect(raw).not.toContain('iVBORw0KGgo')
  await page.reload()
  await openTrips(page)
  await tab(page, '자료')
  await context.setOffline(true)
  await page.getByRole('button', { name: '여행 안내.txt 자료 열기' }).click()
  await expect(page.getByRole('dialog')).toContainText(body)
  await page.getByRole('button', { name: '자료 미리보기 닫기' }).click()
  await page.getByRole('button', { name: '영수증.png 자료 열기' }).click()
  const image = page
    .getByRole('dialog')
    .getByRole('img', { name: '영수증.png', exact: true })
  await expect
    .poll(() =>
      image.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBeTruthy()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('예약 확인서와 영수증을 각각 예약·경비 기록에 첨부하고 자료 목록에서 함께 찾기', async ({
  page,
}) => {
  await seed(page, {
    reservations: [
      {
        id: 'hotel',
        title: '파리 숙소',
        kind: '숙소',
        date: '2026-11-01',
        time: '15:00',
        reference: 'PARIS-42',
        address: 'Paris',
        link: '',
        note: '',
      },
    ],
    expenses: [
      {
        id: 'meal',
        title: '저녁 식사',
        amount: 20,
        currency: 'EUR',
        date: '2026-11-01',
        category: '식비',
        payer: '',
      },
    ],
  })
  await tab(page, '예약')
  await page
    .getByRole('region', { name: '예약 첨부 자료' })
    .getByLabel('첨부할 자료 파일')
    .setInputFiles({
      name: '예약 확인.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('호텔 예약 확인서'),
    })
  await expect(
    page.getByRole('button', { name: '예약 확인.txt 자료 열기' }),
  ).toBeVisible()
  await tab(page, '가계부')
  await page
    .getByRole('region', { name: '경비 첨부 자료' })
    .getByLabel('첨부할 자료 파일')
    .setInputFiles({
      name: '식사 영수증.png',
      mimeType: 'image/png',
      buffer: png,
    })
  await expect(
    page.getByRole('button', { name: '식사 영수증.png 자료 열기' }),
  ).toBeVisible()
  await tab(page, '자료')
  await expect(page.locator('.attachment-list > article')).toHaveCount(2)
  await page.getByLabel('첨부 자료 검색').fill('영수증')
  await expect(page.locator('.attachment-list > article')).toHaveCount(1)
  const files = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0].attachments,
  )
  expect(
    files.find((file: any) => file.name === '예약 확인.txt').reservationId,
  ).toBe('hotel')
  expect(
    files.find((file: any) => file.name === '식사 영수증.png').expenseId,
  ).toBe('meal')
})

test('첨부 삭제는 확인 뒤 파일과 메타데이터를 제거하고 다른 자료는 유지', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '자료')
  await page.getByLabel('첨부할 자료 파일').setInputFiles([
    {
      name: '삭제할 자료.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('remove me'),
    },
    {
      name: '남길 자료.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('keep me'),
    },
  ])
  await expect(
    page.getByRole('button', { name: '삭제할 자료.txt 자료 열기' }),
  ).toBeVisible()
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('jido-travel-v1')!).trips[0]
        .attachments[0].id,
  )
  await page.getByRole('button', { name: '삭제할 자료.txt 첨부 삭제' }).click()
  await page
    .locator('.attachment-remove')
    .getByRole('button', { name: '취소', exact: true })
    .click()
  await expect.poll(() => fileCount(page)).toBe(2)
  await page.getByRole('button', { name: '삭제할 자료.txt 첨부 삭제' }).click()
  await page
    .locator('.attachment-remove')
    .getByRole('button', { name: '첨부 삭제', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '삭제할 자료.txt 자료 열기' }),
  ).toHaveCount(0)
  const exists = await page.evaluate(
    (id) =>
      new Promise<boolean>((resolve, reject) => {
        const req = indexedDB.open('jido-attachments-v1', 1)
        req.onsuccess = () => {
          const db = req.result,
            read = db
              .transaction('files', 'readonly')
              .objectStore('files')
              .get(id)
          read.onsuccess = () => {
            resolve(!!read.result)
            db.close()
          }
          read.onerror = () => reject(read.error)
        }
        req.onerror = () => reject(req.error)
      }),
    id,
  )
  expect(exists).toBeFalsy()
  await page.reload()
  await openTrips(page)
  await tab(page, '자료')
  await page.getByRole('button', { name: '남길 자료.txt 자료 열기' }).click()
  await expect(page.getByRole('dialog')).toContainText('keep me')
})

test('부분 실패·빈 파일·지원하지 않는 자료·25MB 초과는 기존 자료를 지우지 않음', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '자료')
  await page.getByLabel('첨부할 자료 파일').setInputFiles([
    { name: '정상.txt', mimeType: 'text/plain', buffer: Buffer.from('stored') },
    {
      name: '웹페이지.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<script>alert(1)</script>'),
    },
    { name: '빈파일.txt', mimeType: 'text/plain', buffer: Buffer.from('') },
  ])
  await expect(
    page.getByRole('button', { name: '정상.txt 자료 열기' }),
  ).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('지원하지 않는 파일 형식')
  await expect(page.getByRole('alert')).toContainText('빈 파일')
  await page.getByLabel('첨부할 자료 파일').setInputFiles({
    name: '큰 자료.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
  })
  await expect(page.getByRole('alert')).toContainText('25MB 이하')
  await expect.poll(() => fileCount(page)).toBe(1)
})

test('자료는 텍스트로 안전하게 표시하고 일정 JSON 백업에는 바이너리나 잘못된 파일 참조를 넣지 않음', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '자료')
  await page.getByLabel('첨부할 자료 파일').setInputFiles({
    name: '가이드.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('<script>window.fileExecuted=true</script>'),
  })
  await page.getByRole('button', { name: '가이드.txt 자료 열기' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    '<script>window.fileExecuted=true</script>',
  )
  expect(
    await page.evaluate(() => (window as any).fileExecuted),
  ).toBeUndefined()
  await page.getByRole('button', { name: '자료 미리보기 닫기' }).click()
  await page.getByRole('button', { name: '여행 백업·공유' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    '일정 JSON 백업에는 포함되지 않습니다',
  )
  await page.getByRole('button', { name: '전체 여행 백업 복사' }).click()
  const backup = JSON.parse(
    await page.getByLabel('내보낸 여행 내용').inputValue(),
  )
  expect(backup.trips[0].attachments).toBeUndefined()
  await page.getByRole('button', { name: '닫기', exact: true }).click()
  await expect.poll(() => fileCount(page)).toBe(1)
})

test('같은 자료를 다른 여행도 참조하면 현재 여행에서만 연결 해제', async ({
  page,
}) => {
  await seed(page)
  await tab(page, '자료')
  await page.getByLabel('첨부할 자료 파일').setInputFiles({
    name: '공통 안내.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('shared document'),
  })
  await expect(
    page.getByRole('button', { name: '공통 안내.txt 자료 열기' }),
  ).toBeVisible()
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('jido-travel-v1')!)
    store.trips.push({
      ...store.trips[0],
      id: 'second-trip',
      title: '두 번째 여행',
    })
    localStorage.setItem('jido-travel-v1', JSON.stringify(store))
  })
  await page.reload()
  await openTrips(page)
  await tab(page, '자료')
  await page.getByRole('button', { name: '공통 안내.txt 첨부 삭제' }).click()
  await page
    .locator('.attachment-remove')
    .getByRole('button', { name: '첨부 삭제', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: '공통 안내.txt 자료 열기' }),
  ).toHaveCount(0)
  await page.getByLabel('나의 여행').selectOption('second-trip')
  await tab(page, '자료')
  await page.getByRole('button', { name: '공통 안내.txt 자료 열기' }).click()
  await expect(page.getByRole('dialog')).toContainText('shared document')
})

test('Android 브리지 모형: 앱 파일 선택·PDF 열기와 비동기 첨부 중 일정 수정 보존', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as any
    w.androidFileCalls = []
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'Attachments',
          methods: [
            'pickFiles',
            'openFile',
            'getUri',
            'readText',
            'deleteFile',
          ].map((name) => ({ name, rtype: 'promise' })),
        },
      ],
      nativePromise: (plugin: string, method: string, options: any) => {
        w.androidFileCalls.push({ plugin, method, options })
        if (method === 'pickFiles')
          return new Promise((resolve) => {
            w.finishFilePick = () =>
              resolve({
                files: [
                  {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: '항공권.pdf',
                    mimeType: 'application/pdf',
                    size: 300,
                    createdAt: '2026-10-14T00:00:00.000Z',
                    storage: 'android',
                  },
                ],
                errors: [],
              })
          })
        return Promise.resolve({})
      },
    }
  })
  await seed(page)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  await tab(page, '자료')
  await page.getByRole('button', { name: '파일 첨부', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('저장하고')
  await tab(page, '일정')
  await page.getByLabel('에펠탑 방문 시간').fill('12:30')
  await page.evaluate(() => (window as any).finishFilePick())
  await expect.poll(() => fileCount(page)).toBe(1)
  await expect(page.getByLabel('에펠탑 방문 시간')).toHaveValue('12:30')
  await tab(page, '자료')
  await page.getByRole('button', { name: '항공권.pdf 자료 열기' }).click()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).androidFileCalls.filter(
            (call: any) => call.method === 'openFile',
          ).length,
      ),
    )
    .toBe(1)
  expect(
    await page.evaluate(
      () =>
        (window as any).androidFileCalls.find(
          (call: any) => call.method === 'openFile',
        ).options.id,
    ),
  ).toBe('11111111-1111-4111-8111-111111111111')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('320px 자료 목록·검색·미리보기에서 가로 넘침 없음', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 840 })
  await seed(page)
  await tab(page, '자료')
  const name = '긴이름'.repeat(20) + '.txt'
  await page.getByLabel('첨부할 자료 파일').setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from('기기 안에 보관하는 자료\n' + '긴본문'.repeat(100)),
  })
  await expect(
    page.getByRole('button', { name: `${name} 자료 열기` }),
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
  await page.getByRole('button', { name: `${name} 자료 열기` }).click()
  await expect(page.getByRole('dialog')).toContainText(
    '기기 안에 보관하는 자료',
  )
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
  await page.screenshot({
    path: `artifacts/attachments-${test.info().project.name}.png`,
    fullPage: true,
  })
})
