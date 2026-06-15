import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEventHandler,
} from 'react'

/** Быстрый жест вниз (px/ms) — закрыть даже при небольшом смещении */
const VELOCITY_DISMISS_PX_PER_MS = 0.45

function dismissThresholdPx(): number {
  if (typeof window === 'undefined') return 120
  return Math.min(128, window.innerHeight * 0.2)
}

type UseBottomSheetDragOptions = {
  open: boolean
  onClose: () => void
}

/**
 * Смещение нижнего щита по Y и обработчики для ручки (pointer capture, жест закрытия).
 */
export function useBottomSheetDrag({ open, onClose }: UseBottomSheetDragOptions) {
  const [translateY, setTranslateY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const draggingRef = useRef(false)
  const dragStartClientY = useRef(0)
  const dragStartTranslate = useRef(0)
  const translateRef = useRef(0)
  const lastSample = useRef<{ y: number; t: number } | null>(null)
  const velocityY = useRef(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const setTranslate = useCallback((y: number) => {
    translateRef.current = y
    setTranslateY(y)
  }, [])

  useEffect(() => {
    if (!open) {
      draggingRef.current = false
      setIsDragging(false)
      setTranslate(0)
    }
  }, [open, setTranslate])

  const handlePointerDown: PointerEventHandler<HTMLElement> = useCallback(
    (e) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      draggingRef.current = true
      setIsDragging(true)
      dragStartClientY.current = e.clientY
      dragStartTranslate.current = translateRef.current
      lastSample.current = { y: e.clientY, t: performance.now() }
      velocityY.current = 0
    },
    [],
  )

  const handlePointerMove: PointerEventHandler<HTMLElement> = useCallback((e) => {
    if (!draggingRef.current) return
    const raw = e.clientY - dragStartClientY.current + dragStartTranslate.current
    setTranslate(Math.max(0, raw))
    const now = performance.now()
    const s = lastSample.current
    if (s) {
      const dt = now - s.t
      if (dt > 0) velocityY.current = (e.clientY - s.y) / dt
    }
    lastSample.current = { y: e.clientY, t: now }
  }, [setTranslate])

  const finishDrag = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    setIsDragging(false)
    const y = translateRef.current
    const threshold = dismissThresholdPx()
    const shouldClose = y > threshold || velocityY.current > VELOCITY_DISMISS_PX_PER_MS
    velocityY.current = 0
    lastSample.current = null
    if (shouldClose) {
      setTranslate(0)
      onCloseRef.current()
    } else {
      requestAnimationFrame(() => setTranslate(0))
    }
  }, [setTranslate])

  const handlePointerUp: PointerEventHandler<HTMLElement> = useCallback(() => {
    finishDrag()
  }, [finishDrag])

  const handlePointerCancel: PointerEventHandler<HTMLElement> = useCallback(() => {
    finishDrag()
  }, [finishDrag])

  const handleLostPointerCapture: PointerEventHandler<HTMLElement> = useCallback(() => {
    if (draggingRef.current) finishDrag()
  }, [finishDrag])

  const sheetStyle: CSSProperties = {
    transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
    willChange: isDragging || translateY > 0 ? 'transform' : undefined,
  }

  const handleBindings = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onLostPointerCapture: handleLostPointerCapture,
    style: { touchAction: 'none' } as const,
  }

  return { sheetStyle, handleBindings, isDragging, translateY }
}
