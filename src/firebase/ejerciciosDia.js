import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, writeBatch,
  doc, query, where, getDocs,
} from 'firebase/firestore'

export async function getEjerciciosDia(diaId) {
  const snap = await getDocs(
    query(collection(db, 'ejerciciosDia'), where('diaId', '==', diaId))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.orden - b.orden)
}

export async function agregarEjercicioDia({ diaId, nombre, grupoMuscular, esCustom, seriesEsperadas, repsEsperadas, orden }) {
  const ref = await addDoc(collection(db, 'ejerciciosDia'), {
    diaId, nombre, grupoMuscular, esCustom, seriesEsperadas, repsEsperadas, orden,
  })
  return ref.id
}

export async function editarEjercicioDia(id, { nombre, seriesEsperadas, repsEsperadas }) {
  await updateDoc(doc(db, 'ejerciciosDia', id), { nombre, seriesEsperadas, repsEsperadas })
}

export async function eliminarEjercicioDia(id) {
  await deleteDoc(doc(db, 'ejerciciosDia', id))
}

export async function reordenarEjercicios(items) {
  const batch = writeBatch(db)
  items.forEach(({ id, orden }) => {
    batch.update(doc(db, 'ejerciciosDia', id), { orden })
  })
  await batch.commit()
}
