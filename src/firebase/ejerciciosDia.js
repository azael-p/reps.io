import { db, auth } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, where, getDocs,
} from 'firebase/firestore'
import { marcarDocParaEliminar, desmarcarDocParaEliminar, reordenarDocs } from './softDelete'

export async function getEjerciciosDia(diaId) {
  const snap = await getDocs(
    query(
      collection(db, 'ejerciciosDia'),
      where('usuarioId', '==', auth.currentUser.uid),
      where('diaId', '==', diaId),
    )
  )
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(e => !e.eliminadoEn)
    .sort((a, b) => a.orden - b.orden)
}

export async function agregarEjercicioDia({ diaId, nombre, grupoMuscular, esCustom, catalogoId = null, seriesEsperadas, repsEsperadas, orden }) {
  const ref = await addDoc(collection(db, 'ejerciciosDia'), {
    diaId, nombre, grupoMuscular, esCustom, seriesEsperadas, repsEsperadas, orden,
    // Referencia al doc de ejerciciosCatalogo. null en ejercicios personalizados.
    catalogoId: catalogoId ?? null,
    usuarioId: auth.currentUser.uid,
  })
  return ref.id
}

export async function editarEjercicioDia(id, { nombre, seriesEsperadas, repsEsperadas }) {
  await updateDoc(doc(db, 'ejerciciosDia', id), { nombre, seriesEsperadas, repsEsperadas })
}

export const marcarEjercicioParaEliminar = (id) => marcarDocParaEliminar('ejerciciosDia', id)

export const desmarcarEjercicioParaEliminar = (id) => desmarcarDocParaEliminar('ejerciciosDia', id)

export async function eliminarEjercicioDefinitivo(id) {
  await deleteDoc(doc(db, 'ejerciciosDia', id))
}

export const reordenarEjercicios = (items) => reordenarDocs('ejerciciosDia', items)
