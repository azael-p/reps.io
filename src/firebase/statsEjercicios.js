import { db } from './config'
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { toDate } from '../utils/fechas'
import { calcular1RM } from '../utils/stats'
import { getSesionesConResumen, esMismoEjercicio } from './sesiones'

// Agregado por ejercicio (usuarios/{uid}/statsEjercicios/{docId}):
// - pr:        { maxPeso, fecha(ms), sesionId, series }   ← forma que espera la UI
// - prVolumen: { volumen, pesoUsado, repsHechas, fecha(ms), sesionId } ← mejor
//   serie por volumen (peso × reps), récord independiente del pr de arriba
// - ultimaVez: { fecha(ms), sesionId, series }
// - puntos:    [{ fecha(ms), sesionId, pesoMax, oneRm, volSerie }]  cap 150
//   (máximos POR SERIE de cada sesión — misma semántica que el gráfico previo)
// Reemplaza el recorrido del historial completo para "última vez"/PR
// (SesionActiva) y el gráfico de progresión (Progreso).

const MAX_PUNTOS = 150

const col = (uid) => collection(db, 'usuarios', uid, 'statsEjercicios')

// djb2 sobre el nombre exacto. El slug solo, al normalizar acentos y
// mayúsculas, es MENOS discriminante que esMismoEjercicio (que compara el
// nombre crudo): "Sentadilla búlgara" y "sentadilla bulgara" caían en el
// mismo doc siendo ejercicios distintos para el resto de la app. El hash
// restaura esa correspondencia sin perder la legibilidad del slug.
function hashNombre(nombre) {
  let h = 5381
  for (let i = 0; i < nombre.length; i++) h = ((h << 5) + h + nombre.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Misma semántica que esMismoEjercicio: catalogoId, o nombre para los custom.
export function statsDocId(ejercicio) {
  if (ejercicio.catalogoId) return ejercicio.catalogoId
  const slug = ejercicio.nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // El slug puede quedar vacío (nombre sin caracteres ASCII); el hash
  // garantiza un id distinto igual.
  return `n_${slug}_${hashNombre(ejercicio.nombre)}`
}

function statsDeSesion(ejercicioResumen, fechaMs, sesionId) {
  const series = ejercicioResumen.series ?? []
  const pesoMax = Math.max(0, ...series.map(s => s.pesoUsado || 0))
  const oneRm = Math.max(0, ...series.map(s => calcular1RM(s.pesoUsado || 0, s.repsHechas || 0) || 0))
  // La serie con más volumen (peso × reps), guardando también qué peso/reps
  // la lograron: Math.max sobre los números solos alcanza para el gráfico
  // "Vol. serie", pero para anunciar un récord ("110kg × 10") hace falta el
  // par que lo generó, no solo el número.
  const mejorSerieVolumen = series.reduce((mejor, s) => {
    const volumen = Math.round((s.pesoUsado || 0) * (s.repsHechas || 0))
    return volumen > (mejor?.volumen ?? 0)
      ? { volumen, pesoUsado: s.pesoUsado || 0, repsHechas: s.repsHechas || 0 }
      : mejor
  }, null) ?? { volumen: 0, pesoUsado: 0, repsHechas: 0 }
  return {
    pesoMax,
    mejorSerieVolumen,
    punto: { fecha: fechaMs, sesionId, pesoMax, oneRm, volSerie: mejorSerieVolumen.volumen },
    series,
  }
}

// Mergea los datos de UNA sesión sobre un doc de stats existente (o null).
export function mergeSesionEnStats(statsPrevio, ejercicioResumen, fechaMs, sesionId) {
  const s = statsDeSesion(ejercicioResumen, fechaMs, sesionId)

  const base = statsPrevio ?? {
    nombre: ejercicioResumen.nombre,
    grupoMuscular: ejercicioResumen.grupoMuscular ?? '',
    catalogoId: ejercicioResumen.catalogoId ?? null,
    pr: null,
    prVolumen: null,
    ultimaVez: null,
    puntos: [],
  }

  const pr = (s.pesoMax > 0 && (!base.pr || s.pesoMax > base.pr.maxPeso))
    ? { maxPeso: s.pesoMax, fecha: fechaMs, sesionId, series: s.series }
    : base.pr

  // Récord de volumen en UNA serie (peso × reps), independiente del PR de
  // peso máximo de arriba: una serie puede batir el volumen sin ser el peso
  // más alto histórico (más reps a menos peso, o el mismo peso con una rep
  // de más).
  const prVolumen = (s.mejorSerieVolumen.volumen > 0 && (!base.prVolumen || s.mejorSerieVolumen.volumen > base.prVolumen.volumen))
    ? { volumen: s.mejorSerieVolumen.volumen, pesoUsado: s.mejorSerieVolumen.pesoUsado, repsHechas: s.mejorSerieVolumen.repsHechas, fecha: fechaMs, sesionId }
    : base.prVolumen

  const ultimaVez = (!base.ultimaVez || fechaMs >= base.ultimaVez.fecha)
    ? { fecha: fechaMs, sesionId, series: s.series }
    : base.ultimaVez

  // Idempotente por sesionId: re-aplicar (edición) reemplaza el punto.
  const puntos = [...base.puntos.filter(p => p.sesionId !== sesionId), s.punto]
    .sort((a, b) => a.fecha - b.fecha)
    .slice(-MAX_PUNTOS)

  return { ...base, catalogoId: base.catalogoId ?? ejercicioResumen.catalogoId ?? null, pr, prVolumen, ultimaVez, puntos }
}

export async function getStatsEjercicios(uid) {
  const snap = await getDocs(col(uid))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Aplica una sesión completada a los docs de stats de sus ejercicios. Si se
// pasa un `batch` externo, agrega a ese batch sin comitear (el caller es
// responsable del commit — así se puede unir con otras escrituras en una
// sola operación atómica). Sin `batch`, arma y comitea uno propio.
export async function aplicarSesionAStats(uid, { sesionId, fecha, resumen }, batch = null) {
  const ejercicios = resumen?.ejercicios ?? []
  if (ejercicios.length === 0) return
  const fechaMs = toDate(fecha)?.getTime() ?? 0

  const own = !batch
  const b = batch ?? writeBatch(db)

  const refs = ejercicios.map(ej => doc(db, 'usuarios', uid, 'statsEjercicios', statsDocId(ej)))
  const snaps = await Promise.all(refs.map(ref => getDoc(ref))) // lecturas en paralelo, no secuenciales
  ejercicios.forEach((ej, i) => {
    const merged = mergeSesionEnStats(snaps[i].exists() ? snaps[i].data() : null, ej, fechaMs, sesionId)
    b.set(refs[i], merged)
  })

  if (own) await b.commit()
}

// Reconstruye los docs de stats de VARIOS ejercicios con un solo scan del
// historial. Camino raro (editar/eliminar sesiones viejas): acá sí se paga.
// Si se pasa un `batch` externo, agrega a ese batch sin comitear (el caller
// es responsable del commit). `excluirSesionId` saca esa sesión del
// historial usado para reconstruir, aunque su doc todavía exista en
// Firestore (caso: se está borrando dentro del mismo batch, que no es
// visible a esta lectura hasta que se comitee).
export async function rebuildStatsEjercicios(uid, ejercicios, batch = null, { excluirSesionId = null } = {}) {
  if (!ejercicios?.length) return
  let sesiones = await getSesionesConResumen(uid) // desc por fecha
  if (excluirSesionId) sesiones = sesiones.filter(s => s.id !== excluirSesionId)

  const own = !batch
  const b = batch ?? writeBatch(db)
  for (const ejercicio of ejercicios) {
    let stats = null
    for (const s of [...sesiones].reverse()) {
      const ej = s.resumen?.ejercicios?.find(e => esMismoEjercicio(e, ejercicio))
      if (!ej) continue
      stats = mergeSesionEnStats(stats, ej, toDate(s.fecha)?.getTime() ?? 0, s.id)
    }
    const ref = doc(db, 'usuarios', uid, 'statsEjercicios', statsDocId(ejercicio))
    b.set(ref, stats ?? {
      // El ejercicio ya no aparece en ninguna sesión: doc vacío.
      nombre: ejercicio.nombre,
      grupoMuscular: ejercicio.grupoMuscular ?? '',
      catalogoId: ejercicio.catalogoId ?? null,
      pr: null, prVolumen: null, ultimaVez: null, puntos: [],
    })
  }
  if (own) await b.commit()
}

// Self-healing: si la colección está vacía pero hay historial, la construye.
export async function getStatsEjerciciosConFallback(uid) {
  const existentes = await getStatsEjercicios(uid)
  if (existentes.length > 0) return existentes

  const sesiones = await getSesionesConResumen(uid)
  if (sesiones.length === 0) return []

  const porId = {}
  for (const s of [...sesiones].reverse()) {
    const fechaMs = toDate(s.fecha)?.getTime() ?? 0
    for (const ej of s.resumen?.ejercicios ?? []) {
      const id = statsDocId(ej)
      porId[id] = mergeSesionEnStats(porId[id] ?? null, ej, fechaMs, s.id)
    }
  }

  const batch = writeBatch(db)
  for (const [id, stats] of Object.entries(porId)) {
    batch.set(doc(db, 'usuarios', uid, 'statsEjercicios', id), stats)
  }
  await batch.commit()
  return Object.entries(porId).map(([id, stats]) => ({ id, ...stats }))
}
