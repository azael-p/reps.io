import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, writeBatch,
  doc, query, where, getDocs,
} from 'firebase/firestore'

export async function getDias(programaId) {
  const snap = await getDocs(
    query(collection(db, 'dias'), where('programaId', '==', programaId))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.orden - b.orden)
}

export async function crearDia(programaId, nombre, orden) {
  const ref = await addDoc(collection(db, 'dias'), { programaId, nombre, orden })
  return ref.id
}

export async function editarDia(id, nombre) {
  await updateDoc(doc(db, 'dias', id), { nombre })
}

export async function eliminarDia(diaId) {
  const ejSnap = await getDocs(query(collection(db, 'ejerciciosDia'), where('diaId', '==', diaId)))
  for (const e of ejSnap.docs) await deleteDoc(doc(db, 'ejerciciosDia', e.id))
  await deleteDoc(doc(db, 'dias', diaId))
}

export async function reordenarDias(items) {
  const batch = writeBatch(db)
  items.forEach(({ id, orden }) => {
    batch.update(doc(db, 'dias', id), { orden })
  })
  await batch.commit()
}
