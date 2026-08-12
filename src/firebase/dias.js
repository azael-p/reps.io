import { db, auth } from './config'
import {
  collection, addDoc, updateDoc, writeBatch,
  doc, query, where, getDocs,
} from 'firebase/firestore'
import { marcarDocParaEliminar, desmarcarDocParaEliminar, reordenarDocs } from './softDelete'

export async function getDias(programaId) {
  const snap = await getDocs(
    query(
      collection(db, 'dias'),
      where('usuarioId', '==', auth.currentUser.uid),
      where('programaId', '==', programaId),
    )
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => !d.eliminadoEn)
    .sort((a, b) => a.orden - b.orden)
}

export async function crearDia(programaId, nombre, orden) {
  const ref = await addDoc(collection(db, 'dias'), {
    programaId, nombre, orden,
    usuarioId: auth.currentUser.uid,
  })
  return ref.id
}

export async function editarDia(id, nombre) {
  await updateDoc(doc(db, 'dias', id), { nombre })
}

export const marcarDiaParaEliminar = (diaId) => marcarDocParaEliminar('dias', diaId)

export const desmarcarDiaParaEliminar = (diaId) => desmarcarDocParaEliminar('dias', diaId)

export async function eliminarDiaDefinitivo(diaId) {
  const ejSnap = await getDocs(query(
    collection(db, 'ejerciciosDia'),
    where('usuarioId', '==', auth.currentUser.uid),
    where('diaId', '==', diaId),
  ))
  const batch = writeBatch(db)
  ejSnap.docs.forEach(e => batch.delete(e.ref))
  batch.delete(doc(db, 'dias', diaId))
  await batch.commit()
}

export const reordenarDias = (items) => reordenarDocs('dias', items)
