import { db } from './config'
import { doc, getDoc, setDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { toDate } from '../utils/fechas'
import { getSesionesConResumen } from './sesiones'

// Agregado global por usuario (doc único usuarios/{uid}/stats/global):
// - diasEntrenados: [epoch del día 00:00 local] → calendario, rachas, frecuencia
// - volumenPorSesion: [{sesionId, fecha(ms), volumen, diaNombre}] → tab Volumen
// Reemplaza la descarga completa del historial con 1 lectura. Las fechas se
// guardan como epoch millis; toDate() las convierte donde haga falta.

const MAX_VOLUMEN = 200

const statsRef = (uid) => doc(db, 'usuarios', uid, 'stats', 'global')

export function epochDia(fecha) {
  const d = toDate(fecha)
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

// Construye el agregado desde las sesiones completadas (fallback y reparación).
export function buildResumenGlobal(sesiones) {
  const dias = new Set()
  const volumen = []
  for (const s of sesiones) {
    const e = epochDia(s.fecha)
    if (e !== null) dias.add(e)
    if (s.resumen?.volumenTotal > 0) {
      volumen.push({
        sesionId: s.id,
        fecha: toDate(s.fecha)?.getTime() ?? 0,
        volumen: s.resumen.volumenTotal,
        diaNombre: s.resumen?.diaNombre ?? '',
      })
    }
  }
  return {
    diasEntrenados: [...dias].sort((a, b) => a - b),
    volumenPorSesion: volumen.sort((a, b) => a.fecha - b.fecha).slice(-MAX_VOLUMEN),
  }
}

export async function getResumenGlobal(uid) {
  const snap = await getDoc(statsRef(uid))
  return snap.exists() ? snap.data() : null
}

// Self-healing: si el agregado no existe todavía (usuario pre-migración),
// lo construye desde el historial completo y lo persiste.
export async function getResumenGlobalConFallback(uid) {
  const existente = await getResumenGlobal(uid)
  if (existente) return existente
  const sesiones = await getSesionesConResumen(uid)
  const construido = buildResumenGlobal(sesiones)
  if (sesiones.length > 0) await setDoc(statsRef(uid), construido)
  return construido
}

// Upsert idempotente por sesionId: sirve tanto al completar la sesión como al
// re-editar sus series (reemplaza la entrada de volumen).
export async function aplicarSesionAResumenGlobal(uid, { sesionId, fecha, resumen }) {
  const actual = (await getResumenGlobal(uid)) ?? { diasEntrenados: [], volumenPorSesion: [] }
  const e = epochDia(fecha)
  const dias = new Set(actual.diasEntrenados)
  if (e !== null) dias.add(e)

  const volumen = actual.volumenPorSesion.filter(v => v.sesionId !== sesionId)
  if (resumen?.volumenTotal > 0) {
    volumen.push({
      sesionId,
      fecha: toDate(fecha)?.getTime() ?? 0,
      volumen: resumen.volumenTotal,
      diaNombre: resumen?.diaNombre ?? '',
    })
  }

  await setDoc(statsRef(uid), {
    diasEntrenados: [...dias].sort((a, b) => a - b),
    volumenPorSesion: volumen.sort((a, b) => a.fecha - b.fecha).slice(-MAX_VOLUMEN),
  })
}

export async function removerSesionDeResumenGlobal(uid, { sesionId, fecha }) {
  const actual = await getResumenGlobal(uid)
  if (!actual) return

  const volumen = actual.volumenPorSesion.filter(v => v.sesionId !== sesionId)
  let dias = actual.diasEntrenados

  const e = epochDia(fecha)
  if (e !== null) {
    // El día se quita solo si no queda ninguna otra sesión completada ese día.
    const inicio = new Date(e)
    const fin = new Date(e + 86400000)
    const snap = await getDocs(query(
      collection(db, 'sesiones'),
      where('usuarioId', '==', uid),
      where('completada', '==', true),
      where('fecha', '>=', inicio),
      where('fecha', '<', fin),
      orderBy('fecha', 'desc'),
    ))
    const quedanOtras = snap.docs.some(d => d.id !== sesionId)
    if (!quedanOtras) dias = dias.filter(d => d !== e)
  }

  await setDoc(statsRef(uid), { diasEntrenados: dias, volumenPorSesion: volumen })
}
