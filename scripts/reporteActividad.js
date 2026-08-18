// Genera un reporte de actividad (sesiones registradas por usuario y cuándo,
// usuarios activos, salud básica de adopción) a partir de fuentes baratas:
//   - Firebase Auth (getAuth().listUsers())        → alta, último login
//   - usuarios/{uid}/stats/global.diasEntrenados        → días entrenados (1 lectura/usuario)
//   - sesiones (count() agregado, opcional)             → total exacto de sesiones
//
// diasEntrenados dedupica por día calendario: si un usuario entrena 2 veces
// el mismo día, esta métrica NO lo refleja. Por eso se compara contra el
// count() de `sesiones` (sesionesTotal) y se marca la fila si difieren.
//
// Read-only: nunca escribe en Firestore. No hay modo --aplicar.
//
// Uso:
//   node scripts/reporteActividad.js                        → ventana de 30 días
//   node scripts/reporteActividad.js --dias=90               → ventana de 90 días
//   node scripts/reporteActividad.js --sin-conteo-sesiones   → salta el count() sobre sesiones
//
// Salida en scripts/reportes/ (gitignored, contiene PII de usuarios):
//   actividad-<fecha>.json / actividad-<fecha>.html
//   ultimo.json / ultimo.html   (siempre apuntan a la corrida más reciente)

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { createRequire } from 'module'
import { mkdir, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'

const require = createRequire(import.meta.url)
const serviceAccount = require('./serviceAccount.json')
const __dirname = path.dirname(fileURLToPath(import.meta.url))

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()
const auth = getAuth()

const argDias = process.argv.find(a => a.startsWith('--dias='))
const DIAS = argDias ? parseInt(argDias.split('=')[1], 10) : 30
const CON_CONTEO_SESIONES = !process.argv.includes('--sin-conteo-sesiones')

const DIA_MS = 86400000

// Réplica de src/utils/stats.js#calcularStreaks (no se importa: ese módulo
// importa de otro archivo sin extensión de archivo, válido bajo el resolver
// de Vite pero no bajo ESM nativo de Node).
function calcularStreaks(epochsDias) {
  if (!epochsDias || epochsDias.length === 0) return { actual: 0, maxima: 0 }

  const unicas = [...new Set(epochsDias)].sort((a, b) => b - a).map(t => new Date(t))

  let actual = 1
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const diffHoy = Math.round((hoy - unicas[0]) / DIA_MS)
  if (diffHoy > 1) {
    actual = 0
  } else {
    for (let i = 1; i < unicas.length; i++) {
      const diff = Math.round((unicas[i - 1] - unicas[i]) / DIA_MS)
      if (diff === 1) actual++
      else break
    }
  }

  let maxima = 1
  let temp = 1
  for (let i = 1; i < unicas.length; i++) {
    const diff = Math.round((unicas[i - 1] - unicas[i]) / DIA_MS)
    if (diff === 1) { temp++; if (temp > maxima) maxima = temp }
    else { temp = 1 }
  }

  return { actual, maxima }
}

function formatearFecha(epochMs) {
  const d = new Date(epochMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

async function cargarUsuariosAuth() {
  const map = new Map()
  let pageToken
  do {
    const res = await auth.listUsers(1000, pageToken)
    for (const u of res.users) {
      map.set(u.uid, {
        email: u.email ?? null,
        creationTime: u.metadata.creationTime ?? null,
        lastSignInTime: u.metadata.lastSignInTime ?? null,
      })
    }
    pageToken = res.pageToken
  } while (pageToken)
  return map
}

async function cargarUsuariosFirestore() {
  const snap = await db.collection('usuarios').get()
  const map = new Map()
  for (const doc of snap.docs) map.set(doc.id, doc.data())
  return map
}

async function cargarStatsGlobal(uid) {
  const snap = await db.doc(`usuarios/${uid}/stats/global`).get()
  return snap.exists ? snap.data() : { diasEntrenados: [] }
}

async function contarSesiones(uid) {
  const snap = await db.collection('sesiones')
    .where('usuarioId', '==', uid)
    .where('completada', '==', true)
    .count()
    .get()
  return snap.data().count
}

async function construirReportePorUsuario(uid, perfilFs, perfilAuth) {
  const stats = await cargarStatsGlobal(uid)
  const diasEntrenadosEpochs = stats.diasEntrenados ?? []
  const { actual: rachaActual, maxima: rachaMaxima } = calcularStreaks(diasEntrenadosEpochs)
  const ultimaSesionEpoch = diasEntrenadosEpochs.length ? Math.max(...diasEntrenadosEpochs) : null
  const sesionesTotal = CON_CONTEO_SESIONES ? await contarSesiones(uid) : null

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
  }
}

function agregarSerieDiaria(usuariosReporte, dias) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const cutoff = hoy.getTime() - (dias - 1) * DIA_MS

  const porDia = new Map()
  for (const u of usuariosReporte) {
    for (const e of u.diasEntrenadosEpochs) {
      if (e < cutoff) continue
      if (!porDia.has(e)) porDia.set(e, { diasEntrenados: 0, usuarios: new Set() })
      const bucket = porDia.get(e)
      bucket.diasEntrenados++
      bucket.usuarios.add(u.uid)
    }
  }

  const serie = []
  for (let t = cutoff; t <= hoy.getTime(); t += DIA_MS) {
    const bucket = porDia.get(t)
    serie.push({
      fecha: formatearFecha(t),
      diasEntrenados: bucket?.diasEntrenados ?? 0,
      usuariosActivos: bucket?.usuarios.size ?? 0,
    })
  }
  return serie
}

function construirResumenGlobal(usuariosReporte, authMap, fsMap) {
  const cutoff7 = Date.now() - 7 * DIA_MS
  const cutoff30 = Date.now() - 30 * DIA_MS
  const activos7d = usuariosReporte.filter(u => u.diasEntrenadosEpochs.some(e => e >= cutoff7)).length
  const activos30d = usuariosReporte.filter(u => u.diasEntrenadosEpochs.some(e => e >= cutoff30)).length
  const usuariosSinPerfil = [...authMap.keys()].filter(uid => !fsMap.has(uid))
  const usuariosSinAuth = [...fsMap.keys()].filter(uid => !authMap.has(uid))

  const activosAlguna = usuariosReporte.filter(u => u.diasEntrenados > 0)
  const promedioDiasPorUsuarioActivo = activosAlguna.length > 0
    ? Math.round((activosAlguna.reduce((acc, u) => acc + u.diasEntrenados, 0) / activosAlguna.length) * 10) / 10
    : 0

  return {
    totalUsuariosAuth: authMap.size,
    totalUsuariosFirestore: fsMap.size,
    usuariosSinPerfil,
    usuariosSinAuth,
    activos7d,
    activos30d,
    promedioDiasPorUsuarioActivo,
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

function formatearFechaCorta(fechaISO) {
  return new Date(`${fechaISO}T00:00:00`)
    .toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

function renderizarHTML(payload) {
  const { generadoEn, ventanaDias, resumen, usuarios, serieDiaria } = payload
  const maxDias = Math.max(1, ...serieDiaria.map(d => d.diasEntrenados))
  const stepEtiqueta = Math.ceil(serieDiaria.length / 6)

  const barras = serieDiaria.map((d, i) => {
    const alto = Math.round((d.diasEntrenados / maxDias) * 100)
    const esUltimo = i === serieDiaria.length - 1
    const mostrarFecha = i % stepEtiqueta === 0 || esUltimo
    return `
    <div class="dia" title="${d.fecha}: ${d.diasEntrenados} entrenando, ${d.usuariosActivos} usuarios">
      <span class="valor">${d.diasEntrenados > 0 ? d.diasEntrenados : ''}</span>
      <span class="barra" style="height:${alto}%"></span>
      <span class="fecha">${mostrarFecha ? formatearFechaCorta(d.fecha) : ''}</span>
    </div>`
  }).join('')

  const filas = usuarios.map(u => `
    <tr class="${u.sesionesVsDias ? 'fila-alerta' : ''}">
      <td>${escapeHtml(u.nombre)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${u.diasEntrenados}</td>
      <td>${u.sesionesTotal ?? '—'}</td>
      <td>${escapeHtml(u.ultimaSesion ?? '—')}</td>
      <td>${u.rachaActual}</td>
      <td>${u.rachaMaxima}</td>
    </tr>`).join('')

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Reporte de actividad — reps.io</title>
<style>
  body { font: 14px/1.4 -apple-system, system-ui, sans-serif; margin: 2rem; color: #1a1a1a; background: #fafafa; }
  h1 { font-size: 1.3rem; }
  .sub { color: #666; margin-bottom: 2rem; }
  .tiles { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .tile { background: #fff; border: 1px solid #e2e2e2; border-radius: 8px; padding: 1rem 1.5rem; min-width: 140px; }
  .tile .valor { font-size: 1.6rem; font-weight: 700; }
  .tile .label { color: #666; font-size: 0.8rem; }
  .chart { background: #fff; border: 1px solid #e2e2e2; border-radius: 8px; padding: 1rem 1rem 2rem; margin-bottom: 2rem; }
  .chart-bars { display: flex; align-items: flex-end; height: 180px; gap: 2px; }
  .dia { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; }
  .dia .valor { font-size: 0.7rem; color: #555; height: 1rem; }
  .dia .barra { width: 70%; min-height: 2px; background: #4f7cff; border-radius: 2px 2px 0 0; display: block; }
  .dia .fecha { position: absolute; bottom: -1.4rem; font-size: 0.65rem; color: #888; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e2e2; border-radius: 8px; overflow: hidden; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; }
  th { background: #f2f2f2; font-size: 0.75rem; text-transform: uppercase; color: #555; }
  .fila-alerta { background: #fff6e5; }
  .alerta { color: #b45309; }
</style>
</head>
<body>
  <h1>Reporte de actividad — reps.io</h1>
  <p class="sub">Generado ${escapeHtml(generadoEn)} · ventana de ${ventanaDias} días</p>

  <div class="tiles">
    <div class="tile"><div class="valor">${resumen.totalUsuariosAuth}</div><div class="label">Usuarios registrados</div></div>
    <div class="tile"><div class="valor">${resumen.activos7d}</div><div class="label">Activos últimos 7 días</div></div>
    <div class="tile"><div class="valor">${resumen.activos30d}</div><div class="label">Activos últimos 30 días</div></div>
    <div class="tile"><div class="valor">${resumen.promedioDiasPorUsuarioActivo}</div><div class="label">Días entrenados / usuario activo</div></div>
  </div>

  ${(resumen.usuariosSinPerfil.length || resumen.usuariosSinAuth.length) ? `<p class="alerta">⚠ ${resumen.usuariosSinPerfil.length} usuario(s) sin perfil Firestore, ${resumen.usuariosSinAuth.length} perfil(es) sin cuenta Auth.</p>` : ''}

  <div class="chart">
    <div class="chart-bars">${barras}</div>
  </div>

  <table>
    <thead><tr><th>Nombre</th><th>Email</th><th>Días entrenados</th><th>Sesiones</th><th>Última sesión</th><th>Racha</th><th>Racha máx.</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
</body>
</html>`
}

async function main() {
  const [authMap, fsMap] = await Promise.all([cargarUsuariosAuth(), cargarUsuariosFirestore()])
  const uids = new Set([...authMap.keys(), ...fsMap.keys()])

  const usuarios = []
  for (const uid of uids) {
    usuarios.push(await construirReportePorUsuario(uid, fsMap.get(uid), authMap.get(uid)))
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

  console.log(`\nReporte escrito en scripts/reportes/ (actividad-${fecha}.* y ultimo.*)`)
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
