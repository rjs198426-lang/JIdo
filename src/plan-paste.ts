import { customPlaceKinds } from './place-categories'
import {
  destinationForDay,
  type Trip,
  type Stop,
  type CustomPlace,
  stopSchema,
} from './travel-model'

export type PlanLine = {
  line: number
  name: string
  time: string
  note: string
  kind: CustomPlace['kind']
  link: string
  error?: string
  duplicate: boolean
}
const normalized = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ')
export function parsePlanText(
  text: string,
  existing: string[] = [],
): PlanLine[] {
  const seen = new Set(existing.map(normalized))
  return text.split(/\r?\n/).flatMap((raw, line) => {
    let value = raw.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, '')
    if (!value) return []
    const timeMatch = value.match(/^(\d{1,2}:\d{2})\s+/)
    const time = timeMatch ? timeMatch[1].padStart(5, '0') : ''
    if (timeMatch) value = value.slice(timeMatch[0].length)
    let kind: CustomPlace['kind'] = '기타'
    const category = value.match(/^([^:：]+)[:：]\s*/)
    if (
      category &&
      customPlaceKinds.includes(category[1] as CustomPlace['kind'])
    ) {
      kind = category[1] as CustomPlace['kind']
      value = value.slice(category[0].length)
    }
    const [label, ...notes] = value.split('|')
    const markdown = label
      .trim()
      .match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    const name = (markdown?.[1] || label).trim(),
      note = notes.join('|').trim()
    let invalidLink = false
    if (markdown) {
      try {
        invalidLink =
          !new URL(markdown[2]).hostname || markdown[2].length > 1500
      } catch {
        invalidLink = true
      }
    }
    const error =
      !name || name.length > 160
        ? '장소 이름은 1~160자로 적어 주세요.'
        : time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
          ? '방문 시간을 확인해 주세요.'
          : invalidLink
            ? '지도 링크를 확인해 주세요.'
            : note.length > 2000
              ? '메모는 2,000자까지 적어 주세요.'
              : undefined
    const duplicate = seen.has(normalized(name))
    seen.add(normalized(name))
    return [
      {
        line,
        name,
        time,
        kind,
        note,
        link: markdown?.[2] || '',
        error,
        duplicate,
      },
    ]
  })
}
export function appendPlanLines(
  trip: Trip,
  day: number,
  lines: PlanLine[],
): Trip {
  if (
    !trip.days[day] ||
    !lines.length ||
    lines.length > 50 ||
    trip.days[day].length + lines.length > 200
  )
    throw new Error('한 번에 1~50개, 하루 최대 200개까지 담을 수 있어요.')
  if (lines.some((line) => line.error))
    throw new Error('표시된 입력을 확인해 주세요.')
  const destination = destinationForDay(trip, day)
  const additions: Stop[] = lines.map((line) => {
    const parsed = stopSchema.safeParse({
      id: crypto.randomUUID(),
      placeId: `custom-${crypto.randomUUID()}`,
      time: line.time,
      note: line.note,
      custom: {
        name: line.name,
        kind: line.kind,
        address: '',
        link: line.link,
        destinationId: destination.id,
      },
    })
    if (!parsed.success) throw new Error('장소 이름·시간·링크를 확인해 주세요.')
    return parsed.data
  })
  return {
    ...trip,
    days: trip.days.map((stops, index) =>
      index === day ? [...stops, ...additions] : stops,
    ),
  }
}
