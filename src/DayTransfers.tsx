import { useState } from 'react'
import { mapQuery, stopDetails, type Trip } from './travel-model'
import {
  arrivalText,
  placeSignature,
  dayTransferLegs,
} from './transfer-planning'
import {
  travelModes,
  type GoogleRouting,
  type TravelMode,
} from './google-routes'
export default function DayTransfers({
  trip,
  day,
  onUpdate,
  routing,
}: {
  trip: Trip
  day: number
  onUpdate: (trip: Trip) => void
  routing: GoogleRouting
}) {
  const originalLegs = dayTransferLegs(trip, day)
  const automatic = new Map(
    originalLegs.flatMap(({ previous, stop, transfer }) => {
      const value = routing.stateFor(previous, stop)?.value
      return !transfer && value
        ? [
            [
              stop.id,
              {
                fromStopId: previous.id,
                fromPlace: placeSignature(previous),
                toPlace: placeSignature(stop),
                minutes: value.minutes,
                mode: routing.modeFor(previous, stop),
                checkedAt: value.checkedAt,
              },
            ] as const,
          ]
        : []
    }),
  )
  // Google results fill this view only. Manual values remain in the original trip.
  const preview = {
    ...trip,
    days: trip.days.map((stops, index) =>
      index === day
        ? stops.map((stop) =>
            automatic.has(stop.id)
              ? { ...stop, transfer: automatic.get(stop.id) }
              : stop,
          )
        : stops,
    ),
  }
  const legs = dayTransferLegs(preview, day),
    [error, setError] = useState('')
  const [dwellDrafts, setDwellDrafts] = useState<Record<string, string>>({})
  const clearDwellDraft = (id: string) =>
    setDwellDrafts((previous) => {
      const next = { ...previous }
      delete next[id]
      return next
    })
  return (
    <section
      className="day-transfers workspace-panel"
      aria-label="이동시간 확인"
    >
      <h3>이동시간 확인</h3>
      <p className="workspace-hint">
        Google Maps 이동시간 자동 계산 · 조회 시점 기준
      </p>
      {!routing.configured && (
        <p className="transfer-status" role="status">
          Google 지도 연결이 아직 설정되지 않았습니다. 직접 입력과 구글 길찾기는
          사용할 수 있어요.
        </p>
      )}
      {routing.configured && (
        <button className="button outline small" onClick={routing.retry}>
          이동시간 다시 계산
        </button>
      )}
      <p className="transfer-summary">
        이동시간 확인 {legs.filter((leg) => leg.transfer).length}/{legs.length}
        구간
      </p>
      {!legs.length && (
        <p>같은 날에 장소를 2곳 이상 추가하면 구간을 확인할 수 있어요.</p>
      )}
      {legs.map(
        ({
          previous,
          stop,
          transfer,
          arrival,
          lateMinutes,
          distance,
          stale,
        }) => (
          <article
            className="transfer-leg"
            data-transfer-id={stop.id}
            tabIndex={-1}
            key={`${previous.id}:${stop.id}`}
          >
            <h4>
              {stopDetails(previous).name} → {stopDetails(stop).name}
            </h4>
            <label className="field">
              이동수단
              <select
                aria-label={`${stopDetails(previous).name}에서 ${stopDetails(stop).name} 이동수단`}
                value={routing.modeFor(previous, stop)}
                onChange={(event) =>
                  routing.setMode(
                    previous,
                    stop,
                    event.target.value as TravelMode,
                  )
                }
              >
                {Object.entries(travelModes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {routing.stateFor(previous, stop)?.pending && (
              <p role="status">이동시간 계산 중…</p>
            )}
            {routing.stateFor(previous, stop)?.error && (
              <p className="transfer-status" role="status">
                {routing.stateFor(previous, stop)?.error}
              </p>
            )}
            {automatic.has(stop.id) && (
              <p className="google-maps-attribution">
                <a
                  href="https://maps.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Maps
                </a>{' '}
                · {travelModes[routing.modeFor(previous, stop)]} · 자동 계산
              </p>
            )}
            {(routing.stateFor(previous, stop)?.value?.warnings || []).map(
              (warning) => (
                <p className="google-route-warning" key={warning}>
                  {warning}
                </p>
              ),
            )}
            <p>
              {distance === undefined
                ? '지도 위치 미확인'
                : `직선 ${distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}`}
            </p>
            <div className="transfer-map-links">
              {(['walking', 'transit', 'driving'] as const).map((mode) => (
                <a
                  className="button outline small"
                  key={mode}
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', origin: mapQuery(previous, trip), destination: mapQuery(stop, trip), travelmode: mode })}`}
                >
                  {mode === 'walking'
                    ? '도보 길찾기'
                    : mode === 'transit'
                      ? '대중교통 길찾기'
                      : '차량 길찾기'}
                </a>
              ))}
            </div>
            {transfer?.checkedAt && (
              <small>
                {automatic.has(stop.id) ? 'Google 조회' : '이동시간 기록'} ·{' '}
                {new Date(transfer.checkedAt).toLocaleString('ko-KR')}
              </small>
            )}
            {stale && (
              <p className="transfer-status">
                순서나 장소가 바뀌었어요. 이동시간을 다시 확인하세요.
              </p>
            )}
            <label className="field">
              이동시간 · 분
              <input
                type="number"
                min={0}
                max={1440}
                step={1}
                inputMode="numeric"
                aria-label={`${stopDetails(previous).name}에서 ${stopDetails(stop).name} 이동시간`}
                value={transfer?.minutes ?? ''}
                placeholder={
                  routing.configured ? '자동 계산 대기' : '직접 입력'
                }
                onChange={(event) => {
                  const raw = event.target.value,
                    minutes = Number(raw)
                  if (
                    raw !== '' &&
                    (!Number.isInteger(minutes) ||
                      minutes < 0 ||
                      minutes > 1440)
                  )
                    return setError('이동시간은 0~1440분의 정수로 입력하세요.')
                  setError('')
                  onUpdate({
                    ...trip,
                    days: trip.days.map((items, index) =>
                      index !== day
                        ? items
                        : items.map((item) =>
                            item.id !== stop.id
                              ? item
                              : {
                                  ...item,
                                  transfer:
                                    raw === ''
                                      ? undefined
                                      : {
                                          fromStopId: previous.id,
                                          fromPlace: placeSignature(previous),
                                          toPlace: placeSignature(stop),
                                          minutes,
                                          checkedAt: new Date().toISOString(),
                                        },
                                },
                          ),
                    ),
                  })
                }}
              />
            </label>
            <label className="field">
              앞 장소 체류 · 분
              <input
                type="number"
                min={5}
                max={1440}
                step={1}
                aria-label={`${stopDetails(previous).name} 체류 시간`}
                value={
                  dwellDrafts[previous.id] ?? previous.durationMinutes ?? ''
                }
                placeholder="직접 입력"
                onBlur={() => clearDwellDraft(previous.id)}
                onChange={(event) => {
                  const raw = event.target.value,
                    minutes = Number(raw)
                  setDwellDrafts((drafts) => ({
                    ...drafts,
                    [previous.id]: raw,
                  }))
                  if (
                    raw !== '' &&
                    (!Number.isInteger(minutes) ||
                      minutes < 5 ||
                      minutes > 1440)
                  )
                    return setError('체류시간은 5~1440분의 정수만 저장됩니다.')
                  setError('')
                  clearDwellDraft(previous.id)
                  onUpdate({
                    ...trip,
                    days: trip.days.map((items, index) =>
                      index !== day
                        ? items
                        : items.map((item) =>
                            item.id === previous.id
                              ? {
                                  ...item,
                                  durationMinutes:
                                    raw === '' ? undefined : minutes,
                                }
                              : item,
                          ),
                    ),
                  })
                }}
              />
            </label>
            {transfer === undefined ? (
              <p className="transfer-status">이동시간 미입력</p>
            ) : arrival === undefined ? (
              <p className="transfer-status">
                앞 장소의 체류시간을 입력하면 도착 시각을 확인할 수 있어요.
              </p>
            ) : (
              <p
                className={lateMinutes ? 'transfer-warning' : 'transfer-result'}
                role={lateMinutes ? 'alert' : undefined}
              >
                {automatic.has(stop.id) ? 'Google 계산 기준' : '입력 기준'} 도착{' '}
                {arrivalText(arrival)} · 다음 예정 {stop.time}
                {lateMinutes ? ` · ${lateMinutes}분 부족` : ' · 시간 내 도착'}
              </p>
            )}
          </article>
        ),
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
