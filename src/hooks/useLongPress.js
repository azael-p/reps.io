import { useEffect, useRef } from 'react'

const LONG_PRESS_DELAY_MS = 500
const LONG_PRESS_INTERVAL_MS = 150

export function useLongPress(onStep, { delay = LONG_PRESS_DELAY_MS, interval = LONG_PRESS_INTERVAL_MS } = {}) {
  const timeoutRef = useRef(null)
  const intervalRef = useRef(null)
  const activePointerIdRef = useRef(null)
  const viaPointerRef = useRef(false)
  const onStepRef = useRef(onStep)
  useEffect(() => { onStepRef.current = onStep })

  function limpiar() {
    clearTimeout(timeoutRef.current)
    clearInterval(intervalRef.current)
    timeoutRef.current = null
    intervalRef.current = null
    activePointerIdRef.current = null
  }

  useEffect(() => {
    document.addEventListener('visibilitychange', limpiar)
    return () => {
      document.removeEventListener('visibilitychange', limpiar)
      limpiar()
    }
  }, [])

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return
    if (activePointerIdRef.current !== null) return
    activePointerIdRef.current = e.pointerId
    viaPointerRef.current = true
    onStepRef.current()
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => onStepRef.current(), interval)
    }, delay)
  }

  function onPointerEnd(e) {
    if (activePointerIdRef.current !== e.pointerId) return
    limpiar()
  }

  function onClick() {
    if (viaPointerRef.current) {
      viaPointerRef.current = false
      return
    }
    onStepRef.current()
  }

  return {
    onPointerDown,
    onPointerUp: onPointerEnd,
    onPointerLeave: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onClick,
    onContextMenu: e => e.preventDefault(),
  }
}
