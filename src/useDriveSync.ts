import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { z } from 'zod'
import { GoogleSyncDrive, type SyncAccount } from './sync-drive'
import { createSyncLocal } from './sync-local'
import { runDriveSync } from './sync-engine'
import type { SyncChoices, SyncConflict } from './sync-merge'
import { clearSyncAccount } from './sync-db'
import { subscribePersonalPhotos } from './personal-photos'
import { subscribeGuidebooks } from './guidebook-store'
import type { TravelStore } from './store'

const key = 'jido-google-drive-settings-v1'
const configSchema = z
  .object({
    enabled: z.boolean(),
    automatic: z.boolean(),
    device: z.string().uuid(),
    account: z
      .object({
        id: z.string().min(1).max(200),
        email: z.string().min(3).max(320),
        name: z.string().max(200),
      })
      .optional(),
    lastSyncedAt: z.string().datetime().optional(),
  })
  .strict()
type Config = z.infer<typeof configSchema>
type View = Config & {
  phase: 'off' | 'idle' | 'syncing' | 'conflict' | 'error'
  message: string
  conflicts: SyncConflict[]
}
function readConfig(): Config {
  const raw = localStorage.getItem(key)
  if (raw) {
    const parsed = configSchema.safeParse(JSON.parse(raw))
    if (!parsed.success)
      throw new Error(
        'Google Drive 연결 설정을 확인하지 못했어요. 기기 기록은 그대로예요.',
      )
    return parsed.data
  }
  return { enabled: false, automatic: true, device: crypto.randomUUID() }
}
export function useDriveSync(
  getStore: () => TravelStore,
  save: (value: TravelStore) => boolean,
) {
  const current = useRef({ getStore, save })
  current.current = { getStore, save }
  const [service] = useState(() => {
    const drive = new GoogleSyncDrive(),
      local = createSyncLocal(
        () => current.current.getStore(),
        (value) => current.current.save(value),
      )
    let config: Config,
      error = ''
    try {
      config = readConfig()
    } catch (e) {
      config = { enabled: false, automatic: true, device: crypto.randomUUID() }
      error = e instanceof Error ? e.message : '연결 설정을 읽지 못했어요.'
    }
    let view: View = {
        ...config,
        phase: error ? 'error' : config.enabled ? 'idle' : 'off',
        message: error,
        conflicts: [],
      },
      generation = 0,
      busy = false,
      interactive = false,
      started = false,
      retryAt = 0,
      failures = 0,
      conflictToken: string | undefined,
      timer: ReturnType<typeof setTimeout> | undefined
    const listeners = new Set<() => void>()
    const update = (changes: Partial<View>) => {
      view = { ...view, ...changes }
      for (const l of listeners) l()
    }
    const persist = (next: Config) => {
      localStorage.setItem(key, JSON.stringify(configSchema.parse(next)))
      config = next
      update(next)
    }
    const foreground = () =>
      typeof document === 'undefined' || document.visibilityState !== 'hidden'
    const pause = () => {
      if (interactive) return
      generation++
      drive.cancel()
      if (busy)
        update({
          phase: config.enabled ? 'idle' : 'off',
          message: '앱을 열면 이어서 동기화해요.',
        })
    }
    const sync = async (
      manual = false,
      connect = false,
      choices: SyncChoices = {},
    ) => {
      if (busy || !foreground() || (!connect && !config.enabled)) return
      if (!manual && (view.phase === 'conflict' || Date.now() < retryAt)) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        update({ message: '인터넷 연결 후 다시 동기화해요.' })
        return
      }
      busy = true
      interactive = connect
      const active = ++generation
      update({
        phase: 'syncing',
        message: 'Google Drive 연결 중',
        conflicts: [],
      })
      try {
        const result = await runDriveSync({
          drive,
          local,
          device: config.device,
          expectedAccount: config.account,
          interactive: connect,
          forceFiles: manual,
          choices,
          expectedConflictToken: conflictToken,
          isActive: () => active === generation && started,
          onProgress: (message) => {
            if (active === generation) update({ message })
          },
          onAccount: (account) => {
            if (active !== generation) return
            interactive = false
            if (!config.enabled || !config.account)
              persist({ ...config, enabled: true, account })
            if (!foreground())
              throw new Error('앱 화면으로 돌아오면 동기화를 이어갈 수 있어요.')
          },
        })
        if (active !== generation) return
        if (result.conflicts.length) {
          conflictToken = result.conflictToken
          update({
            phase: 'conflict',
            message:
              '같은 항목이 여러 기기에서 달라졌어요. 유지할 내용을 선택해 주세요.',
            conflicts: result.conflicts,
          })
          return
        }
        conflictToken = undefined
        failures = 0
        retryAt = 0
        persist({
          ...config,
          account: result.account,
          enabled: true,
          lastSyncedAt: new Date().toISOString(),
        })
        update({ phase: 'idle', message: '동기화됐어요.', conflicts: [] })
      } catch (e) {
        if (active === generation) {
          const message =
            e instanceof z.ZodError || e instanceof SyntaxError
              ? '동기화 자료 형식이나 사진·가이드 연결을 확인하지 못했어요. 기존 기록은 그대로예요.'
              : e instanceof Error
                ? e.message
                : '동기화를 마치지 못했어요. 기존 기록은 그대로예요.'
          failures++
          retryAt =
            Date.now() +
            Math.min(300000, 15000 * 2 ** Math.min(failures - 1, 5))
          update({
            phase: /입력 중|기기 기록이 바뀌|앱 화면으로 돌아오면/.test(message)
              ? 'idle'
              : 'error',
            message,
          })
        }
      } finally {
        interactive = false
        busy = false
      }
    }
    const changed = () => {
      if (!started || !config.enabled || !config.automatic) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void sync(), 8000)
    }
    const resume = () => {
      if (foreground()) {
        if (config.automatic) {
          if (busy)
            setTimeout(() => {
              if (started && foreground()) void sync()
            }, 500)
          else void sync()
        }
      } else pause()
    }
    return {
      snapshot: () => view,
      subscribe: (l: () => void) => {
        listeners.add(l)
        return () => {
          listeners.delete(l)
        }
      },
      connect: () => sync(true, true),
      sync: () => sync(true),
      resolve: (choices: SyncChoices) => sync(true, false, choices),
      automatic: (value: boolean) => {
        try {
          persist({ ...config, automatic: value })
          if (value) void sync()
        } catch {
          update({
            phase: 'error',
            message: '자동 동기화 설정을 저장하지 못했어요.',
          })
        }
      },
      disconnect: async () => {
        const account = config.account
        generation++
        drive.cancel()
        conflictToken = undefined
        try {
          persist({
            enabled: false,
            automatic: config.automatic,
            device: config.device,
          })
          update({
            phase: 'off',
            message: '연결을 해제했어요. 기기와 Drive의 여행 기록은 유지해요.',
            conflicts: [],
          })
        } catch {
          update({
            phase: 'error',
            message: '연결 해제 설정을 저장하지 못했어요. 다시 시도해 주세요.',
          })
          return
        }
        if (account) {
          try {
            await drive.revoke(account.email)
          } catch {
            update({
              message:
                '기기 연결은 껐어요. Google 계정의 앱 접근 권한도 확인해 주세요.',
            })
          }
          await clearSyncAccount(account.id).catch(() => {})
        }
      },
      start: () => {
        started = true
        const interval = setInterval(() => {
          if (config.automatic) void sync()
        }, 30000)
        window.addEventListener('jido:personal-data-change', changed)
        window.addEventListener('online', resume)
        window.addEventListener('focus', resume)
        document.addEventListener('visibilitychange', resume)
        const photo = subscribePersonalPhotos(changed),
          books = subscribeGuidebooks(changed)
        let disposed = false
        const nativeListener = NativeApp.addListener(
          'appStateChange',
          ({ isActive }) => (isActive ? resume() : pause()),
        )
        void nativeListener
          .then((handle) => {
            if (disposed) void handle.remove()
          })
          .catch(() => {})
        const initial = setTimeout(() => {
          if (config.enabled && config.automatic) void sync()
        }, 0)
        return () => {
          started = false
          disposed = true
          generation++
          drive.cancel()
          clearTimeout(initial)
          clearInterval(interval)
          if (timer) clearTimeout(timer)
          photo()
          books()
          window.removeEventListener('jido:personal-data-change', changed)
          window.removeEventListener('online', resume)
          window.removeEventListener('focus', resume)
          document.removeEventListener('visibilitychange', resume)
          void nativeListener.then((h) => h.remove()).catch(() => {})
        }
      },
    }
  })
  const view = useSyncExternalStore(service.subscribe, service.snapshot)
  useEffect(service.start, [service])
  return {
    ...view,
    connect: service.connect,
    sync: service.sync,
    resolve: service.resolve,
    disconnect: service.disconnect,
    setAutomatic: service.automatic,
  }
}
export type DriveSyncState = ReturnType<typeof useDriveSync>
