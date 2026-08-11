// One-time: agrega ejercicios faltantes al catálogo, detectados al revisar
// las sesiones de Fernando (ver scripts/sesiones-fernando.json).
// Incluye el grupo muscular nuevo "Antebrazo".
//
// Prerequisitos:
//   1. Colocar la clave de servicio en scripts/serviceAccount.json
//   2. Ejecutar: node scripts/agregarEjerciciosCatalogo.js
//
// Idempotente: no agrega un ejercicio si ya existe uno con el mismo nombre.

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const NUEVOS = [
  { nombre: 'Peck deck', grupoMuscular: 'Pecho' },

  { nombre: 'Curl invertido con barra', grupoMuscular: 'Antebrazo' },
  { nombre: 'Curl invertido con polea', grupoMuscular: 'Antebrazo' },
  { nombre: 'Curl de muñeca con barra', grupoMuscular: 'Antebrazo' },
  { nombre: 'Curl de muñeca con mancuerna', grupoMuscular: 'Antebrazo' },
  { nombre: 'Extensión de muñeca con barra', grupoMuscular: 'Antebrazo' },
  { nombre: 'Antebrazo en polea', grupoMuscular: 'Antebrazo' },

  { nombre: 'Flexión de cuello con banda', grupoMuscular: 'Cuello' },
  { nombre: 'Extensión de cuello con banda', grupoMuscular: 'Cuello' },
  { nombre: 'Flexión lateral de cuello con banda', grupoMuscular: 'Cuello' },
  { nombre: 'Resistencia manual cuello', grupoMuscular: 'Cuello' },
]

async function main() {
  console.log('=== Agregar ejercicios al catálogo ===')
  const snap = await db.collection('ejerciciosCatalogo').get()
  const existentes = new Set(snap.docs.map(d => d.data().nombre.toLowerCase()))

  for (const ej of NUEVOS) {
    if (existentes.has(ej.nombre.toLowerCase())) {
      console.log(`  ↷ ya existe: ${ej.nombre}`)
      continue
    }
    const ref = await db.collection('ejerciciosCatalogo').add(ej)
    console.log(`  ✓ agregado: ${ej.nombre} (${ej.grupoMuscular}) → ${ref.id}`)
  }

  console.log('\n✓ Listo')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
