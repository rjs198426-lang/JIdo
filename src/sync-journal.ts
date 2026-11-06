import { syncDb, writeSyncDb } from './sync-db'

export const syncStorageKeys = [
  'jido-travel-v1',
  'jido-personal-photos-v1',
  'jdo-guide-catalog-v1',
  'jdo-guidebooks-v1',
] as const
const marker = 'jido-sync-transaction-v1'
export type SyncRawData = Record<
  (typeof syncStorageKeys)[number],
  string | null
>
type Journal = {
  id: string
  before: SyncRawData
  after: SyncRawData
  complete: boolean
}
export function readSyncRaw(): SyncRawData {
  return Object.fromEntries(
    syncStorageKeys.map((k) => [k, localStorage.getItem(k)]),
  ) as SyncRawData
}
function writeRaw(data: SyncRawData) {
  for (const key of syncStorageKeys)
    data[key] === null
      ? localStorage.removeItem(key)
      : localStorage.setItem(key, data[key]!)
}
function valid(value: unknown): value is Journal {
  if (!value || typeof value !== 'object') return false
  const v = value as Journal
  return (
    /^[a-f0-9-]{36}$/i.test(v.id || '') &&
    typeof v.complete === 'boolean' &&
    [v.before, v.after].every(
      (raw) =>
        raw &&
        typeof raw === 'object' &&
        Object.keys(raw).length === syncStorageKeys.length &&
        syncStorageKeys.every(
          (k) =>
            raw[k] === null ||
            (typeof raw[k] === 'string' && raw[k]!.length <= 10 * 1024 * 1024),
        ),
    )
  )
}
export async function prepareSyncJournal(
  before: SyncRawData,
  after: SyncRawData,
) {
  if (localStorage.getItem(marker))
    throw new Error('이전 동기화 복구를 먼저 마쳐 주세요.')
  const id = crypto.randomUUID(),
    journal: Journal = { id, before, after, complete: false }
  await writeSyncDb([{ key: 'journal', value: journal }])
  try {
    localStorage.setItem(marker, id + '|pending')
  } catch (error) {
    await writeSyncDb([{ key: 'journal' }])
    throw error
  }
  return journal
}
export function markSyncApplied(journal: Journal) {
  localStorage.setItem(marker, journal.id + '|applied')
}
export async function discardSyncJournal() {
  localStorage.removeItem(marker)
  await writeSyncDb([{ key: 'journal' }])
}
export async function finishSyncJournal(
  journal: Journal,
  account: string,
  checkpoint: unknown,
) {
  await writeSyncDb([
    { key: account + '/checkpoint', value: checkpoint },
    { key: 'journal', value: { ...journal, complete: true } },
  ])
  localStorage.removeItem(marker)
  await writeSyncDb([{ key: 'journal' }]).catch(() => {})
}
export async function rollbackSyncJournal(
  journal: Journal,
  preserveMain = false,
) {
  if (preserveMain) {
    for (const key of syncStorageKeys.filter((k) => k !== 'jido-travel-v1'))
      journal.before[key] === null
        ? localStorage.removeItem(key)
        : localStorage.setItem(key, journal.before[key]!)
  } else writeRaw(journal.before)
  localStorage.removeItem(marker)
  await writeSyncDb([{ key: 'journal' }])
}
// main.tsx awaits this before importing any modules that read private storage.
export async function recoverSyncJournal() {
  const markerValue = localStorage.getItem(marker)
  if (!markerValue) return
  const [id, phase] = markerValue.split('|')
  const journal = await syncDb<Journal>('journal')
  if (
    !valid(journal) ||
    journal.id !== id ||
    !['pending', 'applied'].includes(phase)
  )
    throw new Error(
      '동기화 복구 기록을 읽지 못했어요. 기기 자료를 삭제하지 말고 다시 실행해 주세요.',
    )
  if (!journal.complete && phase !== 'applied') {
    for (const key of syncStorageKeys) {
      const current = localStorage.getItem(key)
      if (current !== journal.before[key] && current !== journal.after[key])
        throw new Error(
          '다른 화면에서 기록이 바뀌었어요. 기존 자료를 보존하기 위해 자동 복구를 멈췄어요.',
        )
    }
    writeRaw(journal.before)
  }
  localStorage.removeItem(marker)
  await writeSyncDb([{ key: 'journal' }])
}
