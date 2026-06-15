const GAP = 6
const VIEWPORT_PADDING = 8

export type PopoverPosition = { top: number; left: number }

export function computePopoverPosition(
  anchorRect: DOMRect,
  popWidth: number,
  popHeight: number,
): PopoverPosition {
  let left = anchorRect.left
  const maxLeft = window.innerWidth - popWidth - VIEWPORT_PADDING
  if (left > maxLeft) left = Math.max(VIEWPORT_PADDING, maxLeft)
  if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING

  const spaceBelow = window.innerHeight - anchorRect.bottom - GAP - VIEWPORT_PADDING
  const spaceAbove = anchorRect.top - GAP - VIEWPORT_PADDING

  let top: number
  if (popHeight <= spaceBelow) {
    top = anchorRect.bottom + GAP
  } else if (popHeight <= spaceAbove) {
    top = anchorRect.top - popHeight - GAP
  } else if (spaceAbove >= spaceBelow) {
    top = VIEWPORT_PADDING
  } else {
    top = Math.max(VIEWPORT_PADDING, window.innerHeight - popHeight - VIEWPORT_PADDING)
  }

  const maxTop = window.innerHeight - popHeight - VIEWPORT_PADDING
  top = Math.max(VIEWPORT_PADDING, Math.min(top, maxTop))

  return { top, left }
}

export { GAP, VIEWPORT_PADDING }
