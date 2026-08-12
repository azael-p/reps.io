import { db, auth } from './config'
import { collection, addDoc, updateDoc, doc, query, where, getDocs, writeBatch, orderBy, limit, startAfter } from 'firebase/firestore'
import { toDate } from '../utils/fechas'
import { calcularStreaks } from '../utils/stats'

export async function enrichSesionesConPrograma(usuarioId, sesiones) {
  if (sesiones.length === 0) return sesiones

  // 1. Load user's programs (user owns them — no permission issues)
  const programasSnap = await getDocs(
    query(collection(db, 'programas'), where('usuarioId', '==', usuarioId))
  )
  const programasMap = {}
  const programaIds = []
  programasSnap.docs.forEach(d => { programasMap[d.id] = d.data().nombre; programaIds.push(d.id) })

  if (programaIds.length === 0) {
    return sesiones.map(s => ({ ...s, diaNombre: s.resumen?.diaNombre ?? '–', programaNombre: '–' }))
  }

  // 2. Load dias by programaId in chunks of 30 (Firestore 'in' limit)
  const diaToPrograma = {}
  const chunks = []
  for (let i = 0; i < programaIds.length; i += 30) chunks.push(programaIds.slice(i, i + 30))
  await Promise.all(chunks.map(async chunk => {
    const diasSnap = await getDocs(query(
      collection(db, 'dias'),
      where('usuarioId', '==', usuarioId),
      where('programaId', 'in', chunk),
    ))
    diasSnap.docs.forEach(d => {
      const data = d.data()
      diaToPrograma[d.id] = { diaNombre: data.nombre, programaNombre: programasMap[data.programaId] ?? '–' }
    })
  }))

  return sesiones.map(s => ({
    ...s,
    diaNombre: diaToPrograma[s.diaId]?.diaNombre ?? s.resumen?.diaNombre ?? '–',
    programaNombre: diaToPrograma[s.diaId]?.programaNombre ?? '–',
  }))
}

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

// Página del historial, ordenada por fecha desc (usa el índice compuesto
// usuarioId+completada+fecha). `after` es el ultimoDoc de la página anterior.
export async function getSesionesPaginadas(usuarioId, { after = null, pageSize = 20 } = {}) {
  const restricciones = [
    where('usuarioId', '==', usuarioId),
    where('completada', '==', true),
    orderBy('fecha', 'desc'),
    ...(after ? [startAfter(after)] : []),
    limit(pageSize),
  ]
  const snap = await getDocs(query(collection(db, 'sesiones'), ...restricciones))
  return {
    sesiones: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    ultimoDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hayMas: snap.docs.length === pageSize,
  }
}

// Dos ejercicios son "el mismo" si comparten catalogoId, o si a alguno le
// falta (datos de antes de que ese campo existiera) — ahí se cae a nombre.
export function esMismoEjercicio(a, b) {
  if (a.catalogoId && b.catalogoId) return a.catalogoId === b.catalogoId
  return a.nombre === b.nombre
}

// Client-side equivalents — call after getSesionesConResumen
export function getEjerciciosUsadosConGrupoLocal(sesiones) {
  const grupos = []
  for (const s of sesiones) {
    for (const ej of s.resumen?.ejercicios ?? []) {
      const grupo = grupos.find(g => esMismoEjercicio(g, ej))
      if (grupo) {
        if (!grupo.catalogoId && ej.catalogoId) grupo.catalogoId = ej.catalogoId
      } else {
        grupos.push({ nombre: ej.nombre, grupoMuscular: ej.grupoMuscular, catalogoId: ej.catalogoId ?? null })
      }
    }
  }
  return grupos.sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export function getVolumenPorSesionLocal(sesiones) {
  return sesiones
    .filter(s => s.resumen?.volumenTotal > 0)
    .map(s => ({ fecha: s.fecha, volumen: s.resumen.volumenTotal, sesionId: s.id }))
    .sort((a, b) => (a.fecha?.toMillis?.() ?? 0) - (b.fecha?.toMillis?.() ?? 0))
}

export function getRegistrosPorEjercicioLocal(sesiones, ejercicio) {
  const result = []
  for (const s of sesiones) {
    const ej = s.resumen?.ejercicios?.find(e => esMismoEjercicio(e, ejercicio))
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
  const epochs = sesiones
    .map(d => toDate(d.fecha))
    .filter(Boolean)
    .map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
  return calcularStreaks(epochs)
}

export async function getFechasSesiones(usuarioId) {
  const snap = await getDocs(query(collection(db, 'sesiones'), where('usuarioId', '==', usuarioId), where('completada', '==', true)))
  return snap.docs.map(d => d.data().fecha).filter(Boolean)
}

export async function eliminarSesion(sesionId) {
  const rSnap = await getDocs(query(
    collection(db, 'registros'),
    where('usuarioId', '==', auth.currentUser.uid),
    where('sesionId', '==', sesionId),
  ))
  const batch = writeBatch(db)
  rSnap.docs.forEach(r => batch.delete(r.ref))
  batch.delete(doc(db, 'sesiones', sesionId))
  await batch.commit()
}
