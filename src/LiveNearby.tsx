import { LocateFixed } from 'lucide-react'
import { useContext } from 'react'
import {
destinationProgress,
displayDistance
} from './live-location'
import { PlaceLibraryContext } from './PlaceLibraryContext'
import { routePoints } from './route-map-model'
import type { Stop } from './travel-model'
import { stopDetails } from './travel-model'
import { useLiveLocation } from './use-live-location'
export default function LiveNearby({
  next,
  onOpen,
}: {
  next?: Stop
  onOpen: (id: string) => void
}) {
  const library = useContext(PlaceLibraryContext)
  const location = useLiveLocation(),
    position = location.position
  const target = next ? routePoints([next])[0] : undefined
  const progress =
    position && target
      ? destinationProgress(position, location.previous, target, location.now)
      : undefined
  return (
    <section className="live-nearby" aria-label="현재 위치와 주변 장소">
      <div className="detail-section-heading">
        <h3>
          <LocateFixed size={19} />
          이동 확인
        </h3>
        <button
          className="button outline small"
          aria-pressed={location.running}
          onClick={() =>
            location.running ? location.stop() : void location.start()
          }
        >
          {location.running ? '위치 끄기' : '현재 위치 켜기'}
        </button>
      </div>
      {!location.running && !position && (
        <p>
          위치를 켜면 다음 일정 장소까지의 직선 거리와 이동 방향을 확인할 수
          있어요.
        </p>
      )}
      {location.message && (
        <p role="status">
          {location.message}{' '}
          {location.running && (
            <button
              className="text-button"
              onClick={() => void location.start()}
            >
              다시 확인
            </button>
          )}
        </p>
      )}
      {location.stale && (
        <p role="status">위치가 오래됐어요. 최신 위치를 확인하고 있어요.</p>
      )}
      {position && !location.stale && !location.message && (
        <>
          <small className="location-accuracy">
            위치 오차 약 {Math.ceil(position.accuracy)}m · 화면을 보는 동안만
            확인
          </small>
          {progress && next ? (
            <div className="location-progress" aria-label="다음 장소 이동 상황">
              <span>{stopDetails(next).name}</span>
              <strong>
                직선 {displayDistance(progress.distance)} · {progress.direction}
              </strong>
              <p>{progress.movement}</p>
              <small>도로 경로와 이동시간은 길찾기에서 확인하세요.</small>
            </div>
          ) : (
            next && (
              <p>
                다음 장소에 저장된 위치가 없어 이동 방향을 확인할 수 없어요.
              </p>
            )
          )}
        </>
      )}
      <details className="location-privacy">
        <summary>위치 사용 안내</summary>
        <p>
          위치는 이 화면의 메모리에서만 사용하고 여행 기록·백업에 저장하거나
          J★Do 서버에 보내지 않아요. 앱을 나가거나 화면을 끄면 위치 확인을
          멈춥니다. 외부 지도 링크를 누르면 선택한 지도 서비스에 좌표가
          전달됩니다.
        </p>
      </details>
    </section>
  )
}
