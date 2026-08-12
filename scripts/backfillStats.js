// Construye los agregados de paginación para todos los usuarios a partir de
// las sesiones completadas con `resumen`:
//   - usuarios/{uid}/stats/global               (diasEntrenados, volumenPorSesion)
//   - usuarios/{uid}/statsEjercicios/{docId}    (pr, ultimaVez, puntos)
//
// Réplica de la lógica de src/firebase/statsGlobal.js y statsEjercicios.js
// (no se importan porque esos módulos inicializan el SDK cliente).
//
// Uso:
//   node scripts/backfillStats.js            → dry-run, no escribe nada
//   node scripts/backfillStats.js --aplicar  → escribe los agregados
//
// Idempotente: reconstruye desde cero en cada corrida.

import admin from 'firebase-admin'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const APLICAR = process.argv.includes('--aplicar')
const MAX_VOLUMEN = 200
const MAX_PUNTOS = 150

const toDate = (x) => {
  if (!x) return null
  return typeof x.toDate === 'function' ? x.toDate() : new Date(x)
}

const epochDia = (fecha) => {
  const d = toDate(fecha)
  if (!d) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

const calcular1RM = (peso, reps) => {
  if (!peso || !reps || reps <= 1) return peso
  return Math.round(peso * (1 + reps / 30))
}

const esMismoEjercicio = (a, b) => {
  if (a.catalogoId && b.catalogoId) return a.catalogoId === b.catalogoId
  return a.nombre === b.nombre
}

const statsDocId = (ejercicio) => {
  if (ejercicio.catalogoId) return ejercicio.catalogoId
  const slug = ejercicio.nombre
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `n_${slug}`
}

function mergeSesion(prev, ej, fechaMs, sesionId) {
  const series = ej.series ?? []
  const pesoMax = Math.max(0, ...series.map(s => s.pesoUsado || 0))
  const oneRm = Math.max(0, ...series.map(s => calcular1RM(s.pesoUsado || 0, s.repsHechas || 0) || 0))
  const volSerie = Math.max(0, ...series.map(s => Math.round((s.pesoUsado || 0) * (s.repsHechas || 0))))

  const base = prev ?? {
    nombre: ej.nombre,
    grupoMuscular: ej.grupoMuscular ?? '',
    catalogoId: ej.catalogoId ?? null,
    pr: null, ultimaVez: null, puntos: [],
  }
  const pr = (pesoMax > 0 && (!base.pr || pesoMax > base.pr.maxPeso))
    ? { maxPeso: pesoMax, fecha: fechaMs, sesionId, series }
    : base.pr
  const ultimaVez = (!base.ultimaVez || fechaMs >= base.ultimaVez.fecha)
    ? { fecha: fechaMs, sesionId, series }
    : base.ultimaVez
  const puntos = [...base.puntos.filter(p => p.sesionId !== sesionId), { fecha: fechaMs, sesionId, pesoMax, oneRm, volSerie }]
    .sort((a, b) => a.fecha - b.fecha)
    .slice(-MAX_PUNTOS)

  return { ...base, catalogoId: base.catalogoId ?? ej.catalogoId ?? null, pr, ultimaVez, puntos }
}

async function main() {
  const usuariosSnap = await db.collection('usuarios').get()
  console.log(`${usuariosSnap.size} usuarios · modo: ${APLICAR ? 'APLICAR' : 'dry-run'}\n`)

  for (const userDoc of usuariosSnap.docs) {
    const uid = userDoc.id
    const sesionesSnap = await db.collection('sesiones')
      .where('usuarioId', '==', uid)
      .where('completada', '==', true)
      .get()

    const sesiones = sesionesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toDate(a.fecha)?.getTime() ?? 0) - (toDate(b.fecha)?.getTime() ?? 0)) // asc

    // resumenGlobal
    const dias = new Set()
    const volumen = []
    for (const s of sesiones) {
      const e = epochDia(s.fecha)
      if (e !== null) dias.add(e)
      if (s.resumen?.volumenTotal > 0) {
        volumen.push({
          sesionId: s.id,
          fecha: toDate(s.fecha)?.getTime() ?? 0,
          volumen: s.resumen.volumenTotal,
          diaNombre: s.resumen?.diaNombre ?? '',
        })
      }
    }
    const resumenGlobal = {
      diasEntrenados: [...dias].sort((a, b) => a - b),
      volumenPorSesion: volumen.slice(-MAX_VOLUMEN),
    }

    // statsEjercicios
    const porId = {}
    for (const s of sesiones) {
      const fechaMs = toDate(s.fecha)?.getTime() ?? 0
      for (const ej of s.resumen?.ejercicios ?? []) {
        const id = statsDocId(ej)
        // esMismoEjercicio con fallback a nombre: si ya existe un doc para
        // este catalogoId/nombre, mergear sobre ese.
        const clave = Object.keys(porId).find(k => esMismoEjercicio(porId[k], ej)) ?? id
        porId[clave] = mergeSesion(porId[clave] ?? null, ej, fechaMs, s.id)
      }
    }

    console.log(`${uid}: ${sesiones.length} sesiones → ${resumenGlobal.diasEntrenados.length} días, ${Object.keys(porId).length} ejercicios`)

    if (APLICAR) {
      const batch = db.batch()
      batch.set(db.doc(`usuarios/${uid}/stats/global`), resumenGlobal)
      for (const [id, stats] of Object.entries(porId)) {
        batch.set(db.doc(`usuarios/${uid}/statsEjercicios/${id}`), stats)
      }
      await batch.commit()
      console.log(`  ✓ escrito`)
    }
  }

  console.log(APLICAR ? '\nListo.' : '\nDry-run terminado. Correr con --aplicar para escribir.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
