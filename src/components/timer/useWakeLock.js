import { useRef, useCallback, useEffect } from 'react'

export function useWakeLock() {
  const wakeLockRef = useRef(null)
  const audioRef = useRef(null)
  const activoRef = useRef(false) // true mientras el caller quiere la pantalla encendida

  const activar = useCallback(async () => {
    activoRef.current = true

    // Strategy 1: WakeLock API (Chrome/Android)
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        return
      } catch { /* sin soporte o permiso denegado: cae a la estrategia 2 */ }
    }

    // Strategy 2: silent audio loop for iOS/Safari
    // Must be called from a user-interaction event
    if (!audioRef.current) {
      const audio = new Audio('/silence.mp3')
      audio.loop = true
      audio.volume = 0
      audioRef.current = audio
    }
    try {
      await audioRef.current.play()
    } catch { /* autoplay bloqueado: no hay fallback posible */ }
  }, [])

  const liberar = useCallback(() => {
    activoRef.current = false
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }, [])

  // La Wake Lock API se libera sola cuando la página pasa a hidden y no se
  // reactiva sola al volver: sin esto, la pantalla se apaga sola después del
  // primer cambio de app durante el timer.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && activoRef.current) activar()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [activar])

  // Si el componente que llamó a activar() se desmonta sin llamar a liberar()
  // (ej. el usuario navega con la BottomNav a mitad del timer), el wake lock
  // y el audio de respaldo quedan vivos indefinidamente. liberar() es
  // idempotente, así que no importa si el caller ya lo había llamado.
  useEffect(() => liberar, [liberar])

  return { activar, liberar }
}
