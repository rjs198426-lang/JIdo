import { expect, test, type Page } from '@playwright/test'
import {
  openTrips,
  openWorkspace,
  openCreateOptions,
  openScheduleEditor,
} from './navigation'
import { RECOVERY_PREFIX, STORAGE_KEY } from '../src/store'

const trip = {
  id: 'storage-trip',
  title: '보존할 교토 여행',
  cityId: 'kyoto',
  startDate: '2026-11-05',
  endDate: '2026-11-06',
  travelers: 1,
  days: [[], []],
  checklist: [],
  expenses: [],
  reservations: [],
}
const store = (trips: unknown[] = [trip]) => ({
  version: 1,
  savedCities: [],
  savedPlaces: [],
  trips,
})
const damaged = () =>
  JSON.stringify({
    ...store([
      trip,
      {
        ...trip,
        id: 'bad',
        title: '',
        privateMarker: 'RECOVERY-PRIVATE-EXACT',
      },
      trip,
      null,
    ]),
    savedCities: ['kyoto', 'unknown', 'kyoto'],
    savedPlaces: ['kiyomizu', 'unknown'],
  })
async function boot(
  page: Page,
  raw = JSON.stringify(store()),
  options: {
    recoveryFails?: boolean
    legacy?: string
    readFails?: boolean
    indexFails?: boolean
  } = {},
) {
  await page.addInitScript(
    ({ raw, options, key, prefix }) => {
      if (!sessionStorage.getItem('seeded-storage-safety')) {
        localStorage.setItem(key, raw)
        if (options.legacy)
          localStorage.setItem(key + '-recovery', options.legacy)
        sessionStorage.setItem('seeded-storage-safety', 'yes')
      }
      localStorage.setItem('jdo-content-auto-v1', 'false')
      const w = window as any
      w.failMain = false
      w.failRecovery = !!options.recoveryFails
      w.failConfirm = false
      w.failReadMain = !!options.readFails
      w.exports = []
      w.exportMode = 'cancel'
      w.Capacitor = {
        PluginHeaders: [
          {
            name: 'TravelBackup',
            methods: [{ name: 'saveDocument', rtype: 'promise' }],
          },
        ],
        nativePromise: (plugin: string, method: string, value: unknown) => {
          w.exports.push({ plugin, method, value })
          return w.exportMode === 'fail'
            ? Promise.reject(new Error('fixture failure'))
            : Promise.resolve({ cancelled: w.exportMode === 'cancel' })
        },
      }
      const write = Storage.prototype.setItem,
        read = Storage.prototype.getItem
      const storageKey = Storage.prototype.key
      Storage.prototype.key = function (index) {
        if (options.indexFails)
          throw new DOMException(
            'simulated recovery index failure',
            'SecurityError',
          )
        return storageKey.call(this, index)
      }
      Storage.prototype.setItem = function (k, value) {
        if (
          (k === key && w.failMain) ||
          (k.startsWith(prefix) && w.failRecovery) ||
          (k.startsWith(prefix) &&
            w.failConfirm &&
            JSON.parse(String(value)).acknowledged)
        )
          throw new DOMException(
            'simulated quota failure',
            'QuotaExceededError',
          )
        return write.call(this, k, value)
      }
      Storage.prototype.getItem = function (k) {
        if (k === key && w.failReadMain)
          throw new DOMException('simulated read failure', 'SecurityError')
        return read.call(this, k)
      }
    },
    { raw, options, key: STORAGE_KEY, prefix: RECOVERY_PREFIX },
  )
  await page.goto('/')
  await expect(page.locator('.travel-home')).toBeVisible()
}
const saved = (page: Page) =>
  page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)
const records = (page: Page) =>
  page.evaluate(
    (prefix) =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .map((key) => JSON.parse(localStorage.getItem(key)!)),
    RECOVERY_PREFIX,
  )
const fail = (page: Page, yes: boolean) =>
  page.evaluate((yes) => {
    ;(window as any).failMain = yes
  }, yes)
const settings = (page: Page) =>
  page
    .locator('.bottom-nav:visible,.desktop-nav:visible')
    .getByRole('button', { name: '설정', exact: true })
    .click()
async function create(page: Page) {
  await page
    .getByRole('button', { name: '첫 여행 만들기', exact: true })
    .click()
  await page.getByLabel('어디로 떠나세요?').selectOption('kyoto')
  await page.getByLabel('출발일', { exact: true }).fill(trip.startDate)
  await page.getByLabel('마지막 날', { exact: true }).fill(trip.endDate)
}

test('여행 생성 실패는 성공 안내·전환·초안 삭제 없이 입력을 보존하고 재시도 한 번만 저장', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await boot(page, JSON.stringify(store([])))
  await create(page)
  await openCreateOptions(page)
  await page.getByLabel(/^여행 이름/).fill('입력을 보존할 여행')
  await fail(page, true)
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel(/^여행 이름/)).toHaveValue('입력을 보존할 여행')
  await expect(page.locator('.toast')).toHaveCount(0)
  expect(JSON.parse((await saved(page))!).trips).toHaveLength(0)
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith('jido-draft:create:')),
    ),
  ).toBe(true)
  await fail(page, false)
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(JSON.parse((await saved(page))!).trips).toHaveLength(1)
  await page.reload()
  await openTrips(page)
  await expect(
    page.getByRole('heading', { name: '입력을 보존할 여행', exact: true }),
  ).toContainText('입력을 보존할 여행')
  expect(errors).toEqual([])
})

test('여행 수정 실패는 원본·날짜·입력·초안을 유지하고 저장 성공 후에만 닫힘', async ({
  page,
}) => {
  await boot(page)
  const before = await saved(page)
  await openTrips(page)
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await page.getByLabel('여행 이름', { exact: true }).fill('수정 중인 이름')
  await fail(page, true)
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('여행 이름', { exact: true })).toHaveValue(
    '수정 중인 이름',
  )
  expect(await saved(page)).toBe(before)
  await expect(page.locator('.toast')).toHaveCount(0)
  await fail(page, false)
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(JSON.parse((await saved(page))!).trips[0].title).toBe('수정 중인 이름')
})

test('직접 일정 저장 실패는 장소·메모 입력을 유지하고 재시도 후 중복 없이 저장', async ({
  page,
}) => {
  await boot(page)
  await openTrips(page)
  await page.getByRole('button', { name: '장소 추가', exact: true }).click()
  await page.getByLabel('일정에 추가할 장소 검색').fill('개인 일정 보존')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /새 장소 추가/ })
    .click()
  await page.getByLabel(/^장소 또는 일정 이름/).fill('개인 일정 보존')
  await page.getByLabel('메모', { exact: true }).fill('지우면 안 되는 메모')
  await fail(page, true)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '일정에 추가', exact: true })
    .click()
  await expect(page.getByLabel(/^장소 또는 일정 이름/)).toHaveValue(
    '개인 일정 보존',
  )
  expect(JSON.parse((await saved(page))!).trips[0].days[0]).toHaveLength(0)
  await fail(page, false)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '일정에 추가', exact: true })
    .click()
  expect(JSON.parse((await saved(page))!).trips[0].days[0]).toMatchObject([
    { note: '지우면 안 되는 메모' },
  ])
})

test('준비물 저장 실패에서 입력을 비우거나 완료 상태를 바꾸지 않음', async ({
  page,
}) => {
  await boot(page)
  await openTrips(page)
  await openWorkspace(page, '준비물')
  await page.getByLabel('새 준비물').fill('예비 안경')
  await fail(page, true)
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await expect(page.getByLabel('새 준비물')).toHaveValue('예비 안경')
  expect(JSON.parse((await saved(page))!).trips[0].checklist).toHaveLength(0)
  await fail(page, false)
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await expect(page.getByLabel('새 준비물')).toHaveValue('')
  expect(JSON.parse((await saved(page))!).trips[0].checklist).toHaveLength(1)
})

test('빠른 지출 저장 실패는 금액과 창을 보존하고 성공 안내를 띄우지 않음', async ({
  page,
}) => {
  await boot(page)
  await openTrips(page)
  await openWorkspace(page, '가계부')
  await page.getByRole('button', { name: '지출 추가', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('금액', { exact: true }).fill('1234')
  await fail(page, true)
  await dialog.getByRole('button', { name: '지출 저장', exact: true }).click()
  await expect(dialog.getByLabel('금액', { exact: true })).toHaveValue('1234')
  expect(JSON.parse((await saved(page))!).trips[0].expenses).toHaveLength(0)
  await expect(page.locator('.toast')).toHaveCount(0)
  await fail(page, false)
  await dialog.getByRole('button', { name: '지출 저장', exact: true }).click()
  expect(JSON.parse((await saved(page))!).trips[0].expenses).toHaveLength(1)
})

test('삭제 저장 실패는 확인 창과 여행 원본을 유지', async ({ page }) => {
  await boot(page)
  const before = await saved(page)
  await openTrips(page)
  await page.getByRole('button', { name: '여행 삭제', exact: true }).click()
  await fail(page, true)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '여행 삭제', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await saved(page)).toBe(before)
  await expect(page.locator('.toast')).toHaveCount(0)
  await fail(page, false)
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '여행 삭제', exact: true })
    .click()
  expect(JSON.parse((await saved(page))!).trips).toHaveLength(0)
})

test('부분 손상은 제외 개수를 알리고 정확한 원본을 별도 보존하며 재실행 후에도 안내', async ({
  page,
}) => {
  const raw = damaged()
  await boot(page, raw)
  await expect(page.locator('.recovery-notice')).toBeVisible()
  await expect.poll(async () => (await records(page)).length).toBe(1)
  expect((await records(page))[0]).toMatchObject({
    raw,
    keptTrips: 1,
    excludedTrips: 3,
    excludedCities: 2,
    excludedPlaces: 1,
    acknowledged: false,
  })
  expect(JSON.parse((await saved(page))!).trips).toHaveLength(1)
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('목록에서 제외된 여행 3개')
  await expect(dialog).not.toContainText('RECOVERY-PRIVATE-EXACT')
  await page.reload()
  await expect(page.locator('.recovery-notice')).toBeVisible()
  expect(await records(page)).toHaveLength(1)
})

test('복구 확인은 재실행 뒤에도 유지되며 설정에서 원본 접근을 계속 제공', async ({
  page,
}) => {
  await boot(page, damaged())
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  await page.getByRole('button', { name: '확인했어요', exact: true }).click()
  await expect(page.locator('.recovery-notice')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.recovery-notice')).toHaveCount(0)
  await settings(page)
  await page
    .getByRole('button', { name: '기록 복구 안내', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    '확인 완료 · 원본 보관 중',
  )
  expect(await records(page)).toHaveLength(1)
})

test('손상이 반복되어도 이전 원본을 덮어쓰지 않고 각각 보존', async ({
  page,
}) => {
  const first = damaged()
  await boot(page, first)
  await expect.poll(async () => (await records(page)).length).toBe(1)
  const second = JSON.stringify(
    store([
      trip,
      { ...trip, id: 'second-bad', title: '', marker: 'SECOND-RAW' },
    ]),
  )
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw: second,
  })
  await page.reload()
  await expect.poll(async () => (await records(page)).length).toBe(2)
  expect(new Set((await records(page)).map((r) => r.raw))).toEqual(
    new Set([first, second]),
  )
})

test('깨진 JSON도 원문을 보존하고 읽을 수 없는 형식으로 안내', async ({
  page,
}) => {
  const raw = '{BROKEN-EXACT-BYTES\n'
  await boot(page, raw)
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    '전체 기록 형식을 읽지 못했어요',
  )
  expect((await records(page))[0].raw).toBe(raw)
  expect((await records(page))[0].excludedTrips).toBeNull()
})

test('복구 사본 저장 실패 시 손상 원본을 덮어쓰지 않고 변경도 차단', async ({
  page,
}) => {
  const raw = damaged()
  await boot(page, raw, { recoveryFails: true })
  await expect(page.locator('.storage-warning')).toBeVisible()
  expect(await saved(page)).toBe(raw)
  expect(await records(page)).toHaveLength(0)
  await openTrips(page)
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await page.getByLabel('여행 이름', { exact: true }).fill('보호 실패 중 입력')
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await saved(page)).toBe(raw)
  await page.evaluate(() => {
    ;(window as any).failRecovery = false
  })
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  expect((await records(page))[0].raw).toBe(raw)
  expect(JSON.parse((await saved(page))!).trips[0].title).toBe(
    '보호 실패 중 입력',
  )
})

test('이전 버전의 복구 원본도 안내·확인·재실행 접근을 제공하며 삭제하지 않음', async ({
  page,
}) => {
  const legacy = damaged()
  await boot(page, JSON.stringify(store()), { legacy })
  await expect(page.locator('.recovery-notice')).toBeVisible()
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  await page.getByRole('button', { name: '확인했어요', exact: true }).click()
  await page.reload()
  await expect(page.locator('.recovery-notice')).toHaveCount(0)
  expect(
    await page.evaluate(
      (key) => localStorage.getItem(key + '-recovery'),
      STORAGE_KEY,
    ),
  ).toBe(legacy)
  expect((await records(page))[0].raw).toBe(legacy)
})

test('원본 내보내기 취소·실패·성공에서도 원본과 미확인 안내를 보존', async ({
  page,
}) => {
  const raw = damaged()
  await boot(page, raw)
  await page.evaluate(() => {
    ;(window as any).Capacitor.getPlatform = () => 'android'
  })
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  for (const [mode, expected] of [
    ['cancel', '원본 저장을 취소했어요'],
    ['fail', '원본 파일을 저장하지 못했어요'],
    ['success', '복구 원본 파일을 저장했어요'],
  ]) {
    await page.evaluate((mode) => {
      ;(window as any).exportMode = mode
    }, mode)
    await page
      .getByRole('button', { name: '원본 파일 내보내기', exact: true })
      .click()
    await expect(page.getByRole('dialog')).toContainText(expected)
    expect((await records(page))[0].raw).toBe(raw)
    expect((await records(page))[0].acknowledged).toBe(false)
  }
  expect(
    await page.evaluate(() =>
      (window as any).exports.map((v: any) => v.value.text),
    ),
  ).toEqual([raw, raw, raw])
})

test('확인 상태 저장 실패는 안내를 없애거나 원본을 삭제하지 않음', async ({
  page,
}) => {
  await boot(page, damaged())
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  await page.evaluate(() => {
    ;(window as any).failConfirm = true
  })
  await page.getByRole('button', { name: '확인했어요', exact: true }).click()
  await expect(page.locator('.recovery-notice')).toBeVisible()
  expect((await records(page))[0].acknowledged).toBe(false)
})

test('시작 시 기록 읽기가 거절돼도 기존 원본을 빈 기록으로 덮어쓰지 않음', async ({
  page,
}) => {
  const raw = JSON.stringify(store())
  await boot(page, raw, { readFails: true })
  await expect(page.locator('.storage-warning')).toBeVisible()
  await page.evaluate(() => {
    ;(window as any).failReadMain = false
  })
  await create(page)
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await saved(page)).toBe(raw)
})

test('다른 화면에서 바뀐 기록을 오래된 입력으로 덮어쓰지 않음', async ({
  page,
}) => {
  await boot(page)
  await openTrips(page)
  await page
    .getByRole('button', { name: '여행 정보 수정', exact: true })
    .click()
  await page.getByLabel('여행 이름', { exact: true }).fill('오래된 화면의 수정')
  const newer = JSON.stringify(
    store([{ ...trip, title: '다른 화면의 최신 기록' }]),
  )
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: newer,
  })
  await page.getByRole('button', { name: '변경사항 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await saved(page)).toBe(newer)
  await expect(page.locator('.modal-save-error')).toContainText(
    '다른 화면에서 기록이 변경',
  )
})

test('첨부 삭제의 기록 저장 실패는 파일 바이트를 지우지 않고 재시도 후 함께 제거', async ({
  page,
}) => {
  await boot(page)
  await openTrips(page)
  await openWorkspace(page, '자료')
  await page.getByLabel('첨부할 자료 파일').setInputFiles({
    name: '보존할 원본.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('EXACT-ATTACHMENT-BYTES'),
  })
  await expect
    .poll(
      async () =>
        JSON.parse((await saved(page))!).trips[0].attachments?.length || 0,
    )
    .toBe(1)
  const fileId = JSON.parse((await saved(page))!).trips[0].attachments[0].id
  const bytes = () =>
    page.evaluate(async (id) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('jido-attachments-v1', 1)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      const blob = await new Promise<Blob | undefined>((resolve, reject) => {
        const req = db.transaction('files').objectStore('files').get(id)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
      db.close()
      return blob ? blob.text() : null
    }, fileId)
  await fail(page, true)
  await page
    .getByRole('button', { name: '보존할 원본.txt 첨부 삭제', exact: true })
    .click()
  await page.getByRole('button', { name: '첨부 삭제', exact: true }).click()
  await expect(page.locator('.attachment-error')).toBeVisible()
  expect(JSON.parse((await saved(page))!).trips[0].attachments).toHaveLength(1)
  expect(await bytes()).toBe('EXACT-ATTACHMENT-BYTES')
  await fail(page, false)
  await page.getByRole('button', { name: '첨부 삭제', exact: true }).click()
  await expect
    .poll(
      async () => JSON.parse((await saved(page))!).trips[0].attachments.length,
    )
    .toBe(0)
  await expect.poll(bytes).toBeNull()
})

test('320px 복구 안내와 원본 내보내기 버튼이 넘치거나 하단에 가려지지 않음', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await boot(page, damaged())
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('목록에서 제외된 여행 3개')
  expect(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true)
  const button = dialog.getByRole('button', {
    name: '원본 파일 내보내기',
    exact: true,
  })
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeInViewport()
  await page.screenshot({
    path: testInfo.outputPath('recovery-320.png'),
    fullPage: true,
  })
})

test('전체 복원의 공통 저장 콜백 실패에서도 기존 여행과 개인 사진 매핑을 되돌림', async () => {
  const { commitFullRestore } = await import('../src/full-backup')
  const { tripSchema } = await import('../src/travel-model')
  const { personalPhotosSnapshot, replacePersonalPhotos } =
    await import('../src/personal-photos')
  const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage',
    ),
    values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
  const before = personalPhotosSnapshot()
  try {
    const current = {
      version: 1 as const,
      savedCities: [],
      savedPlaces: [],
      trips: [tripSchema.parse(trip)],
    }
    values.set(STORAGE_KEY, JSON.stringify(current))
    const existing = {
      id: 'aaaa1111-1111-4111-8111-111111111111',
      name: '원래 사진.jpg',
      mimeType: 'image/jpeg' as const,
      size: 10,
      createdAt: '2026-10-28T00:00:00.000Z',
      storage: 'browser' as const,
    }
    replacePersonalPhotos({ 'place:kiyomizu': existing })
    expect(() =>
      commitFullRestore(
        current,
        [tripSchema.parse({ ...trip, id: 'restored' })],
        {
          'place:fushimi': {
            ...existing,
            id: 'bbbb1111-1111-4111-8111-111111111111',
          },
        },
        () => {
          throw new Error('common writer quota failure')
        },
      ),
    ).toThrow('common writer quota failure')
    expect(personalPhotosSnapshot()).toEqual({ 'place:kiyomizu': existing })
    expect(JSON.parse(values.get(STORAGE_KEY)!).trips).toHaveLength(1)
  } finally {
    replacePersonalPhotos(before)
    if (descriptor)
      Object.defineProperty(globalThis, 'localStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

test('확인한 것과 같은 손상이 다시 생겨도 새로운 안내와 사본을 보존', async ({
  page,
}) => {
  const raw = damaged()
  await boot(page, raw)
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  await page.getByRole('button', { name: '확인했어요', exact: true }).click()
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), {
    key: STORAGE_KEY,
    raw,
  })
  await page.reload()
  await expect(page.locator('.recovery-notice')).toBeVisible()
  await expect.poll(async () => (await records(page)).length).toBe(2)
  expect(
    (await records(page)).filter((record) => !record.acknowledged),
  ).toHaveLength(1)
  await page.reload()
  await expect(page.locator('.recovery-notice')).toBeVisible()
  expect(await records(page)).toHaveLength(2)
})

test('원본 사본 저장 실패 후 공간을 확보해 확인하면 정상 기록과 확인 상태를 함께 유지', async ({
  page,
}) => {
  await boot(page, damaged(), { recoveryFails: true })
  await page
    .getByRole('button', { name: '복구 내용 확인', exact: true })
    .click()
  await page.evaluate(() => {
    ;(window as any).failRecovery = false
  })
  await page.getByRole('button', { name: '확인했어요', exact: true }).click()
  expect(JSON.parse((await saved(page))!).trips).toHaveLength(1)
  expect((await records(page))[0].acknowledged).toBe(true)
  await page.reload()
  await expect(page.locator('.recovery-notice')).toHaveCount(0)
  expect(await records(page)).toHaveLength(1)
})

test('복구 목록 조회만 거절되어도 읽어 둔 기존 원본을 빈 여행으로 덮어쓰지 않음', async ({
  page,
}) => {
  const raw = JSON.stringify(store())
  await boot(page, raw, { indexFails: true })
  await expect(page.locator('.storage-warning')).toBeVisible()
  await create(page)
  await page
    .getByRole('button', { name: '내 여행 만들기', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await saved(page)).toBe(raw)
})

for (const mode of ['order', 'time'] as const) {
  test(`${mode}: 일정 순서·시간 편집의 저장 실패는 미리보기 창과 원본을 유지`, async ({
    page,
  }) => {
    const sample = {
      ...trip,
      days: [
        [
          { id: 'a', placeId: 'kiyomizu', time: '10:00', note: '기존 메모' },
          { id: 'b', placeId: 'fushimi', time: '11:00', note: '' },
        ],
        [],
      ],
    }
    await boot(page, JSON.stringify(store([sample])))
    await openTrips(page)
    await openScheduleEditor(page)
    const before = await saved(page)
    await page
      .getByRole('button', {
        name: mode === 'order' ? '순서 편집' : '시간 변경',
        exact: true,
      })
      .click()
    const dialog = page.getByRole('dialog', {
      name: mode === 'order' ? '방문 순서 편집' : '일정 시간 일괄 변경',
      exact: true,
    })
    if (mode === 'order')
      await dialog
        .getByLabel('후시미 이나리 신사 방문 순번', { exact: true })
        .selectOption('0')
    else
      await dialog
        .getByLabel('기요미즈데라 시간 변경 선택', { exact: true })
        .check()
    const button = dialog.getByRole('button', {
      name: mode === 'order' ? '순서 적용' : /곳 변경 적용/,
      exact: true,
    })
    await fail(page, true)
    await button.click()
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('저장하지 못했어요')
    expect(await saved(page)).toBe(before)
    await fail(page, false)
    await button.click()
    await expect(dialog).not.toBeVisible()
    expect(await saved(page)).not.toBe(before)
  })
}
