// Denormaliza `programaNombre` dentro de `sesiones/{id}.resumen`, igual que ya
// se guarda `diaNombre`. Sin ese campo, borrar un programa deja el historial
// mostrando '–' para siempre (el nombre solo vivía en el doc del programa).
//
// Solo se puede backfillear una sesión cuyo día Y programa sigan existiendo:
// si ya fueron borrados, el nombre no está en ningún lado y no hay nada que
// recuperar. El script las reporta aparte en vez de inventar un valor.
//
// Uso:
//   node scripts/backfillProgramaNombre.js            → dry-run, no escribe nada
//   node scripts/backfillProgramaNombre.js --aplicar  → escribe los cambios
//
// Idempotente: una sesión que ya tiene el campo se saltea.

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const APLICAR = process.argv.includes('--aplicar')

async function main() {
  const [sesionesSnap, diasSnap, programasSnap] = await Promise.all([
    db.collection('sesiones').where('completada', '==', true).get(),
    db.collection('dias').get(),
    db.collection('programas').get(),
  ])

  const dias = {}
  diasSnap.docs.forEach(d => { dias[d.id] = d.data() })
  const programas = {}
  programasSnap.docs.forEach(d => { programas[d.id] = d.data() })

  console.log(`${sesionesSnap.size} sesiones completadas · modo: ${APLICAR ? 'APLICAR' : 'dry-run'}\n`)

  const pendientes = []
  let yaTenian = 0
  let sinResumen = 0
  const irrecuperables = []

  for (const doc of sesionesSnap.docs) {
    const s = doc.data()
    if (!s.resumen) { sinResumen++; continue }
    if (typeof s.resumen.programaNombre === 'string') { yaTenian++; continue }

    const dia = dias[s.diaId]
    const nombre = dia ? programas[dia.programaId]?.nombre : undefined
    if (!nombre) { irrecuperables.push(doc.id); continue }

    pendientes.push({ id: doc.id, nombre })
  }

  console.log(`  ya tenían el campo:            ${yaTenian}`)
  console.log(`  sin resumen (nada que tocar):  ${sinResumen}`)
  console.log(`  a backfillear:                 ${pendientes.length}`)
  console.log(`  irrecuperables (día/programa ya borrado): ${irrecuperables.length}`)
  if (irrecuperables.length) console.log(`    ${irrecuperables.join(', ')}`)

  if (pendientes.length && APLICAR) {
    // Un merge por sesión sobre el campo anidado: no reescribe el resto del
    // resumen (ejercicios/series), que es lo único irreemplazable acá.
    const batch = db.batch()
    for (const { id, nombre } of pendientes) {
      batch.update(db.doc(`sesiones/${id}`), { 'resumen.programaNombre': nombre })
    }
    await batch.commit()
    console.log(`\n✓ ${pendientes.length} sesiones actualizadas`)
  }

  console.log(APLICAR ? '\nListo.' : '\nDry-run terminado. Correr con --aplicar para escribir.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
