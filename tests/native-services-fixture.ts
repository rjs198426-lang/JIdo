import type { Page } from '@playwright/test'
export async function nativeServicesFixture(page: Page) {
  await page.route('https://**', (r) => r.abort())
  await page.addInitScript(() => {
    const w = window as any
    w.androidBridge = {}
    w.serviceCalls = []
    w.alarmPending = []
    w.alarmPermission = 'prompt'
    w.locationPermission = 'prompt'
    w.listeners = new Map()
    w.gpsWatches = new Map()
    w.nextServiceId = 1
    const promiseMethods = [
      'checkPermissions',
      'requestPermissions',
      'getPending',
      'cancel',
      'createChannel',
      'schedule',
      'removeListener',
    ]
    w.Capacitor = {
      PluginHeaders: [
        {
          name: 'LocalNotifications',
          methods: [
            ...promiseMethods.map((name) => ({ name, rtype: 'promise' })),
            { name: 'addListener', rtype: 'callback' },
          ],
        },
        {
          name: 'Geolocation',
          methods: [
            ...['checkPermissions', 'requestPermissions', 'clearWatch'].map(
              (name) => ({ name, rtype: 'promise' }),
            ),
            { name: 'watchPosition', rtype: 'callback' },
          ],
        },
        {
          name: 'App',
          methods: [
            { name: 'addListener', rtype: 'callback' },
            { name: 'removeListener', rtype: 'promise' },
            { name: 'exitApp', rtype: 'promise' },
          ],
        },
      ],
      nativePromise: async (plugin: string, method: string, options: any) => {
        w.serviceCalls.push({ plugin, method, options })
        if (method === 'removeListener') {
          w.listeners.delete(options.callbackId)
          return {}
        }
        if (plugin === 'LocalNotifications') {
          if (method === 'checkPermissions')
            return { display: w.alarmPermission }
          if (method === 'requestPermissions') {
            w.alarmPermission = w.denyAlarm ? 'denied' : 'granted'
            return { display: w.alarmPermission }
          }
          if (method === 'getPending')
            return {
              notifications: w.alarmPending.map((n: any) => ({ id: n.id })),
            }
          if (method === 'cancel') {
            w.alarmPending = w.alarmPending.filter(
              (n: any) =>
                !options.notifications.some((i: any) => i.id === n.id),
            )
            return {}
          }
          if (method === 'schedule') {
            w.alarmPending = options.notifications
            return {
              notifications: options.notifications.map((n: any) => ({
                id: n.id,
              })),
            }
          }
          return {}
        }
        if (plugin === 'Geolocation') {
          if (method === 'checkPermissions')
            return {
              location: w.coarseOnly ? 'denied' : w.locationPermission,
              coarseLocation: w.coarseOnly ? 'granted' : w.locationPermission,
            }
          if (method === 'requestPermissions') {
            if (w.deferLocationPermission)
              return new Promise((resolve) => {
                w.resolveLocationPermission = () => {
                  w.locationPermission = 'granted'
                  resolve({ location: 'granted', coarseLocation: 'granted' })
                }
              })
            w.locationPermission = w.denyLocation ? 'denied' : 'granted'
            return {
              location: w.coarseOnly ? 'denied' : w.locationPermission,
              coarseLocation: w.coarseOnly ? 'granted' : w.locationPermission,
            }
          }
          if (method === 'clearWatch') {
            w.gpsWatches.delete(options.id)
            return {}
          }
        }
        return {}
      },
      nativeCallback: (
        plugin: string,
        method: string,
        options: any,
        callback: any,
      ) => {
        const id = String(w.nextServiceId++)
        w.serviceCalls.push({ plugin, method, options })
        if (method === 'addListener')
          w.listeners.set(id, { plugin, event: options.eventName, callback })
        if (plugin === 'Geolocation' && method === 'watchPosition') {
          w.gpsWatches.set(id, callback)
          w.retiredGPSCallback = callback
        }
        return id
      },
    }
    w.emitReminder = (extra: any) => {
      for (const l of w.listeners.values())
        if (
          l.plugin === 'LocalNotifications' &&
          l.event === 'localNotificationActionPerformed'
        )
          l.callback({ notification: { extra } })
    }
    w.emitAppState = (isActive: boolean) => {
      for (const l of w.listeners.values())
        if (l.plugin === 'App' && l.event === 'appStateChange')
          l.callback({ isActive })
    }
    w.emitGPS = (lat: number, lng: number, accuracy = 10, age = 0) => {
      for (const cb of w.gpsWatches.values())
        cb(
          {
            timestamp: Date.now() - age,
            coords: { latitude: lat, longitude: lng, accuracy },
          },
          undefined,
        )
    }
  })
}
