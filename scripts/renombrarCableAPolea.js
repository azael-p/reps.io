// Reemplaza "cable" por "polea" en la terminología del catálogo, y cascadea
// el rename a todo el historial ya cargado (de cualquier usuario) para que
// los gráficos de progreso no se rompan en dos series con nombres distintos.
//
// Actualiza:
//   - ejerciciosCatalogo/{id}.nombre
//   - ejerciciosDia.nombre / grupoMuscular / catalogoId  (todos los usuarios)
//   - registros.nombreEjercicio / grupoMuscular / catalogoId  (todos los usuarios)
//   - sesiones.resumen.ejercicios[].nombre / grupoMuscular  (todos los usuarios)
//
// Uso:
//   node scripts/renombrarCableAPolea.js            → dry-run, no escribe nada
//   node scripts/renombrarCableAPolea.js --aplicar  → escribe los cambios
//
// Idempotente: correrlo dos veces no cambia nada la segunda vez.

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const APLICAR = process.argv.includes('--aplicar')
const BATCH_SIZE = 490

// catalogoId → nombre nuevo
const RENOMBRES = {
  'aperturas-cable': 'Aperturas en polea',
  'cable-crunch': 'Crunch en polea',
  'crossover-cable': 'Crossover en polea',
  'curl-cable-polea-baja': 'Curl en polea baja',
  'elevaciones-laterales-cable': 'Elevaciones laterales polea',
  'remo-cable': 'Remo en polea',
}

async function commit(updates, label) {
  if (updates.length === 0) { console.log(`  ${label}: sin cambios`); return }
  if (!APLICAR) { console.log(`  ${label}: ${updates.length} docs cambiarían (dry-run)`); return }
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE)
    const batch = db.batch()
    chunk.forEach(({ ref, campos }) => batch.update(ref, campos))
    await batch.commit()
    console.log(`  ${label}: batch ${Math.floor(i / BATCH_SIZE) + 1} → ${chunk.length} docs`)
  }
}

async function main() {
  console.log(`=== Renombrar cable → polea en el catálogo ${APLICAR ? '(APLICANDO)' : '(dry-run)'} ===`)

  const catSnap = await db.collection('ejerciciosCatalogo').get()
  const catalogoPorId = new Map(catSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]))

  // catalogoId → { viejo, nuevo, grupoMuscular }
  const cambios = new Map()
  for (const [id, nuevo] of Object.entries(RENOMBRES)) {
    const actual = catalogoPorId.get(id)
    if (!actual) { console.log(`  ⚠ catalogoId "${id}" no existe, se ignora`); continue }
    if (actual.nombre === nuevo) continue // ya renombrado, idempotente
    cambios.set(id, { viejo: actual.nombre, nuevo, grupoMuscular: actual.grupoMuscular })
  }

  if (cambios.size === 0) {
    console.log('\nNada para renombrar (ya está todo aplicado).')
    process.exit(0)
  }

  const viejoANuevo = new Map([...cambios.values()].map(c => [c.viejo, c]))

  // --- catálogo ---
  console.log('\n→ ejerciciosCatalogo')
  const updCatalogo = [...cambios.entries()].map(([id, c]) => ({
    ref: db.collection('ejerciciosCatalogo').doc(id),
    campos: { nombre: c.nuevo },
  }))
  for (const c of cambios.values()) console.log(`  "${c.viejo}" → "${c.nuevo}"`)
  await commit(updCatalogo, 'ejerciciosCatalogo')

  // --- ejerciciosDia (todos los usuarios) ---
  console.log('\n→ ejerciciosDia (todos los usuarios)')
  const edSnap = await db.collection('ejerciciosDia').get()
  const updEjercicios = []
  for (const doc of edSnap.docs) {
    const e = doc.data()
    const c = viejoANuevo.get(e.nombre)
    if (!c) continue
    const catalogoId = [...cambios.entries()].find(([, v]) => v === c)?.[0]
    updEjercicios.push({ ref: doc.ref, campos: { nombre: c.nuevo, grupoMuscular: c.grupoMuscular, catalogoId } })
  }
  console.log(`  ${edSnap.size} ejerciciosDia | ${updEjercicios.length} a actualizar`)
  await commit(updEjercicios, 'ejerciciosDia')

  // --- registros (todos los usuarios) ---
  console.log('\n→ registros (todos los usuarios)')
  const regSnap = await db.collection('registros').get()
  const updRegistros = []
  for (const doc of regSnap.docs) {
    const r = doc.data()
    const c = viejoANuevo.get(r.nombreEjercicio)
    if (!c) continue
    const catalogoId = [...cambios.entries()].find(([, v]) => v === c)?.[0]
    updRegistros.push({ ref: doc.ref, campos: { nombreEjercicio: c.nuevo, grupoMuscular: c.grupoMuscular, catalogoId } })
  }
  console.log(`  ${regSnap.size} registros | ${updRegistros.length} a actualizar`)
  await commit(updRegistros, 'registros')

  // --- sesiones.resumen (todos los usuarios) ---
  console.log('\n→ sesiones.resumen (todos los usuarios)')
  const sesSnap = await db.collection('sesiones').get()
  const updSesiones = []
  for (const doc of sesSnap.docs) {
    const s = doc.data()
    if (!s.resumen?.ejercicios?.length) continue
    let tocado = false
    const ejercicios = s.resumen.ejercicios.map(ej => {
      const c = viejoANuevo.get(ej.nombre)
      if (!c) return ej
      tocado = true
      return { ...ej, nombre: c.nuevo, grupoMuscular: c.grupoMuscular }
    })
    if (tocado) updSesiones.push({ ref: doc.ref, campos: { resumen: { ...s.resumen, ejercicios } } })
  }
  console.log(`  ${sesSnap.size} sesiones | ${updSesiones.length} a actualizar`)
  await commit(updSesiones, 'sesiones')

  console.log(APLICAR ? '\n✓ Rename aplicado' : '\n✓ Dry-run listo. Corré con --aplicar para escribir.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
