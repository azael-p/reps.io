import { useState, useEffect } from 'react'

const MQ = typeof window !== 'undefined'
  ? window.matchMedia('(min-width: 1024px)')
  : null

export function useDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => MQ?.matches ?? false)

  useEffect(() => {
    if (!MQ) return
    const handler = (e) => setIsDesktop(e.matches)
    MQ.addEventListener('change', handler)
    return () => MQ.removeEventListener('change', handler)
  }, [])

  return isDesktop
}
