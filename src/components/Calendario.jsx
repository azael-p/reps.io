import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { toDate } from '../utils/fechas'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function Calendario({ fechas = [] }) {
  const [referencia, setReferencia] = useState(new Date())
  const [direccion, setDireccion] = useState(0)

  const año = referencia.getFullYear()
  const mes = referencia.getMonth()

  const fechasSet = useMemo(() => new Set(
    fechas.map(f => {
      const d = toDate(f)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  ), [fechas])

  function tieneSesion(dia) {
    return fechasSet.has(`${año}-${mes}-${dia}`)
  }

  const hoy = new Date()
  function esHoy(dia) {
    return dia === hoy.getDate() && mes === hoy.getMonth() && año === hoy.getFullYear()
  }
  function esFuturo(dia) {
    if (año > hoy.getFullYear()) return true
    if (año === hoy.getFullYear() && mes > hoy.getMonth()) return true
    if (año === hoy.getFullYear() && mes === hoy.getMonth() && dia > hoy.getDate()) return true
    return false
  }

  const primerDia = new Date(año, mes, 1).getDay()
  const offset = (primerDia + 6) % 7
  const diasEnMes = new Date(año, mes + 1, 0).getDate()

  const celdas = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let i = 1; i <= diasEnMes; i++) celdas.push(i)
  while (celdas.length % 7 !== 0) celdas.push(null)

  function irMesAnterior() {
    setDireccion(-1)
    setReferencia(new Date(año, mes - 1, 1))
  }
  function irMesSiguiente() {
    setDireccion(1)
    setReferencia(new Date(año, mes + 1, 1))
  }

  // Total de sesiones en este mes
  const sesionesEsteMes = celdas.filter(d => d && tieneSesion(d)).length

  return (
    <div className="card calendario-card">
      <div className="calendario-header">
        <motion.button
          className="calendario-nav-btn"
          onClick={irMesAnterior}
          whileTap={{ scale: 0.85 }}
          whileHover={{ background: 'rgba(255,255,255,0.06)' }}
          aria-label="Mes anterior"
        >
          ‹
        </motion.button>
        <div className="calendario-header-center">
          <AnimatePresence mode="wait" custom={direccion}>
            <motion.span
              key={`${año}-${mes}`}
              className="calendario-mes-label"
              custom={direccion}
              initial={{ opacity: 0, x: direccion * 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direccion * 15 }}
              transition={{ duration: 0.2 }}
            >
              {MESES[mes]} {año}
            </motion.span>
          </AnimatePresence>
          {sesionesEsteMes > 0 && (
            <motion.span
              key={`count-${año}-${mes}`}
              className="calendario-counter"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {sesionesEsteMes} sesiones
            </motion.span>
          )}
        </div>
        <motion.button
          className="calendario-nav-btn"
          onClick={irMesSiguiente}
          whileTap={{ scale: 0.85 }}
          whileHover={{ background: 'rgba(255,255,255,0.06)' }}
          aria-label="Mes siguiente"
        >
          ›
        </motion.button>
      </div>

      <div className="calendario-grid">
        {DIAS_SEMANA.map((d, i) => (
          <div key={`h-${i}`} className="calendario-dia-header">{d}</div>
        ))}
        <AnimatePresence mode="wait" custom={direccion}>
          <motion.div
            key={`${año}-${mes}-cells`}
            className="calendario-cell-grid"
            custom={direccion}
            initial={{ opacity: 0, x: direccion * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direccion * 20 }}
            transition={{ duration: 0.22 }}
          >
            {celdas.map((dia, i) => {
              if (!dia) return <div key={i} className="calendario-dia-empty" />
              const sesion = tieneSesion(dia)
              const hoyFlag = esHoy(dia)
              const futuro = esFuturo(dia)
              const fechaLabel = `${dia} de ${MESES[mes]}, ${sesion ? 'sesión registrada' : 'sin sesión'}`
              const claseDia = [
                'calendario-dia',
                sesion && 'calendario-dia--sesion',
                hoyFlag && 'calendario-dia--hoy',
                futuro && 'calendario-dia--futuro',
                !sesion && !hoyFlag && 'calendario-dia--vacio',
              ].filter(Boolean).join(' ')
              return (
                <motion.div
                  key={i}
                  className={claseDia}
                  whileHover={!sesion && !futuro ? { scale: 1.05, borderColor: 'var(--border-strong)' } : {}}
                  role="img"
                  aria-label={fechaLabel}
                  initial={sesion ? { scale: 0.5, opacity: 0 } : false}
                  animate={sesion ? { scale: 1, opacity: 1 } : {}}
                  transition={{ delay: 0.02 * (i % 14), type: 'spring', stiffness: 320, damping: 20 }}
                >
                  <span style={{
                    color: futuro ? 'var(--text-dim)' : sesion ? '#fff' : hoyFlag ? 'var(--text)' : 'var(--text-dim)',
                    fontWeight: sesion || hoyFlag ? 700 : 500,
                    opacity: futuro ? 0.35 : 1,
                    position: 'relative', zIndex: 1,
                  }}>{dia}</span>
                  {hoyFlag && (
                    <span
                      className="pulse"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 'inherit',
                        border: '2px solid var(--orange)',
                        opacity: 0.6,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
