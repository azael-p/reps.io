import { db } from './config'
import { writeBatch } from 'firebase/firestore'
import { completarSesion } from './sesiones'
import { agregarSesionAResumenGlobalBlind } from './statsGlobal'
import { aplicarSesionAStats } from './statsEjercicios'

// Une en un solo writeBatch: la sesión (completada + resumen), el agregado
// global (arrayUnion, sin lectura previa) y los stats por ejercicio.
// Atómico en el cache local: o se aplican las 3 colecciones o ninguna. El
// caller NO debe await-ear el resultado para destrabar la UI — Firestore ya
// aplicó las escrituras al cache local al construir el batch; el commit()
// solo resuelve cuando llega el ACK del servidor, que puede tardar
// indefinidamente sin red.
export async function completarSesionConAgregados(sesionId, { usuarioId, fecha, resumen }) {
  const batch = writeBatch(db)
  completarSesion(sesionId, resumen, batch)
  if (usuarioId) {
    agregarSesionAResumenGlobalBlind(batch, usuarioId, { sesionId, fecha, resumen })
    // Solo lecturas (getDoc) antes de este punto — resuelven del cache local
    // incluso sin red, no se cuelgan.
    await aplicarSesionAStats(usuarioId, { sesionId, fecha, resumen }, batch)
  }
  return batch.commit()
}
