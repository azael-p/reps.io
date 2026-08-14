import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 60 minutos

export default function UpdateBanner() {
  const intervalIdRef = useRef(null)

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      intervalIdRef.current = setInterval(() => {
        registration.update()
      }, CHECK_INTERVAL_MS)
    },
  })

  useEffect(() => {
    if (needRefresh) updateServiceWorker(true)
  }, [needRefresh, updateServiceWorker])

  useEffect(() => {
    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current)
    }
  }, [])

  return null
}
