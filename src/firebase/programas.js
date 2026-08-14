import { db, auth } from './config'
import {
  collection, addDoc, updateDoc, writeBatch,
  doc, query, where, getDocs,
} from 'firebase/firestore'
import { marcarDocParaEliminar, desmarcarDocParaEliminar, reordenarDocs } from './softDelete'

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

export const marcarParaEliminar = (programaId) => marcarDocParaEliminar('programas', programaId)

export const desmarcarParaEliminar = (programaId) => desmarcarDocParaEliminar('programas', programaId)

export async function eliminarProgramaDefinitivo(programaId) {
  const uid = auth.currentUser.uid
  const diasSnap = await getDocs(query(
    collection(db, 'dias'),
    where('usuarioId', '==', uid),
    where('programaId', '==', programaId),
  ))
  const diasIds = diasSnap.docs.map(d => d.id)
  const chunks = []
  for (let i = 0; i < diasIds.length; i += 30) chunks.push(diasIds.slice(i, i + 30))
  const ejSnaps = await Promise.all(
    chunks.map(chunk =>
      getDocs(query(
        collection(db, 'ejerciciosDia'),
        where('usuarioId', '==', uid),
        where('diaId', 'in', chunk),
      ))
    )
  )
  const batch = writeBatch(db)
  ejSnaps.forEach(snap => snap.docs.forEach(e => batch.delete(e.ref)))
  diasSnap.docs.forEach(d => batch.delete(d.ref))
  batch.delete(doc(db, 'programas', programaId))
  await batch.commit()
}

export const reordenarProgramas = (items) => reordenarDocs('programas', items)
