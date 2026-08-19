import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useUser } from '../context/UserContext'
import { getSesionesPaginadas, enrichSesionesConPrograma, esMismoEjercicio } from '../firebase/sesiones'
import { getResumenGlobalConFallback } from '../firebase/statsGlobal'
import { getStatsEjerciciosConFallback } from '../firebase/statsEjercicios'
import { eliminarSesionConAgregados } from '../firebase/eliminarSesion'
import { getHistorialPeso, agregarPeso } from '../firebase/peso'
import { PageWrapper, ConfirmDialog } from '../components/ui'
import PullToRefresh from '../components/PullToRefresh'
import LazyPanel from '../components/LazyPanel'
import { useDesktop } from '../hooks/useDesktop'
import { useToast } from '../components/Toast'
import { frecuenciaSemanal, calcularStreaks, volumenSemanal, sesionesEsteMes, prMasReciente, parsePeso } from '../utils/stats'
import { toDate, tiempoRelativo } from '../utils/fechas'
import { formatFecha, formatFechaCorta } from './progreso/format'
import HeaderProgreso from './progreso/HeaderProgreso'
import HistorialTab from './progreso/HistorialTab'
import GraficoTab from './progreso/GraficoTab'
import VolumenTab from './progreso/VolumenTab'
import RachasTab from './progreso/RachasTab'
import PesoTab from './progreso/PesoTab'
import PesoModal from './progreso/PesoModal'

const TABS = ['Historial', 'Gráfico', 'Volumen', 'Rachas', 'Peso']
const PAGE_SIZE = 20

export default function Progreso() {
  const isDesktop = useDesktop()
  const { usuario } = useUser()
  const navigate = useNavigate()
  const { show } = useToast()
  const [tab, setTab] = useState('Historial')
  const [sesiones, setSesiones] = useState([])
  const [resumenGlobal, setResumenGlobal] = useState(null)
  const [statsEjercicios, setStatsEjercicios] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [ejercicioSel, setEjercicioSel] = useState('')
  const [grupoSel, setGrupoSel] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [confirmData, setConfirmData] = useState(null)
  const [ultimoDoc, setUltimoDoc] = useState(null)
  const [hayMas, setHayMas] = useState(false)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [filtroPrograma, setFiltroPrograma] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [modoGrafico, setModoGrafico] = useState('peso')
  const [historialPeso, setHistorialPeso] = useState([])
  const [cargandoPeso, setCargandoPeso] = useState(false)
  const [pesoCargado, setPesoCargado] = useState(false)
  const [modalPeso, setModalPeso] = useState(false)
  const [pesoInput, setPesoInput] = useState('')
  const [errorPeso, setErrorPeso] = useState('')

  // Enriquece una página con los nombres de día/programa (falla suave).
  const enriquecer = useCallback(async (pagina) => {
    try {
      return await enrichSesionesConPrograma(usuario.id, pagina)
    } catch (e) {
      console.error('enrichSesionesConPrograma failed:', e)
      return pagina.map(s => ({ ...s, diaNombre: s.resumen?.diaNombre ?? '–', programaNombre: '–' }))
    }
  }, [usuario])

  const cargar = useCallback(async () => {
    try {
      // Primera página del historial + los dos agregados. Ya no se descarga
      // el historial completo: los gráficos salen de statsEjercicios.
      const [pagina, rg, statsEj] = await Promise.all([
        getSesionesPaginadas(usuario.id, { pageSize: PAGE_SIZE }),
        getResumenGlobalConFallback(usuario.id),
        getStatsEjerciciosConFallback(usuario.id),
      ])
      setResumenGlobal(rg)
      setStatsEjercicios(statsEj)
      setUltimoDoc(pagina.ultimoDoc)
      setHayMas(pagina.hayMas)
      setSesiones(await enriquecer(pagina.sesiones))
      const ejs = statsEj
        .filter(e => e.puntos?.length > 0)
        .map(e => ({ nombre: e.nombre, grupoMuscular: e.grupoMuscular, catalogoId: e.catalogoId ?? null }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
      setEjercicios(ejs)
      if (ejs.length > 0) {
        setGrupoSel(prev => ejs.some(e => e.grupoMuscular === prev) ? prev : ejs[0].grupoMuscular)
        setEjercicioSel(prev => ejs.some(e => e.nombre === prev) ? prev : ejs[0].nombre)
      }
      setErrorCarga(false)
    } catch (e) { console.error(e); setErrorCarga(true) }
    setHistorialPeso([])
    setPesoCargado(false)
    setCargando(false)
  }, [usuario, enriquecer])

  const cargarMas = useCallback(async () => {
    if (!ultimoDoc || cargandoMas) return
    setCargandoMas(true)
    try {
      const pagina = await getSesionesPaginadas(usuario.id, { after: ultimoDoc, pageSize: PAGE_SIZE })
      const enriched = await enriquecer(pagina.sesiones)
      setSesiones(prev => [...prev, ...enriched])
      setUltimoDoc(pagina.ultimoDoc)
      setHayMas(pagina.hayMas)
    } catch (e) {
      console.error(e)
      show({ message: 'No se pudieron cargar más sesiones.', variant: 'error' })
    }
    setCargandoMas(false)
  }, [usuario, ultimoDoc, cargandoMas, enriquecer, show])

  const cargarPeso = useCallback(async () => {
    setCargandoPeso(true)
    try {
      const data = await getHistorialPeso(usuario.id)
      setHistorialPeso(data)
    } catch (e) {
      console.error(e)
      show({ message: 'No se pudieron cargar los registros de peso.', variant: 'error' })
    }
    setPesoCargado(true)
    setCargandoPeso(false)
  }, [usuario, show])

  useEffect(() => { cargar() }, [cargar])

  // Gráfico de ejercicio — desde los puntos del agregado statsEjercicios
  const datosGrafico = useMemo(() => {
    if (!statsEjercicios || !ejercicioSel) return []
    if (tab !== 'Gráfico' && !isDesktop) return []
    const ejercicioObj = ejercicios.find(e => e.nombre === ejercicioSel)
    if (!ejercicioObj) return []
    const stats = statsEjercicios.find(e => esMismoEjercicio(e, ejercicioObj))
    const key = modoGrafico === '1rm' ? '1rm' : modoGrafico === 'volumen' ? 'volumen' : 'peso'
    return (stats?.puntos ?? []) // ya vienen antiguo → reciente
      .map(p => ({
        fecha: formatFechaCorta(p.fecha),
        sesionId: p.sesionId,
        [key]: modoGrafico === '1rm' ? p.oneRm : modoGrafico === 'volumen' ? p.volSerie : p.pesoMax,
      }))
      .map((d, i) => ({ ...d, xKey: `${d.fecha}#${i}` }))
  }, [tab, ejercicioSel, ejercicios, modoGrafico, isDesktop, statsEjercicios])

  // Volumen total — desde el agregado resumenGlobal (ya viene antiguo → reciente)
  const datosVolumen = useMemo(() => {
    if (!resumenGlobal) return []
    if (tab !== 'Volumen' && !isDesktop) return []
    // Sin `?? []`: getResumenGlobalConFallback ya garantiza el array (ver
    // normalizarResumen en statsGlobal.js) — repetir el guard acá contradice
    // la razón por la que ese normalizador existe.
    return resumenGlobal.volumenPorSesion
      .map(d => ({ fecha: formatFechaCorta(d.fecha), volumen: d.volumen }))
      .map((d, i) => ({ ...d, xKey: `${d.fecha}#${i}` }))
  }, [tab, isDesktop, resumenGlobal])

  // Rachas — desde los días entrenados del agregado
  const streaks = useMemo(
    () => calcularStreaks(resumenGlobal?.diasEntrenados ?? []),
    [resumenGlobal]
  )

  // "De un vistazo" (mobile): volumen de esta semana vs. la anterior,
  // sesiones del mes y el PR más reciente — todo derivado de datos que
  // cargar() ya trae, sin lecturas nuevas.
  const volSemana = useMemo(
    () => volumenSemanal(resumenGlobal?.volumenPorSesion ?? []),
    [resumenGlobal]
  )
  const sesionesMes = useMemo(
    () => sesionesEsteMes(resumenGlobal?.diasEntrenados ?? []),
    [resumenGlobal]
  )
  const prReciente = useMemo(
    () => prMasReciente(statsEjercicios ?? []),
    [statsEjercicios]
  )

  // Peso corporal — sigue siendo Firestore (subcollección separada)
  useEffect(() => {
    if ((tab === 'Peso' || isDesktop) && !pesoCargado && !cargandoPeso) {
      cargarPeso()
    }
  }, [tab, isDesktop, pesoCargado, cargandoPeso, cargarPeso])

  function handleGuardarPeso() {
    const kg = parsePeso(pesoInput)
    if (!kg || kg < 20 || kg > 300) { setErrorPeso('Ingresá un peso entre 20 y 300 kg'); return }
    setErrorPeso('')
    agregarPeso(usuario.id, kg).catch(e => {
      console.error(e)
      show({ message: 'No se pudo guardar el peso. Se reintentará cuando haya conexión.', variant: 'warning' })
    })
    setModalPeso(false)
    setPesoCargado(false)
    cargarPeso()
  }

  function abrirModalPeso() {
    setPesoInput('')
    setModalPeso(true)
  }

  // Días entrenados por semana (desde el agregado; antes contaba sesiones)
  const frec = useMemo(
    () => frecuenciaSemanal((resumenGlobal?.diasEntrenados ?? []).map(e => ({ fecha: e }))),
    [resumenGlobal]
  )
  const maxFrec = useMemo(() => Math.max(7, ...frec.map(f => f.dias)), [frec])

  const grupos = useMemo(
    () => [...new Set(ejercicios.map(e => e.grupoMuscular))].sort(),
    [ejercicios]
  )

  const uniqueProgramas = useMemo(() => {
    const names = new Set(sesiones.map(s => s.programaNombre).filter(n => n && n !== 'Sin programa'))
    return ['todos', ...Array.from(names)]
  }, [sesiones])

  const uniqueMeses = useMemo(() => {
    const meses = new Set()
    sesiones.forEach(s => {
      if (!s.fecha) return
      const d = toDate(s.fecha)
      meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    })
    return ['todos', ...Array.from(meses).sort().reverse()]
  }, [sesiones])

  const sesionesFiltradas = useMemo(() => {
    return sesiones.filter(s => {
      if (filtroPrograma !== 'todos' && s.programaNombre !== filtroPrograma) return false
      if (filtroMes !== 'todos') {
        const d = toDate(s.fecha)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (key !== filtroMes) return false
      }
      return true
    })
  }, [sesiones, filtroPrograma, filtroMes])

  function confirmarEliminarSesion(sesion) {
    setConfirmData({
      titulo: `¿Eliminar esta sesión?`,
      descripcion: `${sesion.diaNombre} — ${formatFecha(sesion.fecha)}. Se borrarán todos los registros de series.`,
      icon: '🗑️',
      onConfirm: async () => {
        try {
          await eliminarSesionConAgregados(sesion.id, {
            usuarioId: usuario.id,
            fecha: sesion.fecha,
            ejercicios: sesion.resumen?.ejercicios ?? [],
          })
          if (usuario?.id) localStorage.removeItem(`calendario_${usuario.id}`)
        } catch (e) {
          console.error(e)
          show({ message: 'No se pudo eliminar la sesión. Intentá de nuevo.', variant: 'error' })
        }
        cargar()
      },
    })
  }

  const historialContent = (
    <HistorialTab
      errorCarga={errorCarga}
      cargar={cargar}
      sesiones={sesiones}
      navigate={navigate}
      frec={frec}
      maxFrec={maxFrec}
      uniqueProgramas={uniqueProgramas}
      filtroPrograma={filtroPrograma}
      setFiltroPrograma={setFiltroPrograma}
      uniqueMeses={uniqueMeses}
      filtroMes={filtroMes}
      setFiltroMes={setFiltroMes}
      sesionesFiltradas={sesionesFiltradas}
      onEliminar={confirmarEliminarSesion}
      hayMas={hayMas}
      cargandoMas={cargandoMas}
      cargarMas={cargarMas}
    />
  )

  const graficoContent = (
    <GraficoTab
      ejercicios={ejercicios}
      grupos={grupos}
      grupoSel={grupoSel}
      setGrupoSel={setGrupoSel}
      ejercicioSel={ejercicioSel}
      setEjercicioSel={setEjercicioSel}
      modoGrafico={modoGrafico}
      setModoGrafico={setModoGrafico}
      datosGrafico={datosGrafico}
    />
  )

  const volumenContent = <VolumenTab datosVolumen={datosVolumen} />

  const rachasContent = <RachasTab resumenGlobal={resumenGlobal} streaks={streaks} />

  const pesoContent = (
    <PesoTab
      cargandoPeso={cargandoPeso}
      historialPeso={historialPeso}
      onRegistrarPeso={abrirModalPeso}
    />
  )

  return (
    <PageWrapper>
      <PullToRefresh onRefresh={cargar}>
        <HeaderProgreso isDesktop={isDesktop} navigate={navigate} />

      {isDesktop ? (
        cargando ? (
          <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
            <span className="spinner" style={{ color: 'var(--blue)' }} />
          </div>
        ) : (
          <div className="progreso-desktop-grid">
            <div className="progreso-desktop-col">
              <div className="card progreso-desktop-panel">
                <p className="progreso-desktop-panel-titulo">Evolución de ejercicios</p>
                <LazyPanel minHeight={320}>{graficoContent}</LazyPanel>
              </div>
              <div className="card progreso-desktop-panel">
                <p className="progreso-desktop-panel-titulo">Volumen total</p>
                <LazyPanel minHeight={280}>{volumenContent}</LazyPanel>
              </div>
              <div className="card progreso-desktop-panel">
                <p className="progreso-desktop-panel-titulo">Peso corporal</p>
                {pesoContent}
              </div>
            </div>
            <div className="progreso-desktop-col-narrow">
              <div className="card progreso-desktop-panel">
                <p className="progreso-desktop-panel-titulo">Rachas</p>
                <LazyPanel minHeight={200}>{rachasContent}</LazyPanel>
              </div>
              <div className="card progreso-desktop-panel">
                <p className="progreso-desktop-panel-titulo">Historial de sesiones</p>
                {historialContent}
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          {!cargando && (
            <div className="progreso-dash-wrap" data-testid="progreso-resumen-mini">
              <p className="progreso-sec-label">De un vistazo</p>
              <div className="progreso-dash-grid">
                <div className="card progreso-dash-tile">
                  <div className="progreso-dash-tile-header">
                    <span className="progreso-dash-fire">🔥</span>
                    <span className="progreso-dash-tile-label">Racha actual</span>
                  </div>
                  <div className="progreso-dash-streak-row">
                    <span className="progreso-dash-streak-num">{streaks.actual}</span>
                  </div>
                  <span className="progreso-dash-sub">días seguidos</span>
                </div>

                <div className="card progreso-dash-tile">
                  <div className="progreso-dash-tile-header">
                    <svg className="progreso-dash-tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                    <span className="progreso-dash-tile-label">Volumen semana</span>
                  </div>
                  <span className="progreso-dash-num">{Math.round(volSemana.actual).toLocaleString('es-UY')} kg</span>
                  {volSemana.anterior > 0 && (
                    <div className={`progreso-dash-delta ${volSemana.actual >= volSemana.anterior ? 'progreso-dash-delta--up' : 'progreso-dash-delta--down'}`}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        {volSemana.actual >= volSemana.anterior
                          ? <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>
                          : <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 19 19 12" /></>}
                      </svg>
                      {volSemana.actual >= volSemana.anterior ? '+' : ''}{Math.round(((volSemana.actual - volSemana.anterior) / volSemana.anterior) * 100)}%
                    </div>
                  )}
                  <span className="progreso-dash-sub">vs {Math.round(volSemana.anterior).toLocaleString('es-UY')} kg sem. pasada</span>
                </div>

                <div className="card progreso-dash-tile">
                  <div className="progreso-dash-tile-header">
                    <svg className="progreso-dash-tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span className="progreso-dash-tile-label">Sesiones</span>
                  </div>
                  <span className="progreso-dash-num">{sesionesMes}</span>
                  <span className="progreso-dash-sub">este mes</span>
                </div>

                <div className="card progreso-dash-tile">
                  <div className="progreso-dash-tile-header">
                    <svg className="progreso-dash-tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="8" r="6" />
                      <path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5" />
                    </svg>
                    <span className="progreso-dash-tile-label">PR reciente</span>
                  </div>
                  {prReciente ? (
                    <>
                      <span className="progreso-dash-pr-name">{prReciente.nombre}</span>
                      <span className="progreso-dash-pr-val">
                        {prReciente.tipo === 'volumen' ? `${prReciente.pesoUsado} kg × ${prReciente.repsHechas}` : `${prReciente.maxPeso} kg`}
                      </span>
                      <span className="progreso-dash-sub">{tiempoRelativo(prReciente.fecha)}</span>
                    </>
                  ) : (
                    <span className="progreso-dash-sub">Todavía sin marcas</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="progreso-tabs" role="tablist" aria-label="Vistas de progreso">
            {TABS.map(t => {
              const activo = tab === t
              return (
                <motion.button
                  key={t}
                  className="progreso-tab"
                  onClick={() => setTab(t)}
                  whileTap={{ scale: 0.97 }}
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={activo}
                  aria-controls="progreso-panel"
                >
                  <span className="progreso-tab-label" style={{ color: activo ? 'var(--orange)' : 'var(--text-mute)' }}>{t}</span>
                  {activo && (
                    <motion.div
                      layoutId="progresoTabUnderline"
                      className="progreso-tab-indicator"
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
            <motion.div
              key={tab}
              id="progreso-panel"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'Historial' && historialContent}
              {tab === 'Gráfico' && graficoContent}
              {tab === 'Volumen' && volumenContent}
              {tab === 'Rachas' && rachasContent}
              {tab === 'Peso' && pesoContent}
            </motion.div>
          )}
        </>
      )}

      <ConfirmDialog open={!!confirmData} data={confirmData} onClose={() => setConfirmData(null)} />

      <PesoModal
        open={modalPeso}
        onClose={() => { setModalPeso(false); setErrorPeso('') }}
        pesoInput={pesoInput}
        setPesoInput={setPesoInput}
        errorPeso={errorPeso}
        onGuardar={handleGuardarPeso}
      />

      </PullToRefresh>
    </PageWrapper>
  )
}

