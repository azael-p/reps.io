// Único módulo del reporte que habla con Firebase. Read-only: solo get()/count().

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('../serviceAccount.json')

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const auth = getAuth()

export async function cargarUsuariosAuth() {
  const map = new Map()
  let pageToken
  do {
    const res = await auth.listUsers(1000, pageToken)
    for (const u of res.users) {
      map.set(u.uid, {
        email: u.email ?? null,
        creationTime: u.metadata.creationTime ?? null,
        lastSignInTime: u.metadata.lastSignInTime ?? null,
      })
    }
    pageToken = res.pageToken
  } while (pageToken)
  return map
}

export async function cargarUsuariosFirestore() {
  const snap = await db.collection('usuarios').get()
  const map = new Map()
  for (const doc of snap.docs) map.set(doc.id, doc.data())
  return map
}

export async function cargarStatsGlobal(uid) {
  const snap = await db.doc(`usuarios/${uid}/stats/global`).get()
  return snap.exists ? snap.data() : { diasEntrenados: [] }
}

export async function contarSesiones(uid) {
  const snap = await db.collection('sesiones')
    .where('usuarioId', '==', uid)
    .where('completada', '==', true)
    .count()
    .get()
  return snap.data().count
}
