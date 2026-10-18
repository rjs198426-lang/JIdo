import { stopDetails, type Trip } from './travel-model'
import { activeDayStops } from './transfer-planning'
import {
  travelModes,
  type GoogleRouting,
  type TravelMode,
} from './google-routes'

function routeStatus(configured: boolean, error?: string) {
  if (!configured) return '연결 필요'
  if (!error) return '계산 중…'
  if (error.includes('위치')) return '위치 필요'
  if (error.includes('인터넷')) return '연결 필요'
  if (error.includes('경로')) return '경로 없음'
  if (error.includes('지연')) return '계산 지연'
  return '계산 실패'
}

export default function DayTransfers({
  trip,
  day,
  routing,
}: {
  trip: Trip
  day: number
  routing: GoogleRouting
}) {
  const stops = activeDayStops(trip, day)
  const legs = stops.slice(1).map((stop, index) => ({
    previous: stops[index],
    stop,
    state: routing.stateFor(stops[index], stop),
  }))
  return (
    <section
      className="day-transfers workspace-panel"
      aria-label="이동시간 확인"
    >
      <h3>이동시간</h3>
      {!legs.length && <p>장소를 2곳 이상 추가해 주세요.</p>}
      {legs.map(({ previous, stop, state }) => {
        const name = `${stopDetails(previous).name}에서 ${stopDetails(stop).name}`
        const value = state?.value
        return (
          <article
            className="transfer-leg"
            data-transfer-id={stop.id}
            tabIndex={-1}
            key={`${previous.id}:${stop.id}`}
          >
            <h4>
              {stopDetails(previous).name} → {stopDetails(stop).name}
            </h4>
            <div className="transfer-calculation">
              <label className="field">
                이동수단
                <select
                  aria-label={`${name} 이동수단`}
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
              <output
                className={`transfer-duration ${value ? '' : 'transfer-status'}`}
                aria-label={`${name} 이동시간`}
                aria-live="polite"
                aria-busy={
                  state?.pending ||
                  (!state?.error && !value && routing.configured)
                }
              >
                {value
                  ? `${value.minutes}분`
                  : routeStatus(routing.configured, state?.error)}
              </output>
            </div>
            {state?.error && (
              <button className="button outline small" onClick={routing.retry}>
                다시 계산
              </button>
            )}
            {!!value?.warnings.length && (
              <details className="transfer-route-notices">
                <summary>경로 안내</summary>
                {value.warnings.map((warning) => (
                  <p className="google-route-warning" key={warning}>
                    {warning}
                  </p>
                ))}
              </details>
            )}
          </article>
        )
      })}
      {legs.some(({ state }) => state?.value) && (
        <p className="google-maps-attribution">
          <a
            href="https://maps.google.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Maps
          </a>
        </p>
      )}
    </section>
  )
}
