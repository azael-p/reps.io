// Render del HTML del reporte. Página autocontenida: CSS inline, sin assets
// externos, sin red — se abre con doble click desde scripts/reportes/.

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function formatearFechaCorta(fechaISO) {
  return new Date(`${fechaISO}T00:00:00`)
    .toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

export function renderizarHTML(payload) {
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
