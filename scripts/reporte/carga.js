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

function docsPlanos(snap) {
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// Carga cruda para la vista de detalle: 4 queries que traen cada colección
// entera y se agrupan por usuarioId en memoria (el Admin SDK ignora las rules,
// así que no hace falta una query por usuario). No se lee `registros`: el
// campo `resumen` de cada sesión ya tiene el desglose completo de series.
export async function cargarDetalleGlobal() {
  const [sesiones, programas, dias, ejerciciosDia] = await Promise.all([
    db.collection('sesiones').where('completada', '==', true).get(),
    db.collection('programas').get(),
    db.collection('dias').get(),
    db.collection('ejerciciosDia').get(),
  ])

  return {
    // `fecha` es un Timestamp del SDK: se aplana a ms acá para que todo lo que
    // sigue (transformar + payload JSON) trabaje con datos serializables.
    sesiones: sesiones.docs.map(d => {
      const { fecha, ...resto } = d.data()
      return { id: d.id, ...resto, fechaMs: fecha?.toMillis?.() ?? null }
    }),
    programas: docsPlanos(programas),
    dias: docsPlanos(dias),
    ejerciciosDia: docsPlanos(ejerciciosDia),
  }
}
