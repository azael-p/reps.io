import { db } from './config'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { eliminarProgramaDefinitivo } from './programas'
import { eliminarDiaDefinitivo } from './dias'
import { eliminarEjercicioDefinitivo } from './ejerciciosDia'

// Margen sobre los 5s del undo del toast (ver useEliminarConUndo) — cubre
// reaperturas rápidas de la app y clock skew sin dejar basura acumulada.
const UMBRAL_MS = 10 * 60 * 1000

async function idsVencidos(coleccion, usuarioId) {
  const snap = await getDocs(query(
    collection(db, coleccion),
    where('usuarioId', '==', usuarioId),
    where('eliminadoEn', '>', 0),
  ))
  const corte = Date.now() - UMBRAL_MS
  return snap.docs.filter(d => d.data().eliminadoEn < corte).map(d => d.id)
}

// Barre programas/dias/ejerciciosDia soft-deleted cuyo timeout de undo
// (client-side, ver Toast.jsx) nunca corrió porque el usuario cerró la app
// antes de que expirara. Se llama al arrancar la app (ver UserContext).
export async function limpiarEliminadosDefinitivamente(usuarioId) {
  const [programasIds, diasIds, ejerciciosIds] = await Promise.all([
    idsVencidos('programas', usuarioId),
    idsVencidos('dias', usuarioId),
    idsVencidos('ejerciciosDia', usuarioId),
  ])

  await Promise.all([
    ...programasIds.map(id => eliminarProgramaDefinitivo(id)),
    ...diasIds.map(id => eliminarDiaDefinitivo(id)),
    ...ejerciciosIds.map(id => eliminarEjercicioDefinitivo(id)),
  ])
}
