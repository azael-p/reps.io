import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function Calendario({ fechas = [] }) {
  const [referencia, setReferencia] = useState(new Date())
  const [direccion, setDireccion] = useState(0)

  const año = referencia.getFullYear()
  const mes = referencia.getMonth()

  const fechasSet = new Set(
    fechas.map(f => {
      const d = f?.toDate ? f.toDate() : new Date(f)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

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
    <div style={s.card}>
      <div style={s.header}>
        <motion.button
          style={s.navBtn}
          onClick={irMesAnterior}
          whileTap={{ scale: 0.85 }}
          whileHover={{ background: 'rgba(255,255,255,0.06)' }}
        >
          ‹
        </motion.button>
        <div style={s.headerCenter}>
          <AnimatePresence mode="wait" custom={direccion}>
            <motion.span
              key={`${año}-${mes}`}
              style={s.mesLabel}
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
              style={s.counter}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {sesionesEsteMes} sesiones
            </motion.span>
          )}
        </div>
        <motion.button
          style={s.navBtn}
          onClick={irMesSiguiente}
          whileTap={{ scale: 0.85 }}
          whileHover={{ background: 'rgba(255,255,255,0.06)' }}
        >
          ›
        </motion.button>
      </div>

      <div style={s.grid}>
        {DIAS_SEMANA.map((d, i) => (
          <div key={`h-${i}`} style={s.diaHeader}>{d}</div>
        ))}
        <AnimatePresence mode="wait" custom={direccion}>
          <motion.div
            key={`${año}-${mes}-cells`}
            style={s.cellGrid}
            custom={direccion}
            initial={{ opacity: 0, x: direccion * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direccion * 20 }}
            transition={{ duration: 0.22 }}
          >
            {celdas.map((dia, i) => {
              if (!dia) return <div key={i} style={s.diaEmpty} />
              const sesion = tieneSesion(dia)
              const hoyFlag = esHoy(dia)
              const futuro = esFuturo(dia)
              return (
                <motion.div
                  key={i}
                  style={{
                    ...s.dia,
                    ...(sesion ? s.diaSesion : {}),
                    ...(hoyFlag ? s.diaHoy : {}),
                    ...(futuro ? s.diaFuturo : {}),
                  }}
                  initial={sesion ? { scale: 0.5, opacity: 0 } : false}
                  animate={sesion ? { scale: 1, opacity: 1 } : {}}
                  transition={{ delay: 0.02 * (i % 14), type: 'spring', stiffness: 320, damping: 20 }}
                >
                  <span style={{
                    color: futuro ? 'var(--text-dim)' : sesion ? '#fff' : hoyFlag ? 'var(--text)' : 'var(--text-dim)',
                    fontWeight: sesion || hoyFlag ? 700 : 500,
                    opacity: futuro ? 0.35 : 1,
                  }}>{dia}</span>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

const s = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: '14px 14px 12px',
    boxShadow: 'var(--shadow-sm)',
    maxWidth: '420px',
    width: '100%',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  headerCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  mesLabel: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  counter: {
    fontSize: '0.65rem',
    color: 'var(--orange)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  navBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-mute)',
    fontSize: '1.6rem',
    width: '44px', height: '44px',
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    lineHeight: 1,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  },
  cellGrid: {
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '3px',
  },
  diaHeader: {
    textAlign: 'center',
    fontSize: '0.62rem',
    color: 'var(--text-dim)',
    fontWeight: 700,
    paddingBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  diaEmpty: { aspectRatio: '1' },
  dia: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    fontSize: '0.85rem',
  },
  diaSesion: {
    background: 'linear-gradient(135deg, #8e3618 0%, #c75a30 100%)',
    boxShadow: '0 4px 12px rgba(240, 153, 123, 0.25)',
  },
  diaHoy: {
    border: '1.5px solid var(--text)',
  },
  diaFuturo: {
    opacity: 0.5,
  },
}
