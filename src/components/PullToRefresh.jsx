import { useRef, useState, useEffect } from 'react'
import { motion } from 'motion/react'

const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const wrapRef = useRef(null)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)

  useEffect(() => { refreshingRef.current = refreshing }, [refreshing])
  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !isTouch) return

    let startY = 0
    let active = false
    let currentOffset = 0

    function onTouchStart(e) {
      if (refreshingRef.current) return
      if (window.scrollY > 0) return
      startY = e.touches[0].clientY
      active = true
      currentOffset = 0
    }

    function onTouchMove(e) {
      if (!active || refreshingRef.current) return
      if (window.scrollY > 0) { active = false; return }
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) { active = false; return }
      e.preventDefault()
      const offset = Math.min(dy * 0.5, 80)
      currentOffset = offset
      setPullY(offset)
      setIsPulling(offset > 10)
    }

    async function onTouchEnd() {
      if (!active) return
      active = false
      if (currentOffset > 50) {
        setRefreshing(true)
        setPullY(0)
        setIsPulling(false)
        try {
          await onRefreshRef.current()
        } finally {
          setRefreshing(false)
        }
      } else {
        setPullY(0)
        setIsPulling(false)
      }
      currentOffset = 0
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    el.addEventListener('touchcancel',onTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchmove',   onTouchMove)
      el.removeEventListener('touchend',    onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  return (
    <div style={{ position: 'relative', overflow: isPulling || refreshing ? 'hidden' : 'visible' }}>
      <motion.div
        className="pull-indicator"
        animate={{ y: refreshing ? 0 : pullY - 44 }}
        transition={refreshing
          ? { type: 'spring', stiffness: 200, damping: 20 }
          : { type: 'spring', stiffness: 300, damping: 28 }}
      >
        <motion.span
          className={`pull-icon ${refreshing ? 'spinner' : ''}`}
          style={{ color: pullY >= 50 ? 'var(--green)' : 'var(--orange)' }}
          animate={!refreshing ? { rotate: pullY >= 50 ? 180 : 0 } : {}}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          {refreshing ? '' : '↓'}
        </motion.span>
      </motion.div>
      <div
        ref={wrapRef}
        style={{
          transform: (refreshing || pullY > 0) ? `translateY(${refreshing ? 44 : pullY}px)` : undefined,
          transition: isPulling ? 'none' : 'transform .3s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
