import { db } from './config'
import {
  collection, addDoc, updateDoc, writeBatch, deleteDoc,
  doc, query, where, getDocs, deleteField,
} from 'firebase/firestore'

export async function getDias(programaId) {
  const snap = await getDocs(
    query(collection(db, 'dias'), where('programaId', '==', programaId))
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => !d.eliminadoEn)
    .sort((a, b) => a.orden - b.orden)
}

export async function crearDia(programaId, nombre, orden) {
  const ref = await addDoc(collection(db, 'dias'), { programaId, nombre, orden })
  return ref.id
}

export async function editarDia(id, nombre) {
  await updateDoc(doc(db, 'dias', id), { nombre })
}

export async function marcarDiaParaEliminar(diaId) {
  await updateDoc(doc(db, 'dias', diaId), { eliminadoEn: Date.now() })
}

export async function desmarcarDiaParaEliminar(diaId) {
  await updateDoc(doc(db, 'dias', diaId), { eliminadoEn: deleteField() })
}

export async function eliminarDiaDefinitivo(diaId) {
  const ejSnap = await getDocs(query(collection(db, 'ejerciciosDia'), where('diaId', '==', diaId)))
  const batch = writeBatch(db)
  ejSnap.docs.forEach(e => batch.delete(e.ref))
  batch.delete(doc(db, 'dias', diaId))
  await batch.commit()
}

export async function reordenarDias(items) {
  const batch = writeBatch(db)
  items.forEach(({ id, orden }) => {
    batch.update(doc(db, 'dias', id), { orden })
  })
  await batch.commit()
}
