// Carga la rutina de 5 días (foto pasada por Azael) en su cuenta.
// Completa el día "pecho 1" ya existente (que ya tenía Press de banca plano
// cargado a mano) y crea los 4 días restantes dentro del programa "RUTINA".
//
// Uso:
//   node scripts/cargarRutinaAzael.js            → dry-run, no escribe nada
//   node scripts/cargarRutinaAzael.js --aplicar  → escribe los cambios
//
// Idempotente: si un día con el mismo nombre ya existe en el programa, no lo
// vuelve a crear; si un ejercicio con el mismo catalogoId ya está en el día
// (por orden), no lo duplica.

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const APLICAR = process.argv.includes('--aplicar')
const USUARIO_ID = 'T05RaIKdQ9SNWCSEn0eydg7OyC83'
const PROGRAMA_ID = 'yC6pa4Lp2Cw3gZevnGhn' // "RUTINA"

// reps en rango → se guarda el número más bajo (acordado con Azael)
const DIAS = [
  {
    nombre: 'pecho 1',
    orden: 0,
    ejercicios: [
      { catalogoId: 'press-banca-plano', series: 4, reps: 8 },
      { catalogoId: 'ytjs0ik57xacP5AaLSlH', series: 3, reps: 12 }, // Peck deck
      { catalogoId: 'press-mancuernas-inclinado', series: 3, reps: 12 },
      { catalogoId: 'extension-triceps-polea', series: 3, reps: 8 },
      { catalogoId: 'extension-triceps-cabeza', series: 3, reps: 12 },
      { catalogoId: 'vuelos-posteriores', series: 3, reps: 10 },
    ],
  },
  {
    nombre: 'espalda 1',
    orden: 1,
    ejercicios: [
      { catalogoId: 'jalon-polea-frontal', series: 4, reps: 10 },
      { catalogoId: 'pull-over-polea', series: 3, reps: 12 },
      { catalogoId: 'remo-cable', series: 3, reps: 10 },
      { catalogoId: 'curl-predicador', series: 4, reps: 8 },
      { catalogoId: 'curl-inclinado', series: 3, reps: 8 },
      { catalogoId: 'elevaciones-laterales', series: 3, reps: 12 },
    ],
  },
  {
    nombre: 'pierna',
    orden: 2,
    ejercicios: [
      { catalogoId: 'sentadilla-libre', series: 3, reps: 8 },
      { catalogoId: 'peso-muerto-rumano', series: 4, reps: 6 },
      { catalogoId: 'prensa-piernas', series: 3, reps: 8 },
      { catalogoId: 'curl-femoral-sentado', series: 3, reps: 8 },
      { catalogoId: 'extension-cuadriceps', series: 4, reps: 12 },
    ],
  },
  {
    nombre: 'pecho 2',
    orden: 3,
    ejercicios: [
      { catalogoId: 'press-banca-plano', series: 4, reps: 8 },
      { catalogoId: 'press-mancuernas-inclinado', series: 2, reps: 12 },
      { catalogoId: 'ytjs0ik57xacP5AaLSlH', series: 3, reps: 8 }, // Peck deck
      { catalogoId: 'press-militar', series: 3, reps: 6 },
      { catalogoId: 'elevaciones-laterales', series: 3, reps: 12 },
      { catalogoId: 'vuelos-posteriores', series: 3, reps: 10 },
    ],
  },
  {
    nombre: 'espalda 2',
    orden: 4,
    ejercicios: [
      { catalogoId: 'jalon-polea-frontal', series: 4, reps: 12 },
      { catalogoId: 'remo-cable', series: 3, reps: 10 }, // "remo cerrado en polea"
      { catalogoId: 'curl-predicador', series: 3, reps: 10 },
      { catalogoId: 'curl-inclinado', series: 3, reps: 12 },
      { catalogoId: 'extension-triceps-cabeza', series: 2, reps: 15 },
      { catalogoId: 'extension-triceps-polea', series: 3, reps: 10 },
    ],
  },
]

async function main() {
  console.log(`=== Cargar rutina de Azael ${APLICAR ? '(APLICANDO)' : '(dry-run)'} ===`)

  const catSnap = await db.collection('ejerciciosCatalogo').get()
  const catalogoPorId = new Map(catSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]))

  const diasExistentesSnap = await db.collection('dias').where('programaId', '==', PROGRAMA_ID).get()
  const diaIdPorNombre = new Map(diasExistentesSnap.docs.map(d => [d.data().nombre, d.id]))

  for (const dia of DIAS) {
    let diaId = dia.diaId ?? diaIdPorNombre.get(dia.nombre)

    if (!diaId) {
      console.log(`\n→ crear día "${dia.nombre}" (orden ${dia.orden})`)
      if (APLICAR) {
        const ref = await db.collection('dias').add({
          usuarioId: USUARIO_ID, programaId: PROGRAMA_ID, nombre: dia.nombre, orden: dia.orden,
        })
        diaId = ref.id
        console.log(`  ✓ creado: ${diaId}`)
      } else {
        console.log('  (dry-run, no se crea)')
      }
    } else {
      console.log(`\n→ día "${dia.nombre}" ya existe: ${diaId}`)
    }

    const existentesSnap = diaId
      ? await db.collection('ejerciciosDia').where('diaId', '==', diaId).get()
      : { docs: [] }
    const catalogoIdsExistentes = new Set(existentesSnap.docs.map(d => d.data().catalogoId).filter(Boolean))
    const ordenBase = existentesSnap.docs.length

    let i = 0
    for (const ej of dia.ejercicios) {
      const cat = catalogoPorId.get(ej.catalogoId)
      if (!cat) { console.log(`  ⚠ catalogoId "${ej.catalogoId}" no existe en el catálogo, se saltea`); continue }
      if (catalogoIdsExistentes.has(ej.catalogoId)) {
        console.log(`  ↷ ya existe: ${cat.nombre}`)
        continue
      }
      const orden = ordenBase + i
      console.log(`  + ${cat.nombre} [${cat.grupoMuscular}] — ${ej.series}x${ej.reps} (orden ${orden})`)
      if (APLICAR && diaId) {
        await db.collection('ejerciciosDia').add({
          diaId, usuarioId: USUARIO_ID,
          nombre: cat.nombre, grupoMuscular: cat.grupoMuscular,
          esCustom: false, catalogoId: cat.id,
          seriesEsperadas: ej.series, repsEsperadas: ej.reps,
          orden,
        })
      }
      i++
    }
  }

  console.log(APLICAR ? '\n✓ Rutina cargada' : '\n✓ Dry-run listo. Corré con --aplicar para escribir.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
