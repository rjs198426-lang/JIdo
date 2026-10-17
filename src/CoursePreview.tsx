import { getPlace } from './catalog'
import { courseDays, type CourseSelection } from './practical-guides'
import type { Stop } from './travel-model'

export default function CoursePreview({
  course,
  existingDays,
}: {
  course: CourseSelection
  existingDays?: Stop[][]
}) {
  const days = courseDays(course)
  return (
    <div className="course-preview-days">
      {days.map((day, index) => (
        <section key={day.id} className="course-preview-day">
          {days.length > 1 && (
            <h4>
              DAY {index + 1} · {day.title}
            </h4>
          )}
          <ol>
            {day.placeIds.map((id) => (
              <li key={id}>
                {getPlace(id)?.name}
                {existingDays?.[index]?.some(
                  (stop) =>
                    (stop.custom?.catalogPlaceId || stop.placeId) === id,
                ) && <small> · 이날 이미 포함</small>}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
