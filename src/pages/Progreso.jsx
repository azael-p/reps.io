import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useUser } from '../context/UserContext'
import { getSesionesPaginadas, enrichSesionesConPrograma, eliminarSesion, esMismoEjercicio } from '../firebase/sesiones'
import { getResumenGlobalConFallback, removerSesionDeResumenGlobal } from '../firebase/statsGlobal'
import { getStatsEjerciciosConFallback, rebuildStatsEjercicios } from '../firebase/statsEjercicios'
import { getHistorialPeso, agregarPeso } from '../firebase/peso'
import { PageWrapper, ConfirmDialog } from '../components/ui'
import PullToRefresh from '../components/PullToRefresh'
import LazyPanel from '../components/LazyPanel'
import { useDesktop } from '../hooks/useDesktop'
import { useToast } from '../components/Toast'
import { frecuenciaSemanal, calcularStreaks } from '../utils/stats'
import { toDate } from '../utils/fechas'
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
  const [guardandoPeso, setGuardandoPeso] = useState(false)

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
    } catch (e) { console.error(e) }
    setPesoCargado(true)
    setCargandoPeso(false)
  }, [usuario])

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
    return resumenGlobal.volumenPorSesion
      .map(d => ({ fecha: formatFechaCorta(d.fecha), volumen: d.volumen }))
      .map((d, i) => ({ ...d, xKey: `${d.fecha}#${i}` }))
  }, [tab, isDesktop, resumenGlobal])

  // Rachas — desde los días entrenados del agregado
  const streaks = useMemo(
    () => calcularStreaks(resumenGlobal?.diasEntrenados ?? []),
    [resumenGlobal]
  )

  // Peso corporal — sigue siendo Firestore (subcollección separada)
  useEffect(() => {
    if ((tab === 'Peso' || isDesktop) && !pesoCargado && !cargandoPeso) {
      cargarPeso()
    }
  }, [tab, isDesktop, pesoCargado, cargandoPeso, cargarPeso])

  async function handleGuardarPeso() {
    const kg = Number(pesoInput)
    if (!kg || kg < 20 || kg > 300) { setErrorPeso('Ingresá un peso entre 20 y 300 kg'); return }
    setErrorPeso('')
    setGuardandoPeso(true)
    try {
      await agregarPeso(usuario.id, kg)
      setModalPeso(false)
      setPesoCargado(false)
      cargarPeso()
    } catch (e) { console.error(e); setErrorPeso('Error al guardar. Intentá de nuevo.') }
    setGuardandoPeso(false)
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
          await eliminarSesion(sesion.id)
          await removerSesionDeResumenGlobal(usuario.id, { sesionId: sesion.id, fecha: sesion.fecha })
          await rebuildStatsEjercicios(usuario.id, sesion.resumen?.ejercicios ?? [])
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
          <div style={s.desktopGrid}>
            <div style={s.desktopCol}>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Evolución de ejercicios</p>
                <LazyPanel minHeight={320}>{graficoContent}</LazyPanel>
              </div>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Volumen total</p>
                <LazyPanel minHeight={280}>{volumenContent}</LazyPanel>
              </div>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Peso corporal</p>
                {pesoContent}
              </div>
            </div>
            <div style={s.desktopColNarrow}>
              <div style={s.desktopPanel}>
                <p style={s.desktopPanelTitle}>Rachas</p>
                <LazyPanel minHeight={200}>{rachasContent}</LazyPanel>
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
                  style={{ ...s.tab, position: 'relative' }}
                  onClick={() => setTab(t)}
                  whileTap={{ scale: 0.97 }}
                  aria-pressed={activo}
                >
                  <span style={{ ...s.tabLabel, color: activo ? 'var(--orange)' : 'var(--text-mute)' }}>{t}</span>
                  {activo && (
                    <motion.div
                      layoutId="progresoTabUnderline"
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
            <motion.div
              key={tab}
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
        guardandoPeso={guardandoPeso}
        onGuardar={handleGuardarPeso}
      />

      </PullToRefresh>
    </PageWrapper>
  )
}

const s = {
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
    bottom: -1, left: 0, right: 0,
    height: '2px',
    background: 'var(--orange-grad)',
    borderRadius: '2px',
    boxShadow: '0 0 8px rgba(240,153,123,0.5)',
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
