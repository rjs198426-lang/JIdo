import raw from './practical-guides.json' with { type: 'json' }
export const practicalGuides = raw
export type PracticalGuide = (typeof raw)[number]
export type GuideCourse = PracticalGuide['courses'][number]
export type CourseSelection = GuideCourse & { cityId: string }
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
