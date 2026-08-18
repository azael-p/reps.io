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

const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
const vivos = docs => docs.filter(d => !d.eliminadoEn)

function agruparPor(docs, clave) {
  const map = new Map()
  for (const d of docs) {
    const k = d[clave]
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(d)
  }
  return map
}

// Índice diaId → nombres de día y programa, sobre TODOS los días (incluidos
// los soft-deleted): una sesión de un día borrado igual tiene que mostrar su
// nombre. Mismo criterio que enrichSesionesConPrograma en src/firebase/sesiones.js:
// programaNombre queda undefined si el programa ya no existe, y ahí el caller
// cae al nombre denormalizado en el resumen.
export function indexarDiaAPrograma(programas, dias) {
  const nombrePrograma = new Map(programas.map(p => [p.id, p.nombre]))
  return new Map(dias.map(d => [d.id, {
    diaNombre: d.nombre,
    programaNombre: nombrePrograma.get(d.programaId),
  }]))
}

export function resolverNombresSesion(sesion, diaAPrograma) {
  const ref = diaAPrograma.get(sesion.diaId)
  return {
    diaNombre: ref?.diaNombre ?? sesion.resumen?.diaNombre ?? '–',
    programaNombre: ref?.programaNombre ?? sesion.resumen?.programaNombre ?? '–',
  }
}

// Rutinas guardadas: programas → días → ejercicios, unidos por FK. Los docs con
// `eliminadoEn` se excluyen (igual que en la app, que filtra en cliente).
export function construirArbolProgramas(uid, { programas, dias, ejerciciosDia }) {
  const ejerciciosPorDia = agruparPor(vivos(ejerciciosDia), 'diaId')
  const diasPorPrograma = agruparPor(vivos(dias), 'programaId')

  return vivos(programas)
    .filter(p => p.usuarioId === uid)
    .sort(porOrden)
    .map(p => ({
      id: p.id,
      nombre: p.nombre,
      dias: (diasPorPrograma.get(p.id) ?? []).sort(porOrden).map(d => ({
        id: d.id,
        nombre: d.nombre,
        ejercicios: (ejerciciosPorDia.get(d.id) ?? []).sort(porOrden).map(e => ({
          nombre: e.nombre,
          grupoMuscular: e.grupoMuscular ?? null,
          esCustom: e.esCustom === true,
          seriesEsperadas: e.seriesEsperadas ?? null,
          repsEsperadas: e.repsEsperadas ?? null,
        })),
      })),
    }))
}

// Historial de sesiones completadas, desc por fecha. Todo sale del campo
// `resumen`; las sesiones viejas que no lo tienen se marcan con sinResumen
// en vez de reconstruirse desde `registros`.
export function construirSesionesUsuario(uid, sesiones, diaAPrograma) {
  return sesiones
    .filter(s => s.usuarioId === uid)
    .sort((a, b) => (b.fechaMs ?? 0) - (a.fechaMs ?? 0))
    .map(s => {
      const ejercicios = (s.resumen?.ejercicios ?? []).map(e => ({
        nombre: e.nombre,
        grupoMuscular: e.grupoMuscular ?? null,
        series: [...(e.series ?? [])]
          .sort((x, y) => (x.numeroSerie ?? 0) - (y.numeroSerie ?? 0))
          .map(x => ({
            numeroSerie: x.numeroSerie ?? null,
            pesoUsado: x.pesoUsado ?? null,
            repsHechas: x.repsHechas ?? null,
          })),
      }))

      return {
        id: s.id,
        fechaMs: s.fechaMs,
        fecha: s.fechaMs !== null ? formatearFecha(s.fechaMs) : null,
        ...resolverNombresSesion(s, diaAPrograma),
        volumenTotal: s.resumen?.volumenTotal ?? 0,
        nota: s.nota || null,
        totalSeries: ejercicios.reduce((acc, e) => acc + e.series.length, 0),
        ejercicios,
        sinResumen: !s.resumen,
      }
    })
}

export function construirDetalleUsuario(uid, crudo, diaAPrograma) {
  const eliminados = [...crudo.programas, ...crudo.dias, ...crudo.ejerciciosDia]
    .filter(d => d.usuarioId === uid && d.eliminadoEn).length

  return {
    sesiones: construirSesionesUsuario(uid, crudo.sesiones, diaAPrograma),
    programas: construirArbolProgramas(uid, crudo),
    eliminados,
  }
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
