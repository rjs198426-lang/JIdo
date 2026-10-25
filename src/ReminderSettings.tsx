import { dateAt, today } from './store'
import { useEffect, useState } from 'react'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Trip } from './travel-model'
import {
  planTravelReminders,
  writeReminderPreferences,
  reminderLimit,
  type ReminderPreferences,
} from './travel-reminders'
import {
  reminderNative,
  useReminderPreferences,
  reminderStatus,
  reminderStatusEvent,
  syncTravelReminders,
} from './reminder-service'
const zoneLabels: Record<string, string> = {
  'Asia/Seoul': '한국 · 서울',
  'Asia/Tokyo': '일본 · 도쿄',
  'Asia/Taipei': '대만 · 타이베이',
  'Asia/Hong_Kong': '홍콩',
  'Asia/Singapore': '싱가포르',
  'Asia/Bangkok': '태국 · 방콕',
  'Asia/Ho_Chi_Minh': '베트남',
  'Asia/Makassar': '인도네시아 · 발리',
  'Asia/Dubai': '아랍에미리트 · 두바이',
  'Indian/Maldives': '몰디브',
  'Pacific/Guam': '괌',
  'Pacific/Saipan': '사이판',
  'Europe/Athens': '그리스',
  'Europe/London': '영국 · 런던',
  'Europe/Paris': '프랑스 · 파리',
  'America/New_York': '미국 · 뉴욕',
  'America/Los_Angeles': '미국 · 로스앤젤레스',
  'Pacific/Honolulu': '미국 · 하와이',
  'Asia/Shanghai': '중국',
  'Australia/Sydney': '호주 · 시드니',
}
export default function ReminderSettings({ trips }: { trips: Trip[] }) {
  const prefs = useReminderPreferences(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [status, setStatus] = useState(reminderStatus)
  useEffect(() => {
    const update = () => setStatus(reminderStatus())
    window.addEventListener(reminderStatusEvent, update)
    return () => window.removeEventListener(reminderStatusEvent, update)
  }, [])
  const plan = planTravelReminders(trips, { ...prefs, enabled: true })
  const flights = trips.flatMap((trip) =>
    (trip.reservations || [])
      .filter(
        (r) =>
          r.kind === '항공' &&
          r.status !== 'cancelled' &&
          r.date >= dateAt(today(), -2),
      )
      .map((booking) => ({ trip, booking, key: `${trip.id}:${booking.id}` })),
  )
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zones = [
    ...new Set([
      zone,
      'Asia/Seoul',
      'Asia/Tokyo',
      'Asia/Taipei',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Asia/Bangkok',
      'Asia/Ho_Chi_Minh',
      'Asia/Makassar',
      'Asia/Dubai',
      'Indian/Maldives',
      'Asia/Shanghai',
      'Australia/Sydney',
      'Pacific/Guam',
      'Pacific/Saipan',
      'Europe/Athens',
      'Europe/London',
      'Europe/Paris',
      'America/New_York',
      'America/Los_Angeles',
      'Pacific/Honolulu',
    ]),
  ]
  function save(next: ReminderPreferences) {
    try {
      writeReminderPreferences(next)
      void syncTravelReminders(trips)
      setMessage('')
    } catch {
      setMessage('설정을 저장하지 못했어요. 기기 저장 공간을 확인해 주세요.')
    }
  }
  async function toggle() {
    if (prefs.enabled) {
      save({ ...prefs, enabled: false })
      return
    }
    setBusy(true)
    try {
      const permission = await LocalNotifications.requestPermissions()
      if (permission.display === 'granted') save({ ...prefs, enabled: true })
      else
        setMessage(
          '알림이 허용되지 않았어요. Android 설정에서 J★Do 알림을 켜 주세요.',
        )
    } catch {
      setMessage(
        '알림 권한을 확인하지 못했어요. 앱의 알림 설정을 확인해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="modal-body reminder-settings">
      <p>출발 전부터 여행 중까지, 필요한 알림만 받아보세요.</p>
      <button
        className={`button ${prefs.enabled ? 'outline' : 'primary'} full`}
        disabled={busy || !reminderNative()}
        onClick={() => void toggle()}
      >
        {busy
          ? '권한 확인 중…'
          : prefs.enabled
            ? '여행 알림 끄기'
            : '여행 알림 켜기'}
      </button>
      {!reminderNative() && (
        <p className="muted">알림 수신은 Android 앱에서 켤 수 있어요.</p>
      )}
      <div className="reminder-options">
        {(
          [
            [
              'countdown',
              '출발 D-day',
              '출발 7일 전부터 당일까지 매일 오전 9시',
            ],
            [
              'preparation',
              '미완료 준비물',
              '출발 전날 오후 6시, 남은 준비물이 있을 때',
            ],
            ['reservations', '예약 확인', '취소하지 않은 예약 1시간 전'],
            ['visits', '방문 일정', '방문 시간이 정해진 일정 30분 전'],
          ] as const
        ).map(([key, title, description]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={prefs[key]}
              onChange={(e) => save({ ...prefs, [key]: e.target.checked })}
            />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </div>
      {prefs.reservations && flights.length > 0 && (
        <details className="simple-options" open>
          <summary>항공 예약의 출발지 시간대</summary>
          <p>항공편은 출발 공항의 시간대를 선택한 예약만 알립니다.</p>
          {flights.map(({ trip, booking, key }) => (
            <label className="field" key={key}>
              {trip.title} · {booking.title}
              <select
                aria-label={`${booking.title} 출발지 시간대`}
                value={prefs.flightZones[key] || ''}
                onChange={(e) => {
                  const flightZones = { ...prefs.flightZones }
                  if (e.target.value) flightZones[key] = e.target.value
                  else delete flightZones[key]
                  save({ ...prefs, flightZones })
                }}
              >
                <option value="">출발지 시간대 선택</option>
                {zones.map((value) => (
                  <option key={value} value={value}>
                    {zoneLabels[value] || value}
                    {value === zone ? ' · 현재 기기' : ''}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </details>
      )}
      {(message || (prefs.enabled && status.message)) && (
        <p role="status">{message || status.message}</p>
      )}
      <section className="reminder-preview" aria-label="다가오는 알림">
        <h3>{prefs.enabled ? '다가오는 알림' : '켜면 받을 알림'}</h3>
        <small className="muted">현재 기기 시각 기준</small>
        {plan.length ? (
          <ul>
            {plan.slice(0, 5).map((item) => (
              <li key={item.key}>
                <span>
                  {item.at.toLocaleString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>조건에 맞는 예정 알림이 없어요.</p>
        )}
      </section>
      <details className="simple-options">
        <summary>알림 시간 안내</summary>
        <p>
          D-day와 준비물은 현재 기기 시각, 예약·방문은 여행지 현지 시각을
          기준으로 합니다. 여행지 시간대가 없는 직접 여행지는 기기 시각을
          사용합니다. 항공은 위에서 선택한 출발지 시간대를 사용합니다.
        </p>
        <p>
          휴대폰 절전 상태에 따라 수신이 늦어질 수 있어요. 가까운 알림부터 최대{' '}
          {reminderLimit}개를 예약하고 앱을 다시 열면 일정 변경과 기기 시간대에
          맞춰 갱신합니다. 예약 번호와 개인 메모는 알림에 넣지 않습니다.
        </p>
      </details>
    </div>
  )
}
