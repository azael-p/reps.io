import { db, auth } from './config'
import {
  collection, addDoc, updateDoc, writeBatch,
  doc, query, where, getDocs, getDoc, deleteField,
} from 'firebase/firestore'
import { reordenarDocs } from './softDelete'

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

function getDiasDelPrograma(uid, programaId) {
  return getDocs(query(
    collection(db, 'dias'),
    where('usuarioId', '==', uid),
    where('programaId', '==', programaId),
  ))
}

// Cascada: marcar/desmarcar un programa propaga eliminadoEn a sus días para
// que la sugerencia de "próximo día" (ver getProximoDiaSugerido) deje de
// verlos al toque, sin esperar al borrado físico diferido (undo timeout o
// limpiarEliminadosDefinitivamente). Se usa el mismo timestamp en programa y
// días para poder distinguir, al desmarcar, los días que entraron en esta
// cascada de los que ya estaban eliminados individualmente antes.
export async function marcarParaEliminar(programaId) {
  const uid = auth.currentUser.uid
  const ahora = Date.now()
  const diasSnap = await getDiasDelPrograma(uid, programaId)
  const batch = writeBatch(db)
  batch.update(doc(db, 'programas', programaId), { eliminadoEn: ahora })
  diasSnap.docs.forEach(d => {
    if (!d.data().eliminadoEn) batch.update(d.ref, { eliminadoEn: ahora })
  })
  await batch.commit()
}

export async function desmarcarParaEliminar(programaId) {
  const uid = auth.currentUser.uid
  const programaSnap = await getDoc(doc(db, 'programas', programaId))
  const marcadoEn = programaSnap.data()?.eliminadoEn
  const diasSnap = await getDiasDelPrograma(uid, programaId)
  const batch = writeBatch(db)
  batch.update(doc(db, 'programas', programaId), { eliminadoEn: deleteField() })
  diasSnap.docs.forEach(d => {
    if (d.data().eliminadoEn === marcadoEn) batch.update(d.ref, { eliminadoEn: deleteField() })
  })
  await batch.commit()
}

export async function eliminarProgramaDefinitivo(programaId) {
  const uid = auth.currentUser.uid
  const diasSnap = await getDiasDelPrograma(uid, programaId)
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
