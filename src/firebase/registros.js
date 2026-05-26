import { db } from './config'
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore'

// Local lookup — no Firestore queries. sesiones must be sorted desc by fecha.
export function getUltimaVezEjercicioLocal(sesiones, ejercicioId, sesionIdActual) {
  for (const sesion of sesiones) {
    if (sesion.id === sesionIdActual) continue
    const ej = sesion.resumen?.ejercicios?.find(e => e.ejercicioId === ejercicioId)
    if (ej?.series?.length > 0) {
      return { fecha: sesion.fecha, series: ej.series }
    }
  }
  return null
}

export async function agregarRegistro({ sesionId, ejercicioId, nombreEjercicio, grupoMuscular, numeroSerie, repsEsperadas, repsHechas, pesoUsado, nota }) {
  const ref = await addDoc(collection(db, 'registros'), {
    sesionId, ejercicioId, nombreEjercicio, grupoMuscular,
    numeroSerie, repsEsperadas, repsHechas, pesoUsado, nota,
  })
  return ref.id
}

export async function editarRegistro(id, campos) {
  const update = {}
  for (const k of ['pesoUsado', 'repsHechas', 'nota']) {
    if (campos[k] !== undefined) update[k] = campos[k]
  }
  await updateDoc(doc(db, 'registros', id), update)
}

export async function getRegistrosSesion(sesionId) {
  const snap = await getDocs(query(collection(db, 'registros'), where('sesionId', '==', sesionId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.numeroSerie - b.numeroSerie)
}