// Genera un reporte de actividad (sesiones registradas por usuario y cuándo,
// usuarios activos, salud básica de adopción) a partir de fuentes baratas:
//   - Firebase Auth (getAuth().listUsers())        → alta, último login
//   - usuarios/{uid}/stats/global.diasEntrenados        → días entrenados (1 lectura/usuario)
//   - sesiones (count() agregado, opcional)             → total exacto de sesiones
//
// Por defecto suma además una vista de detalle por usuario (historial de
// sesiones con ejercicios y series, rutinas guardadas), que sale de 4 queries
// globales: sesiones completadas, programas, dias y ejerciciosDia. Se agrupan
// por usuarioId en memoria, no hay una query por usuario.
//
// diasEntrenados dedupica por día calendario: si un usuario entrena 2 veces
// el mismo día, esta métrica NO lo refleja. Por eso se compara contra el
// total de `sesiones` (sesionesTotal) y se marca la fila si difieren.
//
// Read-only: nunca escribe en Firestore. No hay modo --aplicar.
//
// Uso:
//   node scripts/reporteActividad.js                        → ventana de 30 días, con detalle
//   node scripts/reporteActividad.js --dias=90               → ventana de 90 días
//   node scripts/reporteActividad.js --sin-detalle           → solo métricas agregadas (modo barato)
//   node scripts/reporteActividad.js --sin-conteo-sesiones   → salta el count() sobre sesiones
//                                                              (solo aplica con --sin-detalle)
//
// Salida en scripts/reportes/ (gitignored, contiene PII de usuarios):
//   actividad-<fecha>.json / actividad-<fecha>.html
//   ultimo.json / ultimo.html   (siempre apuntan a la corrida más reciente)

import { mkdir, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'

import {
  cargarUsuariosAuth, cargarUsuariosFirestore, cargarStatsGlobal,
  contarSesiones, cargarDetalleGlobal,
} from './reporte-actividad/carga.js'
import {
  calcularStreaks, formatearFecha, agregarSerieDiaria, construirResumenGlobal,
  indexarDiaAPrograma, construirDetalleUsuario,
} from './reporte-actividad/transformar.js'
import { renderizarHTML } from './reporte-actividad/html.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const argDias = process.argv.find(a => a.startsWith('--dias='))
const DIAS = argDias ? parseInt(argDias.split('=')[1], 10) : 30
const CON_DETALLE = !process.argv.includes('--sin-detalle')
const CON_CONTEO_SESIONES = !process.argv.includes('--sin-conteo-sesiones')

async function construirReportePorUsuario(uid, perfilFs, perfilAuth, detalle) {
  const stats = await cargarStatsGlobal(uid)
  const diasEntrenadosEpochs = stats.diasEntrenados ?? []
  const { actual: rachaActual, maxima: rachaMaxima } = calcularStreaks(diasEntrenadosEpochs)
  const ultimaSesionEpoch = diasEntrenadosEpochs.length ? Math.max(...diasEntrenadosEpochs) : null

  // Con detalle el total sale de las sesiones ya cargadas; sin detalle hace
  // falta el count() agregado, que es 1 lectura facturada por usuario.
  const sesionesTotal = detalle
    ? detalle.sesiones.length
    : (CON_CONTEO_SESIONES ? await contarSesiones(uid) : null)

  return {
    uid,
    nombre: perfilFs?.nombre ?? perfilAuth?.email ?? uid,
    // Auth primero: el email de Firestore es autodeclarado por el usuario
    // (las reglas no lo comparan contra request.auth.token.email).
    email: perfilAuth?.email ?? perfilFs?.email ?? null,
    creadoEn: perfilAuth?.creationTime ?? null,
    ultimoLogin: perfilAuth?.lastSignInTime ?? null,
    diasEntrenados: diasEntrenadosEpochs.length,
    diasEntrenadosEpochs,
    ultimaSesion: ultimaSesionEpoch !== null ? formatearFecha(ultimaSesionEpoch) : null,
    rachaActual,
    rachaMaxima,
    sesionesTotal,
    sesionesVsDias: sesionesTotal !== null && sesionesTotal > diasEntrenadosEpochs.length,
    detalle,
  }
}

function imprimirResumenConsola(resumen, usuariosReporte) {
  console.log(`\n=== Reporte de actividad (ventana ${DIAS} días) ===\n`)
  console.log(`Usuarios Auth: ${resumen.totalUsuariosAuth} · Usuarios con perfil Firestore: ${resumen.totalUsuariosFirestore}`)
  if (resumen.usuariosSinPerfil.length) {
    console.log(`  ⚠ sin perfil Firestore: ${resumen.usuariosSinPerfil.join(', ')}`)
  }
  if (resumen.usuariosSinAuth.length) {
    console.log(`  ⚠ perfil Firestore sin cuenta Auth: ${resumen.usuariosSinAuth.join(', ')}`)
  }
  console.log(`Activos últimos 7 días: ${resumen.activos7d} · últimos 30 días: ${resumen.activos30d}`)
  console.log(`Promedio de días entrenados por usuario activo: ${resumen.promedioDiasPorUsuarioActivo}\n`)

  console.table(usuariosReporte.map(u => ({
    nombre: u.nombre,
    email: u.email,
    diasEntrenados: u.diasEntrenados,
    sesionesTotal: u.sesionesTotal ?? '—',
    '2x/día?': u.sesionesVsDias ? 'sí' : '',
    ultimaSesion: u.ultimaSesion ?? '—',
    rachaActual: u.rachaActual,
    rachaMaxima: u.rachaMaxima,
  })))
}

async function main() {
  const [authMap, fsMap, crudo] = await Promise.all([
    cargarUsuariosAuth(),
    cargarUsuariosFirestore(),
    CON_DETALLE ? cargarDetalleGlobal() : Promise.resolve(null),
  ])
  const uids = new Set([...authMap.keys(), ...fsMap.keys()])

  if (crudo) {
    console.log(`Detalle: ${crudo.sesiones.length} sesiones, ${crudo.programas.length} programas, ${crudo.dias.length} días, ${crudo.ejerciciosDia.length} ejercicios.`)
  }

  const diaAPrograma = crudo ? indexarDiaAPrograma(crudo.programas, crudo.dias) : null

  const usuarios = []
  for (const uid of uids) {
    const detalle = crudo ? construirDetalleUsuario(uid, crudo, diaAPrograma) : null
    usuarios.push(await construirReportePorUsuario(uid, fsMap.get(uid), authMap.get(uid), detalle))
  }
  usuarios.sort((a, b) => (b.ultimaSesion ?? '').localeCompare(a.ultimaSesion ?? ''))

  const resumen = construirResumenGlobal(usuarios, authMap, fsMap)
  const serieDiaria = agregarSerieDiaria(usuarios, DIAS)
  const payload = { generadoEn: new Date().toISOString(), ventanaDias: DIAS, resumen, usuarios, serieDiaria }

  imprimirResumenConsola(resumen, usuarios)

  const dirReportes = path.join(__dirname, 'reportes')
  await mkdir(dirReportes, { recursive: true })
  const fecha = formatearFecha(Date.now())
  const json = JSON.stringify(payload, null, 2)
  const html = renderizarHTML(payload)

  await Promise.all([
    writeFile(path.join(dirReportes, `actividad-${fecha}.json`), json),
    writeFile(path.join(dirReportes, `actividad-${fecha}.html`), html),
    writeFile(path.join(dirReportes, 'ultimo.json'), json),
    writeFile(path.join(dirReportes, 'ultimo.html'), html),
  ])

  const kb = Math.round(Buffer.byteLength(html) / 1024)
  console.log(`\nReporte escrito en scripts/reportes/ (actividad-${fecha}.* y ultimo.*, HTML ${kb} kB)`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
