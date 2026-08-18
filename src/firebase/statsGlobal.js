import { db } from './config'
import { doc, getDoc, setDoc, arrayUnion, writeBatch, serverTimestamp, collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { toDate } from '../utils/fechas'
import { getSesionesConResumen } from './sesiones'

// Agregado global por usuario (doc único usuarios/{uid}/stats/global):
// - diasEntrenados: [epoch del día 00:00 local] → calendario, rachas, frecuencia
// - volumenPorSesion: [{sesionId, fecha(ms), volumen, diaNombre}] → tab Volumen
// Reemplaza la descarga completa del historial con 1 lectura. Las fechas se
// guardan como epoch millis; toDate() las convierte donde haga falta.

const MAX_VOLUMEN = 200
// Margen sobre MAX_VOLUMEN para no reescribir el doc en cada lectura una vez
// pasado el cap: se compacta a 200 recién al llegar a 250, así hacen falta
// otras 50 sesiones para la próxima.
const UMBRAL_COMPACTACION = 250

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
    // `sesiones` viene ordenada desc por fecha (getSesionesConResumen).
    ultimoDiaId: sesiones[0]?.diaId ?? null,
  }
}

export async function getResumenGlobal(uid) {
  const snap = await getDoc(statsRef(uid))
  return snap.exists() ? snap.data() : null
}

// Deja volumenPorSesion en <= MAX_VOLUMEN entradas: dedupea por sesionId
// (quedándose con la última) y ordena por fecha. El camino de alta escribe
// con arrayUnion (ver bug #3), que no puede cappear ni ordenar al escribir,
// así que el array crece sin techo; esto lo recorta cada tanto.
export function compactarVolumen(volumenPorSesion) {
  const porSesion = new Map()
  for (const v of volumenPorSesion ?? []) porSesion.set(v.sesionId, v)
  return [...porSesion.values()]
    .sort((a, b) => a.fecha - b.fecha)
    .slice(-MAX_VOLUMEN)
}

// Self-healing: si el agregado no existe todavía (usuario pre-migración),
// lo construye desde el historial completo y lo persiste. De paso compacta
// volumenPorSesion si creció por encima del umbral.
export async function getResumenGlobalConFallback(uid) {
  const snap = await getDoc(statsRef(uid))

  if (snap.exists()) {
    const data = snap.data()
    // El tamaño se chequea primero (discriminador barato, falso en el caso
    // normal). Solo se compacta con una lectura confirmada por el servidor:
    // sobre un doc servido del cache podría haber entradas escritas desde
    // otro dispositivo que este cliente todavía no vio, y recortar sobre esa
    // base las borraría (mismo riesgo que motivó el bug #3).
    if ((data.volumenPorSesion?.length ?? 0) > UMBRAL_COMPACTACION && !snap.metadata.fromCache) {
      const volumenPorSesion = compactarVolumen(data.volumenPorSesion)
      // Fire-and-forget: es mantenimiento, no debe demorar el render (bug #1).
      setDoc(statsRef(uid), { volumenPorSesion }, { merge: true }).catch(e => console.error(e))
      return { ...data, volumenPorSesion }
    }
    return data
  }

  const sesiones = await getSesionesConResumen(uid)
  const construido = buildResumenGlobal(sesiones)
  if (sesiones.length > 0) await setDoc(statsRef(uid), construido)
  return construido
}

// Alta ciega para sesión nueva completada: no lee el doc antes de escribir,
// así que no puede pisar historial por una lectura de cache vacío/purgado
// (ver aplicarSesionAResumenGlobal más abajo, que sí necesita leer para
// poder REEMPLAZAR una entrada existente por sesionId). arrayUnion dedupea
// por igualdad exacta de valor — sirve para altas, no para ediciones.
export function agregarSesionAResumenGlobalBlind(batch, uid, { sesionId, fecha, resumen, diaId }) {
  const e = epochDia(fecha)
  const campos = { ultimaSesionId: sesionId, actualizadoEn: serverTimestamp() }
  if (diaId) campos.ultimoDiaId = diaId
  if (e !== null) campos.diasEntrenados = arrayUnion(e)
  if (resumen?.volumenTotal > 0) {
    campos.volumenPorSesion = arrayUnion({
      sesionId,
      fecha: toDate(fecha)?.getTime() ?? 0,
      volumen: resumen.volumenTotal,
      diaNombre: resumen?.diaNombre ?? '',
    })
  }
  batch.set(statsRef(uid), campos, { merge: true })
}

// Upsert idempotente por sesionId: usado al re-editar series de una sesión
// ya completada (reemplaza la entrada de volumen existente, algo que
// arrayUnion no puede hacer). Necesita leer el doc actual.
export async function aplicarSesionAResumenGlobal(uid, { sesionId, fecha, resumen }) {
  const snap = await getDoc(statsRef(uid))
  // Doc "no existe" según una lectura servida desde el cache (sin red) no es
  // señal confiable de que no haya historial real (celular nuevo, cache
  // purgado, primer arranque sin pasar por una pantalla que lo cachee). Para
  // no arriesgar pisar meses de historial con un setDoc de reemplazo total,
  // hacemos alta ciega (arrayUnion) en vez de asumir que el historial está
  // vacío.
  if (!snap.exists() && snap.metadata.fromCache) {
    const batch = writeBatch(db)
    agregarSesionAResumenGlobalBlind(batch, uid, { sesionId, fecha, resumen })
    await batch.commit()
    return
  }

  const actual = snap.exists() ? snap.data() : { diasEntrenados: [], volumenPorSesion: [] }
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
  }, { merge: true })
}

export async function removerSesionDeResumenGlobal(uid, { sesionId, fecha }, batch = null) {
  const actual = await getResumenGlobal(uid)
  if (!actual) return

  const volumen = actual.volumenPorSesion.filter(v => v.sesionId !== sesionId)
  let dias = actual.diasEntrenados

  const e = epochDia(fecha)
  if (e !== null) {
    // El día se quita solo si no queda ninguna otra sesión completada ese día.
    // Filtra por id explícitamente, así que da igual si esta lectura corre
    // antes o después de que se borre `sesionId` (ej. dentro de un batch
    // compartido que todavía no comiteó).
    const inicio = new Date(e)
    // Reconstruido por componentes, no sumando 24h en millis: en una
    // transición de DST el día local dura 23 o 25 h.
    const fin = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1)
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

  const update = { diasEntrenados: dias, volumenPorSesion: volumen }
  if (batch) { batch.set(statsRef(uid), update, { merge: true }); return }
  await setDoc(statsRef(uid), update, { merge: true })
}
