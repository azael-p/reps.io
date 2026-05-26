// Script de migración one-time: mueve los datos de azael → pignanessiazael@gmail.com
// y de fernando → fcoitinho590@gmail.com
//
// Prerequisitos:
//   1. Ambos usuarios deben haber hecho login con Google al menos una vez en la app
//   2. Colocar la clave de servicio en scripts/serviceAccount.json
//   3. Ejecutar: node scripts/migrate.js

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()
const auth = admin.auth()

const MIGRACIONES = [
  { legacyId: 'azael',    email: 'pignanessiazael@gmail.com' },
  { legacyId: 'fernando', email: 'fcoitinho590@gmail.com' },
]

async function migrarUsuario(legacyId, email) {
  console.log(`\n→ Migrando ${legacyId} (${email})...`)

  let userRecord
  try {
    userRecord = await auth.getUserByEmail(email)
  } catch {
    console.error(`  ✗ No se encontró cuenta de Firebase Auth para ${email}`)
    console.error(`    Ese usuario debe hacer login en la app primero.`)
    return
  }

  const newUid = userRecord.uid
  console.log(`  UID nuevo: ${newUid}`)

  const [snapProgramas, snapSesiones] = await Promise.all([
    db.collection('programas').where('usuarioId', '==', legacyId).get(),
    db.collection('sesiones').where('usuarioId', '==', legacyId).get(),
  ])

  console.log(`  Programas: ${snapProgramas.size} | Sesiones: ${snapSesiones.size}`)

  if (snapProgramas.empty && snapSesiones.empty) {
    console.log(`  ✓ Sin datos que migrar`)
    return
  }

  // Firestore batch tiene límite de 500 ops — dividir si es necesario
  const ops = [
    ...snapProgramas.docs.map(d => ({ ref: d.ref })),
    ...snapSesiones.docs.map(d => ({ ref: d.ref })),
  ]

  const BATCH_SIZE = 490
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const chunk = ops.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    chunk.forEach(({ ref }) => batch.update(ref, { usuarioId: newUid }))
    await batch.commit()
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} docs actualizados`)
  }

  // Copiar el documento de usuario viejo al nuevo UID
  const viejoDoc = await db.collection('usuarios').doc(legacyId).get()
  if (viejoDoc.exists) {
    const data = viejoDoc.data()
    await db.collection('usuarios').doc(newUid).set({
      nombre: data.nombre,
      email,
      photoURL: userRecord.photoURL || null,
    }, { merge: true })
    console.log(`  ✓ Documento usuarios/${newUid} actualizado`)
  }

  console.log(`  ✓ ${legacyId} migrado correctamente`)
}

async function main() {
  console.log('=== Migración reps.io ===')
  for (const { legacyId, email } of MIGRACIONES) {
    await migrarUsuario(legacyId, email)
  }
  console.log('\n✓ Migración completa')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
