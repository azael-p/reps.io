import { useRef, useCallback } from 'react'

export default function SwipeToDelete({ onDelete, onClick, threshold = 60, children }) {
  const startX = useRef(0)
  const currentX = useRef(0)
  const isSwipe = useRef(false)
  const skipped = useRef(false)
  const wrapRef = useRef(null)

  const handlePointerDown = useCallback((e) => {
    if (document.body.classList.contains('dnd-active')) return
    if (e.pointerType === 'mouse' && e.button !== 0) { skipped.current = true; return }
    if (e.target.closest('[data-dnd-handle]')) { skipped.current = true; return }
    if (e.target.closest('[data-skip-swipe]')) { skipped.current = true; return }
    skipped.current = false
    startX.current = e.clientX
    currentX.current = 0
    isSwipe.current = false
    try { wrapRef.current?.setPointerCapture(e.pointerId) } catch { /* noop */ }
  }, [])

  const handlePointerMove = useCallback((e) => {
    if (skipped.current) return
    if (document.body.classList.contains('dnd-active')) return
    const dx = e.clientX - startX.current
    currentX.current = dx

    if (dx < -5) {
      isSwipe.current = true
    }

    if (isSwipe.current) {
      const offset = Math.max(-100, Math.min(0, dx))
      wrapRef.current.style.transform = `translateX(${offset}px)`
      wrapRef.current.style.transition = 'none'
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    if (skipped.current) { skipped.current = false; return }
    if (document.body.classList.contains('dnd-active')) {
      isSwipe.current = false
      currentX.current = 0
      if (wrapRef.current) {
        wrapRef.current.style.transform = ''
        wrapRef.current.style.transition = 'transform .25s cubic-bezier(.4,0,.2,1)'
      }
      return
    }

    if (isSwipe.current) {
      if (currentX.current < -threshold) {
        onDelete()
      }
      if (wrapRef.current) {
        wrapRef.current.style.transform = ''
        wrapRef.current.style.transition = 'transform .25s cubic-bezier(.4,0,.2,1)'
      }
    } else if (onClick) {
      onClick()
    }
    isSwipe.current = false
    currentX.current = 0
  }, [onDelete, onClick, threshold])

  return (
    <div className="swipe-wrap">
      <div className="swipe-bg">
        <span className="swipe-bg-txt">Eliminar</span>
      </div>
      <div
        ref={wrapRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDragStart={e => e.preventDefault()}
        className="swipe-item"
      >
        {children}
      </div>
    </div>
  )
}
