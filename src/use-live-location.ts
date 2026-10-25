import { App as NativeApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { useEffect, useRef, useState } from 'react'
import { validLivePosition, type LivePosition } from './live-location'
export function useLiveLocation() {
  const [position, setPosition] = useState<LivePosition>(),
    [previous, setPrevious] = useState<LivePosition>(),
    [running, setRunning] = useState(false),
    [message, setMessage] = useState(''),
    [now, setNow] = useState(Date.now)
  const generation = useRef(0),
    last = useRef<LivePosition | undefined>(undefined),
    history = useRef<LivePosition[]>([]),
    watch = useRef<{ native?: string; browser?: number }>({})
  function dispose() {
    generation.current++
    const active = watch.current
    watch.current = {}
    if (active.native)
      void Geolocation.clearWatch({ id: active.native }).catch(() => {})
    if (active.browser !== undefined)
      navigator.geolocation.clearWatch(active.browser)
    last.current = undefined
    history.current = []
  }
  function stop() {
    dispose()
    setRunning(false)
    setPosition(undefined)
    setPrevious(undefined)
    setMessage('')
  }
  async function start() {
    dispose()
    setPosition(undefined)
    setPrevious(undefined)
    setMessage('위치를 확인하고 있어요.')
    setRunning(true)
    const token = generation.current
    const receive = (
      value: {
        timestamp: number
        coords: { latitude: number; longitude: number; accuracy: number }
      } | null,
      error?: unknown,
    ) => {
      if (token !== generation.current) return
      if (error || !value) {
        const code = String((error as { code?: string | number })?.code || '')
        if (code === '1' || code.includes('0003')) {
          dispose()
          setRunning(false)
          setPosition(undefined)
          setPrevious(undefined)
        }
        setMessage(
          code === '1' || code.includes('0003')
            ? '위치 권한이 허용되지 않았어요. 기기 설정에서 J★Do 위치 권한을 확인해 주세요.'
            : '현재 위치를 확인하지 못했어요. 위치 서비스를 켜고 다시 시도해 주세요.',
        )
        return
      }
      const next = {
        lat: value.coords.latitude,
        lng: value.coords.longitude,
        accuracy: value.coords.accuracy,
        timestamp: value.timestamp,
      }
      if (
        !validLivePosition(next) ||
        (last.current && next.timestamp <= last.current.timestamp)
      ) {
        if (!last.current) setMessage('최신 위치를 기다리고 있어요.')
        return
      }
      history.current = history.current.filter(
        (point) =>
          validLivePosition(point) && next.timestamp - point.timestamp <= 60000,
      )
      setPrevious(history.current[0])
      if (
        next.accuracy <= 100 &&
        (!history.current.length ||
          next.timestamp - history.current.at(-1)!.timestamp >= 5000)
      )
        history.current = [...history.current, next].slice(-8)
      last.current = next
      setPosition(next)
      setNow(Date.now())
      setMessage('')
    }
    try {
      if (Capacitor.isNativePlatform()) {
        let permission = await Geolocation.checkPermissions()
        if (token !== generation.current) return
        if (
          permission.location !== 'granted' &&
          permission.coarseLocation !== 'granted'
        )
          permission = await Geolocation.requestPermissions({
            permissions: ['location'],
          })
        if (token !== generation.current || document.hidden) return
        if (
          permission.location !== 'granted' &&
          permission.coarseLocation !== 'granted'
        ) {
          setMessage(
            '위치 권한이 허용되지 않았어요. 기기 설정에서 위치 권한을 확인해 주세요.',
          )
          setRunning(false)
          return
        }
        const id = await Geolocation.watchPosition(
          {
            enableHighAccuracy: permission.location === 'granted',
            timeout: 15000,
            maximumAge: 10000,
            interval: 10000,
            minimumUpdateInterval: 10000,
          },
          (p, e) => receive(p, e),
        )
        if (token !== generation.current || document.hidden)
          await Geolocation.clearWatch({ id })
        else watch.current = { native: id }
      } else if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (p) => receive(p),
          (e) => receive(null, e),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        )
        if (token !== generation.current) navigator.geolocation.clearWatch(id)
        else watch.current = { browser: id }
      } else {
        setRunning(false)
        setMessage('이 기기에서는 위치 기능을 사용할 수 없어요.')
      }
    } catch {
      if (token === generation.current) {
        setRunning(false)
        setMessage('위치 권한 또는 기기의 위치 서비스 설정을 확인해 주세요.')
      }
    }
  }
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop()
    }
    const nativeListener = Capacitor.isNativePlatform()
      ? NativeApp.addListener('appStateChange', (state) => {
          if (!state.isActive) stop()
        }).catch(() => undefined)
      : undefined
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', stop)
    return () => {
      dispose()
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', stop)
      void nativeListener
        ?.then((listener) => listener?.remove())
        .catch(() => {})
    }
  }, [])
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [running])
  return {
    position,
    previous,
    running,
    message,
    now,
    start,
    stop,
    stale: !!position && !validLivePosition(position, now),
  }
}
