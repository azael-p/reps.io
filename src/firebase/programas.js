import { db } from './config'
import {
  collection, addDoc, updateDoc, writeBatch, deleteDoc,
  doc, query, where, getDocs, deleteField,
} from 'firebase/firestore'

export async function getProgramas(usuarioId) {
  const snap = await getDocs(query(collection(db, 'programas'), where('usuarioId', '==', usuarioId)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.eliminadoEn)
    .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
}

export async function crearPrograma(usuarioId, nombre) {
  const ref = await addDoc(collection(db, 'programas'), { usuarioId, nombre, orden: Date.now() })
  return ref.id
}

export async function editarPrograma(id, nombre) {
  await updateDoc(doc(db, 'programas', id), { nombre })
}

export async function marcarParaEliminar(programaId) {
  await updateDoc(doc(db, 'programas', programaId), { eliminadoEn: Date.now() })
}

export async function desmarcarParaEliminar(programaId) {
  await updateDoc(doc(db, 'programas', programaId), { eliminadoEn: deleteField() })
}

export async function eliminarProgramaDefinitivo(programaId) {
  const diasSnap = await getDocs(query(collection(db, 'dias'), where('programaId', '==', programaId)))
  const diasIds = diasSnap.docs.map(d => d.id)
  const ejSnaps = await Promise.all(
    diasIds.map(diaId =>
      getDocs(query(collection(db, 'ejerciciosDia'), where('diaId', '==', diaId)))
    )
  )
  const batch = writeBatch(db)
  ejSnaps.forEach(snap => snap.docs.forEach(e => batch.delete(e.ref)))
  diasSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, 'programas', programaId))
  await batch.commit()
}

export async function reordenarProgramas(items) {
  const batch = writeBatch(db)
  items.forEach(({ id, orden }) => {
    batch.update(doc(db, 'programas', id), { orden })
  })
  await batch.commit()
}
