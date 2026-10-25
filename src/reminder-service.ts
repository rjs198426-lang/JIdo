import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import {
  LocalNotifications,
  type LocalNotificationsPlugin,
} from '@capacitor/local-notifications'
import { useEffect, useRef, useState } from 'react'
import type { Trip } from './travel-model'
import {
  readReminderPreferences,
  reminderEvent,
  reminderKey,
  planTravelReminders,
  reminderLimit,
  type TravelReminder,
  type ReminderTarget,
} from './travel-reminders'
export const reminderNative = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
export const alarmIdStart = 410000
export const reminderChannel = 'jido-travel-reminders-v1'
type AlarmApi = Pick<
  LocalNotificationsPlugin,
  'getPending' | 'cancel' | 'checkPermissions' | 'createChannel' | 'schedule'
>
export async function reconcileReminders(
  api: AlarmApi,
  plan: TravelReminder[],
  enabled: boolean,
) {
  const permission = enabled ? await api.checkPermissions() : undefined
  const pending = await api.getPending()
  const owned = pending.notifications
    .filter((i) => i.id >= alarmIdStart && i.id < alarmIdStart + reminderLimit)
    .map(({ id }) => ({ id }))
  if (owned.length) await api.cancel({ notifications: owned })
  if (!enabled) return { count: 0, message: '예정된 여행 알림을 껐어요.' }
  if (permission?.display !== 'granted')
    return { count: 0, message: 'Android 설정에서 J★Do 알림을 허용해 주세요.' }
  await api.createChannel({
    id: reminderChannel,
    name: '여행 알림',
    description: '출발·준비물·예약·방문 일정',
    importance: 3,
    visibility: 0,
  })
  const notifications = plan.slice(0, reminderLimit).map((item, index) => ({
    id: alarmIdStart + index,
    title: item.title,
    body: item.body,
    schedule: { at: item.at },
    channelId: reminderChannel,
    smallIcon: 'ic_stat_jido',
    iconColor: '#087f74',
    isExactNotification: false,
    extra: item.target,
  }))
  if (notifications.length) await api.schedule({ notifications })
  return {
    count: notifications.length,
    message: notifications.length
      ? `${notifications.length}개의 알림을 예약했어요.`
      : '지금 예약할 알림이 없어요.',
  }
}
export const reminderStatusEvent = 'jido:reminder-status'
let status = { count: 0, message: '' }
export function reminderStatus() {
  return status
}
function report(next: typeof status) {
  status = next
  window.dispatchEvent(new Event(reminderStatusEvent))
}
let queue = Promise.resolve()
export function syncTravelReminders(trips: Trip[]) {
  if (!reminderNative()) return Promise.resolve()
  queue = queue
    .catch(() => {})
    .then(async () => {
      const prefs = readReminderPreferences()
      try {
        report(
          await reconcileReminders(
            LocalNotifications,
            planTravelReminders(trips, prefs),
            prefs.enabled,
          ),
        )
      } catch {
        report({
          count: 0,
          message:
            '알림을 예약하지 못했어요. 알림 권한을 확인하고 앱을 다시 열어 주세요.',
        })
      }
    })
  return queue
}
export function useReminderPreferences() {
  const [prefs, setPrefs] = useState(readReminderPreferences)
  useEffect(() => {
    const read = () => setPrefs(readReminderPreferences())
    const storage = (event: StorageEvent) => {
      if (event.key === reminderKey || event.key === null) read()
    }
    window.addEventListener(reminderEvent, read)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener(reminderEvent, read)
      window.removeEventListener('storage', storage)
    }
  }, [])
  return prefs
}
export function useTravelReminders(
  trips: Trip[],
  onOpen: (target: ReminderTarget) => void,
) {
  const prefs = useReminderPreferences(),
    callback = useRef(onOpen)
  callback.current = onOpen
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) setRevision((v) => v + 1)
    }
    const nativeListener = reminderNative()
      ? NativeApp.addListener('appStateChange', (state) => {
          if (state.isActive) setRevision((value) => value + 1)
        }).catch(() => undefined)
      : undefined
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    const timer = setInterval(refresh, 60 * 60000)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      clearInterval(timer)
      void nativeListener
        ?.then((listener) => listener?.remove())
        .catch(() => {})
    }
  }, [])
  useEffect(() => {
    if (!reminderNative()) return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) void syncTravelReminders(trips)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trips, prefs, revision])
  useEffect(() => {
    if (!reminderNative()) return
    const handle = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (event) => {
        const target = event.notification.extra as
          Partial<ReminderTarget> | undefined
        if (
          target &&
          typeof target.tripId === 'string' &&
          Number.isInteger(target.day) &&
          ['schedule', 'reservations', 'checklist'].includes(
            target.workspace || '',
          )
        )
          callback.current(target as ReminderTarget)
      },
    ).catch(() => undefined)
    return () => {
      void handle.then((listener) => listener?.remove()).catch(() => {})
    }
  }, [])
}
