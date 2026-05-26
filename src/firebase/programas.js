import { db } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, writeBatch,
  doc, query, where, getDocs,
} from 'firebase/firestore'

export async function getProgramas(usuarioId) {
  const snap = await getDocs(query(collection(db, 'programas'), where('usuarioId', '==', usuarioId)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
}

export async function crearPrograma(usuarioId, nombre) {
  const snap = await getDocs(query(collection(db, 'programas'), where('usuarioId', '==', usuarioId)))
  const orden = snap.docs.length
  const ref = await addDoc(collection(db, 'programas'), { usuarioId, nombre, orden })
  return ref.id
}

export async function editarPrograma(id, nombre) {
  await updateDoc(doc(db, 'programas', id), { nombre })
}

export async function eliminarPrograma(programaId) {
  const diasSnap = await getDocs(query(collection(db, 'dias'), where('programaId', '==', programaId)))
  for (const d of diasSnap.docs) {
    const ejSnap = await getDocs(query(collection(db, 'ejerciciosDia'), where('diaId', '==', d.id)))
    for (const e of ejSnap.docs) await deleteDoc(doc(db, 'ejerciciosDia', e.id))
    await deleteDoc(doc(db, 'dias', d.id))
  }
  await deleteDoc(doc(db, 'programas', programaId))
}

export async function reordenarProgramas(items) {
  const batch = writeBatch(db)
  items.forEach(({ id, orden }) => {
    batch.update(doc(db, 'programas', id), { orden })
  })
  await batch.commit()
}
