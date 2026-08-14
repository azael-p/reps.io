import { db } from './config'
import { collection, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore'
import { toDate } from '../utils/fechas'
import { calcular1RM } from '../utils/stats'
import { getSesionesConResumen, esMismoEjercicio } from './sesiones'

// Agregado por ejercicio (usuarios/{uid}/statsEjercicios/{docId}):
// - pr:        { maxPeso, fecha(ms), sesionId, series }   ← forma que espera la UI
// - ultimaVez: { fecha(ms), sesionId, series }
// - puntos:    [{ fecha(ms), sesionId, pesoMax, oneRm, volSerie }]  cap 150
//   (máximos POR SERIE de cada sesión — misma semántica que el gráfico previo)
// Reemplaza el recorrido del historial completo para "última vez"/PR
// (SesionActiva) y el gráfico de progresión (Progreso).

const MAX_PUNTOS = 150

const col = (uid) => collection(db, 'usuarios', uid, 'statsEjercicios')

// Misma semántica que esMismoEjercicio: catalogoId, o nombre para los custom.
export function statsDocId(ejercicio) {
  if (ejercicio.catalogoId) return ejercicio.catalogoId
  const slug = ejercicio.nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `n_${slug}`
}

function statsDeSesion(ejercicioResumen, fechaMs, sesionId) {
  const series = ejercicioResumen.series ?? []
  const pesoMax = Math.max(0, ...series.map(s => s.pesoUsado || 0))
  const oneRm = Math.max(0, ...series.map(s => calcular1RM(s.pesoUsado || 0, s.repsHechas || 0) || 0))
  const volSerie = Math.max(0, ...series.map(s => Math.round((s.pesoUsado || 0) * (s.repsHechas || 0))))
  return {
    pesoMax,
    punto: { fecha: fechaMs, sesionId, pesoMax, oneRm, volSerie },
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
    ultimaVez: null,
    puntos: [],
  }

  const pr = (s.pesoMax > 0 && (!base.pr || s.pesoMax > base.pr.maxPeso))
    ? { maxPeso: s.pesoMax, fecha: fechaMs, sesionId, series: s.series }
    : base.pr

  const ultimaVez = (!base.ultimaVez || fechaMs >= base.ultimaVez.fecha)
    ? { fecha: fechaMs, sesionId, series: s.series }
    : base.ultimaVez

  // Idempotente por sesionId: re-aplicar (edición) reemplaza el punto.
  const puntos = [...base.puntos.filter(p => p.sesionId !== sesionId), s.punto]
    .sort((a, b) => a.fecha - b.fecha)
    .slice(-MAX_PUNTOS)

  return { ...base, catalogoId: base.catalogoId ?? ejercicioResumen.catalogoId ?? null, pr, ultimaVez, puntos }
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
export async function rebuildStatsEjercicios(uid, ejercicios) {
  if (!ejercicios?.length) return
  const sesiones = await getSesionesConResumen(uid) // desc por fecha

  const batch = writeBatch(db)
  for (const ejercicio of ejercicios) {
    let stats = null
    for (const s of [...sesiones].reverse()) {
      const ej = s.resumen?.ejercicios?.find(e => esMismoEjercicio(e, ejercicio))
      if (!ej) continue
      stats = mergeSesionEnStats(stats, ej, toDate(s.fecha)?.getTime() ?? 0, s.id)
    }
    const ref = doc(db, 'usuarios', uid, 'statsEjercicios', statsDocId(ejercicio))
    batch.set(ref, stats ?? {
      // El ejercicio ya no aparece en ninguna sesión: doc vacío.
      nombre: ejercicio.nombre,
      grupoMuscular: ejercicio.grupoMuscular ?? '',
      catalogoId: ejercicio.catalogoId ?? null,
      pr: null, ultimaVez: null, puntos: [],
    })
  }
  await batch.commit()
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
