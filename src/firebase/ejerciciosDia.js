import { db, auth } from './config'
import {
  collection, addDoc, updateDoc, deleteDoc, writeBatch,
  doc, query, where, getDocs, deleteField,
} from 'firebase/firestore'

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

export async function marcarEjercicioParaEliminar(id) {
  await updateDoc(doc(db, 'ejerciciosDia', id), { eliminadoEn: Date.now() })
}

export async function desmarcarEjercicioParaEliminar(id) {
  await updateDoc(doc(db, 'ejerciciosDia', id), { eliminadoEn: deleteField() })
}

export async function eliminarEjercicioDefinitivo(id) {
  await deleteDoc(doc(db, 'ejerciciosDia', id))
}

export async function reordenarEjercicios(items) {
  const batch = writeBatch(db)
  items.forEach(({ id, orden }) => {
    batch.update(doc(db, 'ejerciciosDia', id), { orden })
  })
  await batch.commit()
}
