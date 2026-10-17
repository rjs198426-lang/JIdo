import raw from './practical-guides.json' with { type: 'json' }
import plans from './guide-plans.json' with { type: 'json' }
export const practicalGuides = raw
export type PracticalGuide = (typeof raw)[number]
export type GuideCourse = PracticalGuide['courses'][number]
export type CourseSelection = GuideCourse & {
  cityId: string
  days?: GuideCourse[]
}
export const guidePlanDurations = [3, 4, 5] as const
export type GuidePlanDuration = (typeof guidePlanDurations)[number]
export function courseDays(course: CourseSelection): GuideCourse[] {
  return course.days ?? [course]
}
export function getGuidePlan(
  cityId: string,
  duration: GuidePlanDuration,
): CourseSelection | undefined {
  const plan = plans.find((item) => item.cityId === cityId)
  if (!plan) return undefined
  const order = plan.dayOrder?.[String(duration) as '3' | '4' | '5']
  const days = order
    ? order.map((index) => plan.days[index])
    : plan.days.slice(0, duration)
  return {
    id: `${cityId}-plan-${duration}`,
    cityId,
    title: `${duration}일 추천 일정`,
    pace: `${duration}일 · 날짜별 지역 코스`,
    why: '가까운 장소를 날짜별로 묶은 자유여행 일정입니다.',
    placeIds: days.flatMap((day) => day.placeIds),
    days,
  }
}
export const practicalGuideById = new Map(
  raw.map((guide) => [guide.cityId, guide]),
)
export function findGuideCourse(
  cityId: string,
  courseId: string,
): CourseSelection | undefined {
  const course = practicalGuideById
    .get(cityId)
    ?.courses.find((item) => item.id === courseId)
  return course ? { ...course, cityId } : undefined
}
