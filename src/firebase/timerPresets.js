import { db } from './config'
import { collection, addDoc, deleteDoc, doc, query, getDocs, serverTimestamp } from 'firebase/firestore'

const COL = (uid) => collection(db, 'usuarios', uid, 'timerPresets')

export async function getPresets(uid) {
  const snap = await getDocs(query(COL(uid)))
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.creadoEn?.toMillis?.() ?? 0) - (b.creadoEn?.toMillis?.() ?? 0))
}

export async function savePreset(uid, preset) {
  const existing = await getDocs(query(COL(uid)))
  if (existing.size >= 5) throw new Error('Máximo 5 presets permitidos')
  return addDoc(COL(uid), { ...preset, creadoEn: serverTimestamp() })
}

export async function deletePreset(uid, id) {
  await deleteDoc(doc(db, 'usuarios', uid, 'timerPresets', id))
}
