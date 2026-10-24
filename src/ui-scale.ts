// DOM rectangles include the requested whole-app zoom; CSS insets use layout px.
export function layoutHeight(element: HTMLElement) {
  const root = document.getElementById('root')
  const zoom = root ? Number.parseFloat(getComputedStyle(root).zoom) : 1
  return (
    element.getBoundingClientRect().height /
    (Number.isFinite(zoom) && zoom > 0 ? zoom : 1)
  )
}
