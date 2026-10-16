import { useEffect, useRef, useState } from 'react'
type Frame = {
  workspace: string
  day: number
  scroll: number
  focus?: { attribute: string; id: string }
}
export function useJourneyNavigation(
  workspace: string,
  day: number,
  setWorkspace: (next: string) => void,
  setDay: (next: number) => void,
) {
  const history = useRef<Frame[]>([]),
    restore = useRef<Frame | null>(null)
  const [count, setCount] = useState(0)
  const go = (next: string, nextDay = day) => {
    if (next === workspace && nextDay === day) return
    const attributes = [
      'data-stop-id',
      'data-reservation-id',
      'data-transfer-id',
      'data-checklist-id',
      'data-attachment-id',
      'data-expense-id',
    ]
    const element = document.activeElement?.closest<HTMLElement>(
      attributes.map((name) => `[${name}]`).join(','),
    )
    const attribute = attributes.find((name) => element?.hasAttribute(name))
    history.current = [
      ...history.current,
      {
        workspace,
        day,
        scroll: window.scrollY,
        focus:
          element && attribute
            ? { attribute, id: element.getAttribute(attribute)! }
            : undefined,
      },
    ].slice(-30)
    setCount(history.current.length)
    setWorkspace(next)
    setDay(nextDay)
  }
  const back = () => {
    const frame = history.current.pop()
    if (!frame) return false
    restore.current = frame
    setCount(history.current.length)
    setWorkspace(frame.workspace)
    setDay(frame.day)
    return true
  }
  const backRef = useRef(back)
  backRef.current = back
  useEffect(() => {
    const handle = (event: Event) => {
      if (backRef.current()) event.preventDefault()
    }
    window.addEventListener('jido:trip-back', handle)
    return () => window.removeEventListener('jido:trip-back', handle)
  }, [])
  useEffect(() => {
    const frame = restore.current
    if (!frame || frame.workspace !== workspace || frame.day !== day) return
    restore.current = null
    const request = requestAnimationFrame(() => {
      if (frame.focus)
        Array.from(
          document.querySelectorAll<HTMLElement>(`[${frame.focus.attribute}]`),
        )
          .find(
            (item) =>
              item.getAttribute(frame.focus!.attribute) === frame.focus!.id,
          )
          ?.focus({ preventScroll: true })
      window.scrollTo({ top: frame.scroll, behavior: 'instant' })
    })
    return () => cancelAnimationFrame(request)
  }, [workspace, day])
  return { go, back, canGoBack: count > 0 }
}
