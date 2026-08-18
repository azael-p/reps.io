import { db, auth } from './config'
import {
  collection, addDoc, updateDoc, writeBatch,
  doc, query, where, getDocs, getDoc,
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

// Resuelve "el día que sigue" al último entrenado, usando el orden del
// programa como heurística. Devuelve null ante cualquier imposibilidad
// (día borrado, offline, etc.): es una sugerencia, nunca debe romper el
// flujo normal de empezar a entrenar.
export async function getProximoDiaSugerido(ultimoDiaId) {
  if (!ultimoDiaId) return null
  try {
    const snap = await getDoc(doc(db, 'dias', ultimoDiaId))
    if (!snap.exists()) return null
    const data = snap.data()
    if (data.eliminadoEn) return null

    const dias = await getDias(data.programaId)
    const indice = dias.findIndex(d => d.id === ultimoDiaId)
    if (indice === -1) return null

    const siguiente = (indice + 1) % dias.length
    return { dia: dias[siguiente], programaId: data.programaId, numero: siguiente + 1 }
  } catch (e) {
    console.error(e)
    return null
  }
}
