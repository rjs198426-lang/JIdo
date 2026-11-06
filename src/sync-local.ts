import {
  personalPhotosSnapshot,
  replacePersonalPhotos,
} from './personal-photos'
import { personalGuidesForSync, replaceSyncedPersonalGuides } from './catalog'
import { guidebooksSnapshot, replaceSyncedGuidebooks } from './guidebook-store'
import { isAndroid } from './attachment-storage'
import type { TravelStore } from './store'
import {
  canonicalSnapshot,
  parseSyncSnapshot,
  syncSnapshotSchema,
  stableJson,
  type SyncSnapshot,
} from './sync-model'
import {
  prepareSyncJournal,
  finishSyncJournal,
  rollbackSyncJournal,
  readSyncRaw,
  markSyncApplied,
  discardSyncJournal,
} from './sync-journal'
import { writeSyncDb } from './sync-db'
import { hasUnsavedDrafts } from './form-draft'

export interface SyncLocal {
  capture(): SyncSnapshot
  apply(
    snapshot: SyncSnapshot,
    expected: SyncSnapshot,
    account: string,
    checkpoint: unknown,
    isActive?: () => boolean,
  ): Promise<void>
  checkpoint(account: string, value: unknown): Promise<void>
}
export function createSyncLocal(
  getStore: () => TravelStore,
  save: (value: TravelStore) => boolean,
): SyncLocal {
  const capture = () => {
    const cache = guidebooksSnapshot()
    return parseSyncSnapshot({
      store: getStore(),
      photos: personalPhotosSnapshot(),
      catalog: personalGuidesForSync(),
      books: cache.books.map((b) => ({ ...b, id: b.guide.id })),
      retainedPlaces: cache.retainedPlaces,
    })
  }
  return {
    capture,
    checkpoint: async (account, value) =>
      writeSyncDb([{ key: account + '/checkpoint', value }]),
    async apply(
      snapshot,
      expected,
      account,
      checkpoint,
      isActive = () => true,
    ) {
      if (!isActive()) throw new Error('동기화가 중단됐어요.')
      const input =
        typeof document !== 'undefined' &&
        (document.activeElement?.matches(
          'input,textarea,select,[contenteditable="true"]',
        ) ||
          document.querySelector('.modal form'))
      if (hasUnsavedDrafts() || input)
        throw new Error(
          '입력 중인 내용을 먼저 저장하거나 닫아 주세요. 그다음 새 기록을 적용할 수 있어요.',
        )
      if (
        stableJson(canonicalSnapshot(capture())) !==
        stableJson(canonicalSnapshot(expected))
      )
        throw new Error(
          '동기화 중 기기 기록이 바뀌었어요. 최신 내용으로 다시 동기화해 주세요.',
        )
      const storage = isAndroid() ? 'android' : 'browser'
      const target = parseSyncSnapshot({
        ...snapshot,
        store: {
          ...snapshot.store,
          trips: snapshot.store.trips.map((t) => ({
            ...t,
            ...(t.attachments
              ? { attachments: t.attachments.map((f) => ({ ...f, storage })) }
              : {}),
          })),
        },
        photos: Object.fromEntries(
          Object.entries(snapshot.photos).map(([k, f]) => [
            k,
            { ...f, storage },
          ]),
        ),
      })
      const before = readSyncRaw(),
        previous = capture()
      const books = {
        schemaVersion: 1,
        books: target.books.map(({ id: _, ...b }) => b),
        retainedPlaces: target.retainedPlaces,
      }
      const catalog = target.catalog
      const after = {
        'jido-travel-v1': JSON.stringify(target.store),
        'jido-personal-photos-v1': JSON.stringify(target.photos),
        'jdo-guide-catalog-v1': JSON.stringify(catalog),
        'jdo-guidebooks-v1': JSON.stringify(books),
      }
      const journal = await prepareSyncJournal(before, after)
      if (!isActive()) {
        await discardSyncJournal()
        throw new Error('동기화가 중단됐어요.')
      }
      if (
        stableJson(canonicalSnapshot(capture())) !==
        stableJson(canonicalSnapshot(expected))
      ) {
        await discardSyncJournal()
        throw new Error('기기 기록이 바뀌어 다시 동기화해야 해요.')
      }
      let applied = false,
        mainApplied = false
      try {
        replaceSyncedGuidebooks(books)
        replaceSyncedPersonalGuides(target.catalog)
        replacePersonalPhotos(target.photos)
        if (!save(target.store))
          throw new Error('동기화 내용을 기기에 저장하지 못했어요.')
        mainApplied = true
        markSyncApplied(journal)
        applied = true
      } catch (error) {
        // Keep the prepared journal when rollback cannot be persisted; startup
        // recovery then runs before any private modules are loaded.
        try {
          replaceSyncedGuidebooks({
            schemaVersion: 1,
            books: previous.books.map(({ id: _, ...b }) => b),
            retainedPlaces: previous.retainedPlaces,
          })
          replaceSyncedPersonalGuides(previous.catalog)
          replacePersonalPhotos(previous.photos)
          if (mainApplied && !save(previous.store))
            throw new Error('기록 되돌리기에 실패했어요.')
          await rollbackSyncJournal(journal, true)
        } catch {
          throw new Error(
            '기기 저장 공간을 확인하고 앱을 다시 열어 동기화를 복구해 주세요. 기존 원본은 보존했어요.',
          )
        }
        throw error
      }
      if (applied) await finishSyncJournal(journal, account, checkpoint)
    },
  }
}
