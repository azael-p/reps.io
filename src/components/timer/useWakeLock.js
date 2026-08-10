import { useRef, useCallback } from 'react'

export function useWakeLock() {
  const wakeLockRef = useRef(null)
  const audioRef = useRef(null)

  const activar = useCallback(async () => {
    // Strategy 1: WakeLock API (Chrome/Android)
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        return
      } catch (_) {}
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
    } catch (_) {}
  }, [])

  const liberar = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {})
      wakeLockRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }, [])

  return { activar, liberar }
}
