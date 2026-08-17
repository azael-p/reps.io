import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from './Toast'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 60 minutos

export default function UpdateBanner() {
  const intervalIdRef = useRef(null)
  const { show, dismiss } = useToast()

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return
      intervalIdRef.current = setInterval(() => {
        registration.update()
      }, CHECK_INTERVAL_MS)
    },
  })

  useEffect(() => {
    if (!needRefresh) return
    const id = show({
      message: 'Hay una actualización disponible.',
      variant: 'info',
      duration: 0,
      action: { label: 'Actualizar', onClick: () => updateServiceWorker(true) },
    })
    return () => dismiss(id)
  }, [needRefresh, updateServiceWorker, show, dismiss])

  useEffect(() => {
    return () => {
      if (intervalIdRef.current) clearInterval(intervalIdRef.current)
    }
  }, [])

  return null
}
