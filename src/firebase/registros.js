import { db, auth } from './config'
import { collection, updateDoc, setDoc, doc, query, where, getDocs } from 'firebase/firestore'

// No await-ea el ACK del servidor: con persistentLocalCache la escritura ya
// se aplicó al cache local al llamar setDoc, así que el id es usable de
// inmediato (necesario para poder editar esta serie si el usuario retrocede
// antes de que la red confirme). `listo` se ofrece para reportar un fallo
// eventual sin bloquear.
export function agregarRegistro({ sesionId, ejercicioId, nombreEjercicio, grupoMuscular, catalogoId = null, numeroSerie, repsEsperadas, repsHechas, pesoUsado, nota }) {
  const ref = doc(collection(db, 'registros'))
  const listo = setDoc(ref, {
    sesionId, ejercicioId, nombreEjercicio, grupoMuscular, catalogoId,
    numeroSerie, repsEsperadas, repsHechas, pesoUsado, nota,
    usuarioId: auth.currentUser.uid,
  })
  return { id: ref.id, listo }
}

export async function editarRegistro(id, campos) {
  const update = {}
  for (const k of ['pesoUsado', 'repsHechas', 'nota']) {
    if (campos[k] !== undefined) update[k] = campos[k]
  }
  await updateDoc(doc(db, 'registros', id), update)
}

export async function getRegistrosSesion(sesionId) {
  const snap = await getDocs(query(
    collection(db, 'registros'),
    where('usuarioId', '==', auth.currentUser.uid),
    where('sesionId', '==', sesionId),
  ))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.numeroSerie - b.numeroSerie)
}