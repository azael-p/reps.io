// Exporta las últimas 7 sesiones completadas de Fernando a un JSON legible
// para revisión manual antes de migrar al catálogo nuevo.
//
// Prerequisitos:
//   1. Colocar la clave de servicio en scripts/serviceAccount.json
//   2. Ejecutar: node scripts/exportarSesiones.js
//
// Resultado: scripts/sesiones-fernando.json

import admin from 'firebase-admin'
import { createRequire } from 'module'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const FERNANDO_UID = 'JkLFCW4UQrSuB0NiK8k6BTME1qM2'
const CANTIDAD_SESIONES = 7

const __dirname = dirname(fileURLToPath(import.meta.url))

function toFechaISO(fecha) {
  if (fecha?.toDate) return fecha.toDate().toISOString().slice(0, 10)
  return null
}

async function main() {
  console.log('=== Exportar sesiones de Fernando ===')

  const sesionesSnap = await db.collection('sesiones')
    .where('usuarioId', '==', FERNANDO_UID)
    .where('completada', '==', true)
    .get()

  const sesiones = sesionesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0))
    .slice(0, CANTIDAD_SESIONES)

  console.log(`  Sesiones encontradas: ${sesionesSnap.size} | exportando: ${sesiones.length}`)

  const resultado = []

  for (const sesion of sesiones) {
    const registrosSnap = await db.collection('registros')
      .where('usuarioId', '==', FERNANDO_UID)
      .where('sesionId', '==', sesion.id)
      .get()

    const registros = registrosSnap.docs
      .map(d => d.data())
      .sort((a, b) => a.numeroSerie - b.numeroSerie)

    const ejerciciosMap = {}
    for (const r of registros) {
      const key = r.ejercicioId || r.nombreEjercicio
      if (!ejerciciosMap[key]) {
        ejerciciosMap[key] = {
          nombreOriginal: r.nombreEjercicio,
          ejercicioId: r.ejercicioId || null,
          series: [],
        }
      }
      ejerciciosMap[key].series.push({
        numeroSerie: r.numeroSerie,
        pesoUsado: r.pesoUsado,
        repsHechas: r.repsHechas,
      })
    }

    resultado.push({
      sesionId: sesion.id,
      fecha: toFechaISO(sesion.fecha),
      diaId: sesion.diaId,
      ejercicios: Object.values(ejerciciosMap),
    })

    console.log(`  → sesión ${sesion.id} (${toFechaISO(sesion.fecha)}): ${registros.length} registros, ${Object.keys(ejerciciosMap).length} ejercicios`)
  }

  const outPath = join(__dirname, 'sesiones-fernando.json')
  writeFileSync(outPath, JSON.stringify(resultado, null, 2))
  console.log(`\n✓ Exportado a ${outPath}`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
