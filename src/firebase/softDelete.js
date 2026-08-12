import { db } from './config'
import { updateDoc, writeBatch, doc, deleteField } from 'firebase/firestore'

// Soft-delete compartido por programas/dias/ejerciciosDia: marcar esconde el
// doc (las queries filtran eliminadoEn), desmarcar lo restaura (undo del toast).

export async function marcarDocParaEliminar(coleccion, id) {
  await updateDoc(doc(db, coleccion, id), { eliminadoEn: Date.now() })
}

export async function desmarcarDocParaEliminar(coleccion, id) {
  await updateDoc(doc(db, coleccion, id), { eliminadoEn: deleteField() })
}

export async function reordenarDocs(coleccion, items) {
  const batch = writeBatch(db)
  items.forEach(({ id, orden }) => {
    batch.update(doc(db, coleccion, id), { orden })
  })
  await batch.commit()
}
