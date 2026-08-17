import { db } from './config'
import { writeBatch } from 'firebase/firestore'
import { eliminarSesion } from './sesiones'
import { removerSesionDeResumenGlobal } from './statsGlobal'
import { rebuildStatsEjercicios } from './statsEjercicios'

// Une en un solo writeBatch: el borrado de la sesión + sus registros, el
// agregado global y los stats por ejercicio. O se aplican las 3 colecciones
// o ninguna (mismo patrón que completarSesionConAgregados para el bug
// análogo de completar sesión).
//
// `rebuildStatsEjercicios` recibe `excluirSesionId` porque su lectura del
// historial (`getSesionesConResumen`) no ve el `batch.delete` de la sesión
// hasta que se comitee: sin la exclusión explícita, reconstruiría los stats
// incluyendo la sesión que se está borrando.
export async function eliminarSesionConAgregados(sesionId, { usuarioId, fecha, ejercicios }) {
  const batch = writeBatch(db)
  await eliminarSesion(sesionId, batch)
  if (usuarioId) {
    await removerSesionDeResumenGlobal(usuarioId, { sesionId, fecha }, batch)
    await rebuildStatsEjercicios(usuarioId, ejercicios ?? [], batch, { excluirSesionId: sesionId })
  }
  return batch.commit()
}
