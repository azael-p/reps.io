// Funciones puras del reporte de actividad: no tocan Firestore ni el DOM.
// Todo lo que entra son datos ya cargados; todo lo que sale es serializable.

export const DIA_MS = 86400000

// Réplica de src/utils/stats.js#calcularStreaks (no se importa: ese módulo
// importa de otro archivo sin extensión de archivo, válido bajo el resolver
// de Vite pero no bajo ESM nativo de Node).
export function calcularStreaks(epochsDias) {
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

export function formatearFecha(epochMs) {
  const d = new Date(epochMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export function agregarSerieDiaria(usuariosReporte, dias) {
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

export function construirResumenGlobal(usuariosReporte, authMap, fsMap) {
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
