// Backfill one-time: agrega usuarioId a dias, ejerciciosDia y registros existentes.
// Se rastrea desde el padre: dia.programaId → programa.usuarioId, etc.
//
// Prerequisitos:
//   1. Colocar la clave de servicio en scripts/serviceAccount.json
//   2. Ejecutar: node scripts/backfill-usuarioId.js
//
// Idempotente: si un doc ya tiene usuarioId, se saltea.

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const BATCH_SIZE = 490

async function commitBatch(updates, label) {
  if (updates.length === 0) {
    console.log(`  ${label}: nada para actualizar`)
    return
  }
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    chunk.forEach(({ ref, usuarioId }) => batch.update(ref, { usuarioId }))
    await batch.commit()
    console.log(`  ${label}: batch ${Math.floor(i / BATCH_SIZE) + 1} → ${chunk.length} docs`)
  }
}

async function backfillDias() {
  console.log('\n→ Backfilleando dias...')
  const [diasSnap, programasSnap] = await Promise.all([
    db.collection('dias').get(),
    db.collection('programas').get(),
  ])
  const programaToUsuario = {}
  programasSnap.docs.forEach(p => { programaToUsuario[p.id] = p.data().usuarioId })

  const updates = []
  let sinPadre = 0
  let yaTienen = 0
  for (const d of diasSnap.docs) {
    const data = d.data()
    if (data.usuarioId) { yaTienen++; continue }
    const usuarioId = programaToUsuario[data.programaId]
    if (!usuarioId) { sinPadre++; continue }
    updates.push({ ref: d.ref, usuarioId })
  }
  console.log(`  total: ${diasSnap.size} | ya tienen: ${yaTienen} | sin padre: ${sinPadre} | a actualizar: ${updates.length}`)
  await commitBatch(updates, 'dias')
}

async function backfillEjerciciosDia() {
  console.log('\n→ Backfilleando ejerciciosDia...')
  const [ejSnap, diasSnap, programasSnap] = await Promise.all([
    db.collection('ejerciciosDia').get(),
    db.collection('dias').get(),
    db.collection('programas').get(),
  ])
  const programaToUsuario = {}
  programasSnap.docs.forEach(p => { programaToUsuario[p.id] = p.data().usuarioId })
  const diaToUsuario = {}
  diasSnap.docs.forEach(d => {
    const data = d.data()
    diaToUsuario[d.id] = data.usuarioId || programaToUsuario[data.programaId]
  })

  const updates = []
  let sinPadre = 0
  let yaTienen = 0
  for (const e of ejSnap.docs) {
    const data = e.data()
    if (data.usuarioId) { yaTienen++; continue }
    const usuarioId = diaToUsuario[data.diaId]
    if (!usuarioId) { sinPadre++; continue }
    updates.push({ ref: e.ref, usuarioId })
  }
  console.log(`  total: ${ejSnap.size} | ya tienen: ${yaTienen} | sin padre: ${sinPadre} | a actualizar: ${updates.length}`)
  await commitBatch(updates, 'ejerciciosDia')
}

async function backfillRegistros() {
  console.log('\n→ Backfilleando registros...')
  const [regSnap, sesionesSnap] = await Promise.all([
    db.collection('registros').get(),
    db.collection('sesiones').get(),
  ])
  const sesionToUsuario = {}
  sesionesSnap.docs.forEach(s => { sesionToUsuario[s.id] = s.data().usuarioId })

  const updates = []
  let sinPadre = 0
  let yaTienen = 0
  for (const r of regSnap.docs) {
    const data = r.data()
    if (data.usuarioId) { yaTienen++; continue }
    const usuarioId = sesionToUsuario[data.sesionId]
    if (!usuarioId) { sinPadre++; continue }
    updates.push({ ref: r.ref, usuarioId })
  }
  console.log(`  total: ${regSnap.size} | ya tienen: ${yaTienen} | sin padre: ${sinPadre} | a actualizar: ${updates.length}`)
  await commitBatch(updates, 'registros')
}

async function main() {
  console.log('=== Backfill usuarioId ===')
  await backfillDias()
  await backfillEjerciciosDia()
  await backfillRegistros()
  console.log('\n✓ Backfill completo')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
