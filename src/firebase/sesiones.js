import { db } from './config'
import { collection, addDoc, updateDoc, doc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore'

export async function crearSesion(usuarioId, diaId) {
  const ref = await addDoc(collection(db, 'sesiones'), {
    usuarioId,
    diaId,
    fecha: new Date(),
    nota: '',
    completada: false,
  })
  return ref.id
}

export async function completarSesion(sesionId, resumen = null) {
  const update = { completada: true }
  if (resumen) update.resumen = resumen
  await updateDoc(doc(db, 'sesiones', sesionId), update)
}

export async function backfillResumen(sesionId, resumen) {
  await updateDoc(doc(db, 'sesiones', sesionId), { resumen })
}

export async function actualizarNotaSesion(sesionId, nota) {
  await updateDoc(doc(db, 'sesiones', sesionId), { nota })
}

export async function getSesiones(usuarioId) {
  const snap = await getDocs(query(collection(db, 'sesiones'), where('usuarioId', '==', usuarioId), where('completada', '==', true)))
  const sesiones = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.fecha?.toMillis?.() - a.fecha?.toMillis?.())

  const diasCache = {}
  for (const s of sesiones) {
    if (!diasCache[s.diaId]) {
      const diaSnap = await getDoc(doc(db, 'dias', s.diaId))
      diasCache[s.diaId] = diaSnap.data()?.nombre ?? 'Día eliminado'
    }
    s.diaNombre = diasCache[s.diaId]
  }
  return sesiones
}

// Single query — replaces all N+1 functions. Sorted desc by fecha.
export async function getSesionesConResumen(usuarioId) {
  const snap = await getDocs(query(
    collection(db, 'sesiones'),
    where('usuarioId', '==', usuarioId),
    where('completada', '==', true)
  ))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0))
}

// Client-side equivalents — call after getSesionesConResumen
export function getEjerciciosUsadosConGrupoLocal(sesiones) {
  const mapa = {}
  for (const s of sesiones) {
    for (const ej of s.resumen?.ejercicios ?? []) {
      if (!mapa[ej.nombre]) mapa[ej.nombre] = ej.grupoMuscular
    }
  }
  return Object.entries(mapa)
    .map(([nombre, grupoMuscular]) => ({ nombre, grupoMuscular }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export function getVolumenPorSesionLocal(sesiones) {
  return sesiones
    .filter(s => s.resumen?.volumenTotal > 0)
    .map(s => ({ fecha: s.fecha, volumen: s.resumen.volumenTotal, sesionId: s.id }))
    .sort((a, b) => (a.fecha?.toMillis?.() ?? 0) - (b.fecha?.toMillis?.() ?? 0))
}

export function getRegistrosPorEjercicioLocal(sesiones, nombreEjercicio) {
  const result = []
  for (const s of sesiones) {
    const ej = s.resumen?.ejercicios?.find(e => e.nombre === nombreEjercicio)
    if (!ej) continue
    for (const serie of ej.series) {
      result.push({
        sesionId: s.id,
        fecha: s.fecha,
        pesoUsado: serie.pesoUsado,
        repsHechas: serie.repsHechas,
        numeroSerie: serie.numeroSerie,
      })
    }
  }
  return result.sort((a, b) => (a.fecha?.toMillis?.() ?? 0) - (b.fecha?.toMillis?.() ?? 0))
}

export function getStreaksLocal(sesiones) {
  const fechas = sesiones
    .map(d => d.fecha?.toDate ? d.fecha.toDate() : null)
    .filter(Boolean)
    .map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    .sort((a, b) => b - a)

  if (fechas.length === 0) return { actual: 0, maxima: 0 }

  const unicas = [...new Set(fechas.map(d => d.getTime()))]
    .map(t => new Date(t))
    .sort((a, b) => b - a)

  let actual = 1
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diffHoy = Math.round((hoy - unicas[0]) / 86400000)
  if (diffHoy > 1) {
    actual = 0
  } else {
    for (let i = 1; i < unicas.length; i++) {
      const diff = Math.round((unicas[i - 1] - unicas[i]) / 86400000)
      if (diff === 1) actual++
      else break
    }
  }

  let maxima = 1
  let temp = 1
  for (let i = 1; i < unicas.length; i++) {
    const diff = Math.round((unicas[i - 1] - unicas[i]) / 86400000)
    if (diff === 1) { temp++; if (temp > maxima) maxima = temp }
    else { temp = 1 }
  }

  return { actual, maxima }
}

export async function getFechasSesiones(usuarioId) {
  const snap = await getDocs(query(collection(db, 'sesiones'), where('usuarioId', '==', usuarioId), where('completada', '==', true)))
  return snap.docs.map(d => d.data().fecha).filter(Boolean)
}

export async function eliminarSesion(sesionId) {
  const rSnap = await getDocs(query(collection(db, 'registros'), where('sesionId', '==', sesionId)))
  const batch = writeBatch(db)
  rSnap.docs.forEach(r => batch.delete(r.ref))
  batch.delete(doc(db, 'sesiones', sesionId))
  await batch.commit()
}

export async function getStreaks(usuarioId) {
  const snap = await getDocs(query(collection(db, 'sesiones'), where('usuarioId', '==', usuarioId), where('completada', '==', true)))
  const fechas = snap.docs
    .map(d => d.data().fecha?.toDate ? d.data().fecha.toDate() : null)
    .filter(Boolean)
    .map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    .sort((a, b) => b - a)

  if (fechas.length === 0) return { actual: 0, maxima: 0 }

  const unicas = [...new Set(fechas.map(d => d.getTime()))]
    .map(t => new Date(t))
    .sort((a, b) => b - a)

  let actual = 1
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  const diffHoy = Math.round((hoy - unicas[0]) / 86400000)
  if (diffHoy > 1) {
    actual = 0
  } else {
    for (let i = 1; i < unicas.length; i++) {
      const diff = Math.round((unicas[i - 1] - unicas[i]) / 86400000)
      if (diff === 1) actual++
      else break
    }
  }

  let maxima = 1
  let temp = 1
  for (let i = 1; i < unicas.length; i++) {
    const diff = Math.round((unicas[i - 1] - unicas[i]) / 86400000)
    if (diff === 1) {
      temp++
      if (temp > maxima) maxima = temp
    } else {
      temp = 1
    }
  }

  return { actual, maxima }
}
