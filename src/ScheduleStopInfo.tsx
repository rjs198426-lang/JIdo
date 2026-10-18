import { FileText, Ticket, MessageSquare } from 'lucide-react'
import { scheduleFiles, scheduleStatus } from './schedule-list'
import { stopDetails, type Stop, type Trip } from './travel-model'
import type { JourneyTarget } from './trip-readiness'
export default function ScheduleStopInfo({
  trip,
  stop,
  day,
  onLocate,
}: {
  trip: Trip
  stop: Stop
  day: number
  onLocate: (target: JourneyTarget) => void
}) {
  const reservation = trip.reservations?.find(
    (item) => item.id === stop.reservationId,
  )
  const files = scheduleFiles(trip, stop)
  const status = scheduleStatus(trip, stop)
  const name = stopDetails(stop).name
  return (
    <div className="schedule-stop-info">
      <div className="schedule-stop-badges">
        <span className={`schedule-status ${status}`}>
          {status === 'done'
            ? '방문 완료'
            : status === 'excluded'
              ? reservation?.status === 'cancelled'
                ? '예약 취소'
                : '건너뜀'
              : '방문 예정'}
        </span>
        {reservation && (
          <button
            className="text-button schedule-reservation"
            aria-label={`${name} 연결 예약 열기`}
            onClick={() =>
              onLocate({
                workspace: 'reservations',
                day,
                reservationId: reservation.id,
              })
            }
          >
            <Ticket size={14} />
            {reservation.title}
          </button>
        )}
        {!!files.length && (
          <button
            className="text-button"
            aria-label={`${name} 자료 ${files.length}개 열기`}
            onClick={() =>
              onLocate({ workspace: 'files', day, attachmentId: files[0].id })
            }
          >
            <FileText size={14} />
            자료 {files.length}
          </button>
        )}
      </div>
      {stop.note.trim() && (
        <div className="schedule-note-preview">
          <MessageSquare size={14} />
          <p>{stop.note}</p>
        </div>
      )}
    </div>
  )
}
