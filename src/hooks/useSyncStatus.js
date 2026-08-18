import { useState, useEffect } from 'react'
import { escucharPendientesSesion } from '../firebase/registros'
import { useOnlineStatus } from './useOnlineStatus'

// Estado combinado para el punto de sincronización del header de la sesión
// activa: sin red gana siempre, sin importar cuántos registros haya
// pendientes (si no hay red, tampoco hay forma de confirmarlos ahora).
export function useSyncStatus(sesionId) {
  const online = useOnlineStatus()
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    if (!sesionId) return
    const unsubscribe = escucharPendientesSesion(sesionId, setPendientes)
    return unsubscribe
  }, [sesionId])

  const estado = !online ? 'offline' : pendientes > 0 ? 'pendiente' : 'online'
  return { estado, pendientes }
}
