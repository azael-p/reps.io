import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore'
import { db } from './config'

export async function agregarPeso(usuarioId, pesoKg) {
  await addDoc(collection(db, 'usuarios', usuarioId, 'historialPeso'), {
    peso: pesoKg,
    fecha: serverTimestamp(),
  })
}

export async function getHistorialPeso(usuarioId) {
  const q = query(
    collection(db, 'usuarios', usuarioId, 'historialPeso'),
    orderBy('fecha', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({
    id: d.id,
    peso: d.data().peso,
    fecha: d.data().fecha?.toDate() ?? new Date(),
  }))
}
