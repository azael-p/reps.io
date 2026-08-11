// Normaliza los nombres de ejercicios de Fernando contra el catálogo, para que
// los gráficos de progreso dejen de partirse entre nombres duplicados
// ("Remo barra" vs "Remo con barra", "Prck deck" vs "Peck deck", etc).
//
// Actualiza IN PLACE (no duplica sesiones) en tres lugares:
//   - registros.nombreEjercicio / grupoMuscular / catalogoId
//   - ejerciciosDia.nombre / grupoMuscular / catalogoId
//   - sesiones.resumen.ejercicios[].nombre / grupoMuscular  ← lo que leen los gráficos
//
// Uso:
//   node scripts/migrarSesiones.js            → dry-run, no escribe nada
//   node scripts/migrarSesiones.js --aplicar  → escribe los cambios
//
// Idempotente: correrlo dos veces no cambia nada la segunda vez.

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const FERNANDO_UID = 'JkLFCW4UQrSuB0NiK8k6BTME1qM2'
const APLICAR = process.argv.includes('--aplicar')
const BATCH_SIZE = 490

// Nombre viejo → nombre canónico del catálogo.
// El grupo muscular NO se define acá: se toma del catálogo, así queda siempre coherente.
// Las marcadas con ⚠ son interpretaciones: revisalas antes de aplicar.
const MAPA_NOMBRES = {
  // Confirmados por Azael
  'Prck deck': 'Peck deck',
  'Aperturas en cable': 'Peck deck',

  // Abreviaturas obvias del mismo ejercicio
  'Curl barra': 'Curl con barra',
  'Remo barra': 'Remo con barra',
  'Press banca': 'Press de banca plano',
  'Pullover': 'Pullover en polea',
  'Curl inclinado': 'Curl inclinado con mancuernas',
  'Prensa': 'Prensa de piernas',
  'Fondos': 'Fondos (pecho)',
  'Remo polea': 'Remo en cable',
  'Extensiones': 'Extensión de cuádriceps',
  'Jalón al pecho': 'Jalón en polea frontal',
  'Antebrazo polea': 'Antebrazo en polea',
  'Curl invertido': 'Curl invertido con polea',
  'Encogimientos': 'Encogimientos con barra',
  'Press militar': 'Press militar con barra',
  'Francés': 'Press francés',
  'Pájaros': 'Vuelos posteriores',
  'Remo alto': 'Remo al mentón',
  'Extensión polea': 'Extensión en polea alta',
  'Polea tríceps': 'Extensión en polea alta',
  'Wrist curl': 'Curl de muñeca con barra',

  // Cuello
  'Flexion de cuello': 'Flexión de cuello con banda',
  'Flexión cuello': 'Flexión de cuello con banda',
  'Extension de cuello': 'Extensión de cuello con banda',
  'Extensión cuello': 'Extensión de cuello con banda',
  'Laterales cuello': 'Flexión lateral de cuello con banda',

  // ⚠ Ambiguos — mi mejor interpretación, confirmar
  'Jalón amplio': 'Jalón en polea frontal',        // ⚠ ¿o es agarre ancho aparte?
  'Aperturas': 'Peck deck',                        // ⚠ ¿o "Aperturas con mancuernas"?
  'Press inclinado': 'Press de banca inclinado',   // ⚠ ¿barra o mancuernas?
  'Curl femoral': 'Curl femoral sentado',          // ⚠ ¿sentado o tumbado?
  'Sentadilla': 'Sentadilla libre',                // ⚠
  'Zancadas': 'Zancadas caminando',                // ⚠ ¿caminando o con barra?
  'Gemelos': 'Elevación de talón de pie',          // ⚠ ¿de pie, sentado o en prensa?
}

function resolver(nombre, catalogoPorNombre) {
  const canonico = MAPA_NOMBRES[nombre] ?? nombre
  return catalogoPorNombre.get(canonico.toLowerCase()) ?? null
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
  console.log(`=== Migrar nombres de Fernando ${APLICAR ? '(APLICANDO)' : '(dry-run)'} ===`)

  const catSnap = await db.collection('ejerciciosCatalogo').get()
  const catalogoPorNombre = new Map(
    catSnap.docs.map(d => [d.data().nombre.toLowerCase(), { id: d.id, ...d.data() }])
  )

  const sinResolver = new Set()
  const cambios = new Map() // nombre viejo → nombre nuevo, para el resumen final

  // --- registros ---
  console.log('\n→ registros')
  const regSnap = await db.collection('registros').where('usuarioId', '==', FERNANDO_UID).get()
  const updRegistros = []
  for (const doc of regSnap.docs) {
    const r = doc.data()
    const cat = resolver(r.nombreEjercicio, catalogoPorNombre)
    if (!cat) { sinResolver.add(r.nombreEjercicio); continue }
    const campos = {}
    if (r.nombreEjercicio !== cat.nombre) campos.nombreEjercicio = cat.nombre
    if (r.grupoMuscular !== cat.grupoMuscular) campos.grupoMuscular = cat.grupoMuscular
    if (r.catalogoId !== cat.id) campos.catalogoId = cat.id
    if (Object.keys(campos).length === 0) continue
    if (campos.nombreEjercicio) cambios.set(r.nombreEjercicio, cat.nombre)
    updRegistros.push({ ref: doc.ref, campos })
  }
  console.log(`  ${regSnap.size} registros | ${updRegistros.length} a actualizar`)
  await commit(updRegistros, 'registros')

  // --- ejerciciosDia ---
  console.log('\n→ ejerciciosDia')
  const edSnap = await db.collection('ejerciciosDia').where('usuarioId', '==', FERNANDO_UID).get()
  const updEjercicios = []
  for (const doc of edSnap.docs) {
    const e = doc.data()
    const cat = resolver(e.nombre, catalogoPorNombre)
    if (!cat) { sinResolver.add(e.nombre); continue }
    const campos = {}
    if (e.nombre !== cat.nombre) campos.nombre = cat.nombre
    if (e.grupoMuscular !== cat.grupoMuscular) campos.grupoMuscular = cat.grupoMuscular
    if (e.catalogoId !== cat.id) campos.catalogoId = cat.id
    if (Object.keys(campos).length === 0) continue
    if (campos.nombre) cambios.set(e.nombre, cat.nombre)
    updEjercicios.push({ ref: doc.ref, campos })
  }
  console.log(`  ${edSnap.size} ejerciciosDia | ${updEjercicios.length} a actualizar`)
  await commit(updEjercicios, 'ejerciciosDia')

  // --- sesiones.resumen (lo que leen los gráficos) ---
  console.log('\n→ sesiones.resumen')
  const sesSnap = await db.collection('sesiones').where('usuarioId', '==', FERNANDO_UID).get()
  const updSesiones = []
  for (const doc of sesSnap.docs) {
    const s = doc.data()
    if (!s.resumen?.ejercicios?.length) continue
    let tocado = false
    const ejercicios = s.resumen.ejercicios.map(ej => {
      const cat = resolver(ej.nombre, catalogoPorNombre)
      if (!cat) { sinResolver.add(ej.nombre); return ej }
      if (ej.nombre === cat.nombre && ej.grupoMuscular === cat.grupoMuscular) return ej
      tocado = true
      cambios.set(ej.nombre, cat.nombre)
      return { ...ej, nombre: cat.nombre, grupoMuscular: cat.grupoMuscular }
    })
    if (tocado) updSesiones.push({ ref: doc.ref, campos: { resumen: { ...s.resumen, ejercicios } } })
  }
  console.log(`  ${sesSnap.size} sesiones | ${updSesiones.length} a actualizar`)
  await commit(updSesiones, 'sesiones')

  // --- resumen final ---
  if (cambios.size > 0) {
    console.log('\n=== Renombres ===')
    for (const [viejo, nuevo] of [...cambios].sort()) {
      if (viejo !== nuevo) console.log(`  "${viejo}" → "${nuevo}"`)
    }
  }
  if (sinResolver.size > 0) {
    console.log('\n=== ⚠ Sin match en el catálogo (quedan como están) ===')
    for (const n of [...sinResolver].sort()) console.log(`  "${n}"`)
    console.log('  → agregalos a MAPA_NOMBRES o al catálogo si querés normalizarlos.')
  }

  console.log(APLICAR ? '\n✓ Migración aplicada' : '\n✓ Dry-run listo. Corré con --aplicar para escribir.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
