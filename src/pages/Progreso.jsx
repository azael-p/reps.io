import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useUser } from '../context/UserContext'
import { getSesionesConResumen, getEjerciciosUsadosConGrupoLocal, getVolumenPorSesionLocal, getRegistrosPorEjercicioLocal, getStreaksLocal, eliminarSesion } from '../firebase/sesiones'
import { getHistorialPeso, agregarPeso } from '../firebase/peso'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { PageWrapper, EmptyState, ConfirmDialog, Modal } from '../components/ui'
import PullToRefresh from '../components/PullToRefresh'
import { useDesktop } from '../hooks/useDesktop'

const TABS = ['Historial', 'Gráfico', 'Volumen', 'Rachas', 'Peso']

function formatFecha(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}

function formatFechaCorta(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('es-UY', { day: 'numeric', month: 'numeric' })
}

export default function Progreso() {
  const isDesktop = useDesktop()
  const { usuario } = useUser()
  const navigate = useNavigate()
  const [tab, setTab] = useState('Historial')
  const [sesiones, setSesiones] = useState([])
  const [sesionesConResumen, setSesionesConResumen] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [ejercicioSel, setEjercicioSel] = useState('')
  const [grupoSel, setGrupoSel] = useState('')
  const [datosGrafico, setDatosGrafico] = useState([])
  const [cargando, setCargando] = useState(true)
  const [confirmData, setConfirmData] = useState(null)
  const [datosVolumen, setDatosVolumen] = useState([])
  const [streaks, setStreaks] = useState({ actual: 0, maxima: 0 })
  const [modoGrafico, setModoGrafico] = useState('peso')
  const [historialPeso, setHistorialPeso] = useState([])
  const [cargandoPeso, setCargandoPeso] = useState(false)
  const [pesoCargado, setPesoCargado] = useState(false)
  const [modalPeso, setModalPeso] = useState(false)
  const [pesoInput, setPesoInput] = useState('')
  const [guardandoPeso, setGuardandoPeso] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const sesResumen = await getSesionesConResumen(usuario.id)
      setSesionesConResumen(sesResumen)
      // Derive diaNombre from resumen for historial display
      setSesiones(sesResumen.map(s => ({ ...s, diaNombre: s.resumen?.diaNombre ?? '–' })))
      const ejs = getEjerciciosUsadosConGrupoLocal(sesResumen)
      setEjercicios(ejs)
      if (ejs.length > 0) {
        setGrupoSel(prev => ejs.some(e => e.grupoMuscular === prev) ? prev : ejs[0].grupoMuscular)
        setEjercicioSel(prev => ejs.some(e => e.nombre === prev) ? prev : ejs[0].nombre)
      }
    } catch (e) { console.error(e) }
    setHistorialPeso([])
    setPesoCargado(false)
    setCargando(false)
  }, [usuario])

  function calcular1RM(peso, reps) {
    if (!peso || !reps || reps <= 1) return peso
    return Math.round(peso * (1 + reps / 30))
  }

  const cargarPeso = useCallback(async () => {
    try {
      const data = await getHistorialPeso(usuario.id)
      setHistorialPeso(data)
    } catch (e) { console.error(e) }
    setPesoCargado(true)
    setCargandoPeso(false)
  }, [usuario])

  useEffect(() => { setCargando(true); cargar() }, [cargar]) // eslint-disable-line

  // Gráfico de ejercicio — client-side, sin Firestore
  useEffect(() => {
    if (!sesionesConResumen || !ejercicioSel) return
    if (tab !== 'Gráfico' && !isDesktop) return
    const registros = getRegistrosPorEjercicioLocal(sesionesConResumen, ejercicioSel)
    const porSesion = {}
    for (const r of registros) {
      const valor = modoGrafico === '1rm'
        ? calcular1RM(r.pesoUsado, r.repsHechas)
        : modoGrafico === 'volumen'
          ? Math.round((r.pesoUsado || 0) * (r.repsHechas || 0))
          : r.pesoUsado
      const key = modoGrafico === '1rm' ? '1rm' : modoGrafico === 'volumen' ? 'volumen' : 'peso'
      if (!porSesion[r.sesionId] || valor > porSesion[r.sesionId][key]) {
        porSesion[r.sesionId] = { fecha: formatFechaCorta(r.fecha), sesionId: r.sesionId, [key]: valor }
      }
    }
    const arr = Object.values(porSesion) // antiguo → reciente
    setDatosGrafico(arr.map((d, i) => ({ ...d, xKey: `${d.fecha}#${i}` })))
  }, [tab, ejercicioSel, modoGrafico, isDesktop, sesionesConResumen]) // eslint-disable-line

  // Volumen total — client-side, sin Firestore
  useEffect(() => {
    if (!sesionesConResumen) return
    if (tab !== 'Volumen' && !isDesktop) return
    const arr = getVolumenPorSesionLocal(sesionesConResumen)
      .map(d => ({ fecha: formatFechaCorta(d.fecha), volumen: d.volumen })) // antiguo → reciente
    setDatosVolumen(arr.map((d, i) => ({ ...d, xKey: `${d.fecha}#${i}` })))
  }, [tab, isDesktop, sesionesConResumen]) // eslint-disable-line

  // Rachas — client-side, sin Firestore
  useEffect(() => {
    if (!sesionesConResumen) return
    if (tab !== 'Rachas' && !isDesktop) return
    setStreaks(getStreaksLocal(sesionesConResumen))
  }, [tab, isDesktop, sesionesConResumen]) // eslint-disable-line

  // Peso corporal — sigue siendo Firestore (subcollección separada)
  useEffect(() => {
    if ((tab === 'Peso' || isDesktop) && !pesoCargado && !cargandoPeso) {
      setCargandoPeso(true); cargarPeso() // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [tab, isDesktop, pesoCargado, cargandoPeso, cargarPeso])

  async function handleGuardarPeso() {
    const kg = Number(pesoInput)
    if (!kg || kg < 20 || kg > 300) return
    setGuardandoPeso(true)
    try {
      await agregarPeso(usuario.id, kg)
      setModalPeso(false)
      setPesoCargado(false)
      setCargandoPeso(true)
      cargarPeso()
    } catch (e) { console.error(e) }
    setGuardandoPeso(false)
  }

  function frecuenciaSemanal() {
    const semanas = {}
    for (const s of sesiones) {
      if (!s.fecha) continue
      const d = s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha)
      const lunes = new Date(d)
      lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      lunes.setHours(0, 0, 0, 0)
      const key = lunes.getTime()
      if (!semanas[key]) semanas[key] = { fecha: lunes, dias: 0 }
      semanas[key].dias += 1
    }
    return Object.values(semanas)
      .sort((a, b) => a.fecha - b.fecha)
      .map(({ fecha, dias }) => ({
        semana: fecha.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' }).replace('.', ''),
        dias,
      }))
      .slice(-8)
  }

  const frec = useMemo(() => frecuenciaSemanal(), [sesiones])
  const maxFrec = Math.max(7, ...frec.map(f => f.dias))

  const headerContent = (
    <motion.div
      style={isDesktop ? s.headerDesktop : s.header}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {!isDesktop && (
        <motion.button
          style={s.back}
          onClick={() => navigate('/home')}
          whileTap={{ scale: 0.9, x: -2 }}
        >
          ←
        </motion.button>
      )}
      <div style={s.headerInfo}>
        <p style={s.headerSub}>Estadísticas</p>
        <h1 style={s.titulo}>Mi progreso</h1>
      </div>
    </motion.div>
  )

  const historialContent = (
    <div>
      {sesiones.length === 0 ? (
        <EmptyState mensaje="Todavía no hay sesiones registradas." icon="📊" />
      ) : (
        <>
          <div style={s.frecuenciaCard}>
            <p style={s.secLabel}>Frecuencia semanal</p>
            <div style={s.barras}>
              {frec.map(({ semana, dias }, i) => (
                <div key={`${semana}-${i}`} style={s.barraItem}>
                  <div style={s.barraWrap}>
                    <span style={s.barraNum}>{dias}</span>
                    <motion.div
                      style={s.barra}
                      initial={{ height: 0 }}
                      animate={{ height: `${(dias / maxFrec) * 100}%` }}
                      transition={{ delay: 0.05 * i, duration: 0.55, ease: 'easeOut' }}
                    />
                  </div>
                  <span style={s.barraLabel}>{semana}</span>
                </div>
              ))}
            </div>
          </div>

          <p style={{ ...s.secLabel, padding: '8px 16px' }}>Sesiones</p>
          <div style={s.lista}>
            <AnimatePresence>
              {sesiones.map((sesion, i) => (
                <motion.div
                  key={sesion.id}
                  style={s.sesionCard}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 220, damping: 22 }}
                >
                  <div style={s.sesionInfo} onClick={() => navigate(`/sesion/${sesion.id}/resumen`)}>
                    <div style={s.fechaBadge}>
                      <span style={s.fechaDia}>{
                        (sesion.fecha?.toDate ? sesion.fecha.toDate() : new Date(sesion.fecha))?.getDate()
                      }</span>
                      <span style={s.fechaMes}>{
                        (sesion.fecha?.toDate ? sesion.fecha.toDate() : new Date(sesion.fecha))
                          ?.toLocaleDateString('es-UY', { month: 'short' })
                      }</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={s.sesionNombre}>{sesion.diaNombre}</span>
                      <span style={s.sesionFecha}>{formatFecha(sesion.fecha)}</span>
                    </div>
                  </div>
                  <div style={s.sesionAcciones}>
                    <motion.button
                      style={s.accionBtn}
                      onClick={() => navigate(`/sesion/${sesion.id}/resumen`)}
                      whileTap={{ scale: 0.96 }}
                    >
                      Ver
                    </motion.button>
                    <motion.button
                      style={{ ...s.accionBtn, ...s.accionEliminar }}
                      onClick={() => setConfirmData({
                        titulo: `¿Eliminar esta sesión?`,
                        descripcion: `${sesion.diaNombre} — ${formatFecha(sesion.fecha)}. Se borrarán todos los registros de series.`,
                        icon: '🗑️',
                        onConfirm: async () => {
                          await eliminarSesion(sesion.id)
                          cargar()
                        },
                      })}
                      whileTap={{ scale: 0.96 }}
                    >
                      Eliminar
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )

  const graficoContent = (
    <div style={s.graficoWrap}>
      {ejercicios.length === 0 ? (
        <EmptyState mensaje="Todavía no hay datos de ejercicios." icon="📈" />
      ) : (
        <>
          {(() => {
            const grupos = [...new Set(ejercicios.map(e => e.grupoMuscular))].sort()
            return (
              <div style={s.selector}>
                <p style={s.secLabel}>Grupo muscular</p>
                <div style={s.chips}>
                  {grupos.map(g => {
                    const activo = grupoSel === g
                    return (
                      <motion.button
                        key={g}
                        style={{ ...s.chip, ...(activo ? s.chipActivo : {}) }}
                        onClick={() => {
                          setGrupoSel(g)
                          const primero = ejercicios.find(e => e.grupoMuscular === g)
                          if (primero) setEjercicioSel(primero.nombre)
                        }}
                        whileTap={{ scale: 0.94 }}
                      >
                        {g}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          <div style={s.selector}>
            <p style={s.secLabel}>Ejercicio</p>
            <div style={s.chips}>
              {ejercicios
                .filter(e => e.grupoMuscular === grupoSel)
                .map(e => {
                  const activo = ejercicioSel === e.nombre
                  return (
                    <motion.button
                      key={e.nombre}
                      style={{ ...s.chip, ...(activo ? s.chipActivo : {}) }}
                      onClick={() => setEjercicioSel(e.nombre)}
                      whileTap={{ scale: 0.94 }}
                    >
                      {e.nombre}
                    </motion.button>
                  )
                })}
            </div>
          </div>

          <div style={s.selector}>
            <div style={s.toggleRow}>
              {['peso', '1rm', 'volumen'].map(m => (
                <motion.button
                  key={m}
                  style={{ ...s.toggleChip, ...(modoGrafico === m ? s.toggleChipActivo : {}) }}
                  onClick={() => setModoGrafico(m)}
                  whileTap={{ scale: 0.94 }}
                >
                  {{ peso: 'Peso máx.', '1rm': '1RM est.', volumen: 'Vol. serie' }[m]}
                </motion.button>
              ))}
            </div>
          </div>

          {datosGrafico.length === 0 ? (
            <EmptyState mensaje="No hay registros para este ejercicio." icon="📉" />
          ) : (
            <motion.div
              style={s.chartCard}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p style={s.chartTitulo}>
                {{ peso: 'Peso máximo por sesión', '1rm': '1RM estimado por sesión', volumen: 'Mejor serie por volumen' }[modoGrafico]}
              </p>
              <p style={s.chartSub}>{modoGrafico === 'volumen' ? 'en kg × reps' : 'en kilogramos'}</p>
              <div style={{ width: '100%', height: 240, marginTop: '12px' }}>
                <ResponsiveContainer>
                  <LineChart data={datosGrafico} margin={{ top: 12, right: 18, left: -18, bottom: 0 }} key={`g${ejercicioSel}-${modoGrafico}-${datosGrafico.length}`}>
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#85b7eb" stopOpacity={1} />
                        <stop offset="100%" stopColor="#1879c9" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="xKey" tickFormatter={v => String(v).split('#')[0]} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-elev)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: 12,
                        color: '#fff',
                        fontSize: '0.85rem',
                        padding: '8px 12px',
                        boxShadow: 'var(--shadow-md)',
                      }}
                      labelFormatter={v => String(v).split('#')[0]}
                      formatter={(v) => {
                        const label = { peso: 'Peso', '1rm': '1RM', volumen: 'Vol. serie' }[modoGrafico]
                        const unit = modoGrafico === 'volumen' ? 'kg·rep' : 'kg'
                        return [`${v.toLocaleString()} ${unit}`, label]
                      }}
                      cursor={{ stroke: 'rgba(133, 183, 235, 0.3)', strokeWidth: 2 }}
                    />
                    <Line
                      type="monotone" dataKey={modoGrafico === 'peso' ? 'peso' : modoGrafico === '1rm' ? '1rm' : 'volumen'}
                      stroke="url(#lineGrad)" strokeWidth={3}
                      dot={{ fill: '#85b7eb', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 7, fill: '#fff', stroke: '#85b7eb', strokeWidth: 2 }}
                      isAnimationActive={true}
                      animationDuration={900}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )

  const volumenContent = (
    <div>
      {datosVolumen.length === 0 ? (
        <EmptyState mensaje="No hay datos de volumen todavía." icon="📊" />
      ) : (
        <motion.div
          style={s.chartCard}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p style={s.chartTitulo}>Volumen total por sesión</p>
          <p style={s.chartSub}>peso × reps × series</p>
          <div style={{ width: '100%', height: 240, marginTop: '12px' }}>
            <ResponsiveContainer>
              <BarChart data={datosVolumen} margin={{ top: 12, right: 18, left: -18, bottom: 0 }} key={`v${datosVolumen.length}`}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5dcaa5" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0c7a5f" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="xKey" tickFormatter={v => String(v).split('#')[0]} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elev)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: '0.85rem',
                    padding: '8px 12px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  labelFormatter={v => String(v).split('#')[0]}
                  formatter={(v) => [`${v.toLocaleString()} kg`, 'Volumen']}
                  cursor={{ fill: 'rgba(93, 202, 165, 0.1)' }}
                />
                <Bar dataKey="volumen" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  )

  const rachasContent = (
    <div style={s.rachasWrap}>
      {!sesionesConResumen ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
          <span className="spinner" style={{ color: 'var(--orange)' }} />
        </div>
      ) : streaks.actual === 0 && streaks.maxima === 0 ? (
        <EmptyState mensaje="Entrená para empezar a generar rachas." icon="🔥" />
      ) : (
        <>
          <motion.div
            style={s.streakCard}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <div style={s.streakNumWrap}>
              <motion.span
                style={s.streakNum}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
              >
                {streaks.actual}
              </motion.span>
              <span style={s.streakLabel}>días seguidos</span>
            </div>
            <div style={s.streakFire}>🔥</div>
          </motion.div>

          <motion.div
            style={s.streakMeta}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <span style={s.streakMetaNum}>{streaks.maxima}</span>
            <span style={s.streakMetaLabel}>récord de racha</span>
          </motion.div>
        </>
      )}
    </div>
  )

  const pesoChartData = historialPeso.map((e, i) => ({
    xKey: `${e.fecha.getDate()}/${e.fecha.getMonth() + 1}#${i}`,
    fecha: `${e.fecha.getDate()}/${e.fecha.getMonth() + 1}`,
    peso: e.peso,
  }))

  const pesoContent = (
    <div style={s.graficoWrap}>
      {cargandoPeso ? (
        <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
          <span className="spinner" style={{ color: 'var(--blue)' }} />
        </div>
      ) : historialPeso.length === 0 ? (
        <EmptyState
          mensaje="Sin registros de peso"
          icon="⚖️"
          sub="Registrá tu peso para ver tu evolución"
          action={{ label: 'Registrar peso', onClick: () => { setPesoInput(''); setModalPeso(true) } }}
        />
      ) : (
        <>
          <motion.div
            style={s.chartCard}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p style={s.chartTitulo}>Evolución de peso corporal</p>
            <p style={s.chartSub}>en kilogramos</p>
            <div style={{ width: '100%', height: 240, marginTop: '12px' }}>
              <ResponsiveContainer>
                <LineChart data={pesoChartData} margin={{ top: 12, right: 18, left: -18, bottom: 0 }} key={`p${pesoChartData.length}`}>
                  <defs>
                    <linearGradient id="pesoGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#85b7eb" stopOpacity={1} />
                      <stop offset="100%" stopColor="#1879c9" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="xKey" tickFormatter={v => String(v).split('#')[0]} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elev)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 12,
                      color: '#fff',
                      fontSize: '0.85rem',
                      padding: '8px 12px',
                      boxShadow: 'var(--shadow-md)',
                    }}
                    labelFormatter={v => String(v).split('#')[0]}
                    formatter={(v) => [`${v} kg`, 'Peso']}
                    cursor={{ stroke: 'rgba(133, 183, 235, 0.3)', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="url(#pesoGrad)"
                    strokeWidth={3}
                    dot={{ fill: '#85b7eb', r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 7, fill: '#fff', stroke: '#85b7eb', strokeWidth: 2 }}
                    isAnimationActive
                    animationDuration={900}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <div style={{ padding: '0 16px 24px' }}>
            <motion.button
              style={s.registrarPesoBtn}
              onClick={() => { setPesoInput(''); setModalPeso(true) }}
              whileTap={{ scale: 0.97 }}
            >
              + Registrar peso hoy
            </motion.button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <PageWrapper>
      <PullToRefresh onRefresh={cargar}>
        {headerContent}

      {isDesktop ? (
        cargando ? (
          <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
            <span className="spinner" style={{ color: 'var(--blue)' }} />
          </div>
        ) : (
          <div style={s.desktopGrid}>
            <div style={s.desktopCol}>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Evolución de ejercicios</p>
                {graficoContent}
              </div>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Volumen total</p>
                {volumenContent}
              </div>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Peso corporal</p>
                {pesoContent}
              </div>
            </div>
            <div style={s.desktopColNarrow}>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Rachas</p>
                {rachasContent}
              </div>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Historial de sesiones</p>
                {historialContent}
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <div style={s.tabs}>
            {TABS.map(t => {
              const activo = tab === t
              return (
                <motion.button
                  key={t}
                  style={s.tab}
                  onClick={() => setTab(t)}
                  whileTap={{ scale: 0.97 }}
                >
                  <span style={{ ...s.tabLabel, color: activo ? 'var(--blue)' : 'var(--text-dim)' }}>{t}</span>
                  {activo && (
                    <motion.div
                      layoutId="tab-indicator"
                      style={s.tabIndicator}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                </motion.button>
              )
            })}
          </div>

          {cargando ? (
            <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
              <span className="spinner" style={{ color: 'var(--blue)' }} />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22 }}
              >
                {tab === 'Historial' && historialContent}
                {tab === 'Gráfico' && graficoContent}
                {tab === 'Volumen' && volumenContent}
                {tab === 'Rachas' && rachasContent}
                {tab === 'Peso' && pesoContent}
              </motion.div>
            </AnimatePresence>
          )}
        </>
      )}

      <ConfirmDialog open={!!confirmData} data={confirmData} onClose={() => setConfirmData(null)} />

      <Modal open={modalPeso} onClose={() => setModalPeso(false)}>
        <h2 style={s.modalTitulo}>Registrar peso</h2>
        <div style={s.pesoModalRow}>
          <input
            type="number"
            style={s.pesoModalInput}
            placeholder="Ej: 78"
            value={pesoInput}
            onChange={e => setPesoInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGuardarPeso()}
            autoFocus
            min="20"
            max="300"
          />
          <span style={s.pesoModalKg}>kg</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <motion.button style={s.cancelBtn} onClick={() => setModalPeso(false)} whileTap={{ scale: 0.97 }}>
            Cancelar
          </motion.button>
          <motion.button
            style={{ ...s.saveBtn, opacity: !pesoInput.trim() || guardandoPeso ? 0.5 : 1 }}
            onClick={handleGuardarPeso}
            disabled={!pesoInput.trim() || guardandoPeso}
            whileTap={{ scale: 0.97 }}
          >
            {guardandoPeso ? <span className="spinner" /> : 'Guardar'}
          </motion.button>
        </div>
      </Modal>

      </PullToRefresh>
    </PageWrapper>
  )
}

const s = {
  header: {
    display: 'flex', alignItems: 'center',
    padding: '20px 16px 16px',
    paddingTop: 'max(20px, env(safe-area-inset-top))',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
  },
  back: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    width: '44px', height: '44px',
    borderRadius: '12px', fontSize: '1.2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerSub: { margin: 0, fontSize: '0.7rem', color: 'var(--blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  titulo: { margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' },
  tab: {
    flex: 1, padding: '14px',
    background: 'none', border: 'none',
    position: 'relative',
    cursor: 'pointer',
    minWidth: '60px',
  },
  tabLabel: { fontSize: '0.88rem', fontWeight: 600 },
  tabIndicator: {
    position: 'absolute',
    bottom: -1, left: '20%', right: '20%',
    height: '2px',
    background: 'var(--blue-grad)',
    borderRadius: '2px',
    boxShadow: '0 0 10px var(--blue-glow)',
  },
  frecuenciaCard: {
    margin: '16px',
    padding: '18px 16px 14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-sm)',
  },
  secLabel: {
    margin: '0 0 12px',
    fontSize: '0.7rem', color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    fontWeight: 700,
  },
  barras: { display: 'flex', gap: '8px', alignItems: 'flex-end', height: '120px', paddingTop: '20px' },
  barraItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, height: '100%' },
  barraWrap: { width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' },
  barra: {
    width: '100%',
    background: 'var(--blue-grad)',
    borderRadius: '6px 6px 0 0',
    minHeight: '4px',
    boxShadow: '0 0 12px rgba(133, 183, 235, 0.15)',
  },
  barraNum: { fontSize: '0.68rem', color: 'var(--blue)', fontWeight: 700, marginBottom: '3px' },
  barraLabel: { fontSize: '0.62rem', color: 'var(--text-dim)' },
  lista: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px 8px' },
  sesionCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '14px',
    display: 'flex', flexDirection: 'column', gap: '12px',
    boxShadow: 'var(--shadow-sm)',
  },
  sesionInfo: { display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer' },
  fechaBadge: {
    width: '50px', height: '50px',
    borderRadius: '14px',
    background: 'var(--blue-glow)',
    border: '1px solid rgba(133, 183, 235, 0.2)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  fechaDia: { fontSize: '1.3rem', fontWeight: 800, color: 'var(--blue)', lineHeight: 1, letterSpacing: '-0.02em' },
  fechaMes: { fontSize: '0.62rem', color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 },
  sesionNombre: { display: 'block', fontSize: '1rem', fontWeight: 600, letterSpacing: '-0.01em' },
  sesionFecha: { fontSize: '0.82rem', color: 'var(--text-mute)' },
  sesionAcciones: { display: 'flex', gap: '8px' },
  accionBtn: { flex: 1, padding: '14px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: '0.9rem', fontWeight: 500 },
  accionEliminar: { color: 'var(--danger)', background: 'var(--danger-bg)', borderColor: 'rgba(255,107,107,0.18)' },
  graficoWrap: { padding: 0 },
  selector: { padding: '16px 16px 0' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  chip: {
    padding: '12px 18px',
    background: 'var(--bg-card)',
    color: 'var(--text-mute)',
    border: '1px solid var(--border)',
    borderRadius: '20px',
    fontSize: '0.88rem', fontWeight: 500,
  },
  chipActivo: {
    background: 'var(--blue-grad)',
    color: '#fff',
    borderColor: 'transparent',
    boxShadow: '0 4px 14px rgba(13, 83, 150, 0.35)',
    fontWeight: 600,
  },
  select: {
    width: '100%', padding: '14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)', fontSize: '1rem',
    outline: 'none',
  },
  chartCard: {
    margin: '8px 16px 24px',
    padding: '18px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-md)',
  },
  chartTitulo: { margin: 0, fontSize: '1rem', color: 'var(--text)', fontWeight: 700, letterSpacing: '-0.01em' },
  chartSub: { margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-mute)' },
  toggleRow: { display: 'flex', gap: '8px' },
  toggleChip: {
    flex: 1, padding: '12px 16px', textAlign: 'center',
    background: 'var(--bg-card)', color: 'var(--text-mute)',
    border: '1px solid var(--border)', borderRadius: '20px',
    fontSize: '0.88rem', fontWeight: 500,
  },
  toggleChipActivo: {
    background: 'var(--blue-grad)', color: '#fff',
    borderColor: 'transparent', fontWeight: 600,
    boxShadow: '0 4px 14px rgba(13, 83, 150, 0.35)',
  },
  rachasWrap: { padding: '16px' },
  streakCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
    padding: '32px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    borderRadius: 'var(--r-xl)',
    boxShadow: 'var(--shadow-md)',
  },
  streakNumWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  streakNum: {
    fontSize: '3.2rem', fontWeight: 800,
    letterSpacing: '-0.04em',
    background: 'linear-gradient(135deg, #f0997b, #ffd166)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  streakLabel: { fontSize: '0.78rem', color: 'var(--text-mute)', fontWeight: 600 },
  streakFire: { fontSize: '2.5rem' },
  streakMeta: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
    padding: '20px',
    marginTop: '10px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderTop: '1px solid var(--highlight)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-sm)',
  },
  streakMetaNum: { fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' },
  streakMetaLabel: { fontSize: '0.7rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 },
  registrarPesoBtn: {
    width: '100%', padding: '14px',
    background: 'var(--bg-card)',
    color: 'var(--blue)',
    border: '1px solid rgba(133, 183, 235, 0.3)',
    borderRadius: 'var(--r-lg)',
    fontSize: '0.95rem', fontWeight: 600,
    boxShadow: 'var(--shadow-sm)',
  },
  modalTitulo: { margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' },
  pesoModalRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  pesoModalInput: {
    flex: 1, padding: '14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text)', fontSize: '1.1rem',
    outline: 'none',
  },
  pesoModalKg: { fontSize: '1rem', color: 'var(--text-mute)', fontWeight: 600, flexShrink: 0 },
  cancelBtn: { flex: 1, padding: '14px', background: 'var(--bg-input)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.95rem' },
  saveBtn: { flex: 1, padding: '14px', background: 'var(--blue-grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(13, 83, 150, 0.35)' },
  headerDesktop: {
    display: 'flex', alignItems: 'center',
    padding: '32px 40px 24px',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
  },
  desktopGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 420px',
    gap: '24px',
    padding: '24px 40px 40px',
    alignItems: 'start',
  },
  desktopCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  desktopColNarrow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  desktopPanel: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    padding: '20px',
    boxShadow: 'var(--shadow-sm)',
  },
  desktopPanelTitle: {
    margin: '0 0 16px',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: 'var(--text-mute)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
}
