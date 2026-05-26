import { db } from './config'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'

export async function getCatalogo() {
  const snap = await getDocs(query(collection(db, 'ejerciciosCatalogo'), orderBy('nombre')))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}
