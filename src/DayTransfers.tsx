import { useState } from 'react'
import { mapQuery, stopDetails, type Trip } from './travel-model'
import {
  arrivalText,
  placeSignature,
  dayTransferLegs,
} from './transfer-planning'
export default function DayTransfers({
  trip,
  day,
  onUpdate,
}: {
  trip: Trip
  day: number
  onUpdate: (trip: Trip) => void
}) {
  const legs = dayTransferLegs(trip, day),
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
      <p className="workspace-hint">직선 거리 · 이동시간은 직접 입력</p>
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
                이동시간 기록 ·{' '}
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
                placeholder="직접 입력"
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
                입력 기준 도착 {arrivalText(arrival)} · 다음 예정 {stop.time}
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
