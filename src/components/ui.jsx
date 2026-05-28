import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, AlertTriangle } from 'lucide-react'

const ACCENT_GRAD = {
  'var(--green)':  'var(--green-grad)',
  'var(--orange)': 'var(--orange-grad)',
  'var(--blue)':   'var(--blue-grad)',
}

export function Header({ titulo, subtitulo, accent = 'var(--green)', onBack, onAdd, right, breadcrumbs }) {
  const navigate = useNavigate()
  return (
    <motion.div
      style={hs.header}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.button
        style={hs.back}
        onClick={onBack ?? (() => navigate(-1))}
        whileTap={{ scale: 0.9, x: -2 }}
      >
        <ChevronLeft size={20} strokeWidth={2} />
      </motion.button>
      <div style={hs.info}>
        {breadcrumbs && (
          <div style={hs.bc}>
            {breadcrumbs.map((b, i) => (
              <span key={i}>
                <span style={hs.bcLink} onClick={b.onClick}>{b.label}</span>
                {i < breadcrumbs.length - 1 && <span style={hs.bcSep}> / </span>}
              </span>
            ))}
          </div>
        )}
        {subtitulo && <p style={{ ...hs.sub, color: accent }}>{subtitulo}</p>}
        <h1 style={hs.titulo}>{titulo}</h1>
      </div>
      {onAdd && (
        <motion.button
          style={{ ...hs.addBtn, background: ACCENT_GRAD[accent] || 'var(--green-grad)' }}
          onClick={onAdd}
          whileTap={{ scale: 0.88, rotate: 90 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        >
          <Plus size={20} strokeWidth={2.5} />
        </motion.button>
      )}
      {right}
    </motion.div>
  )
}

export function Modal({ open, onClose, children }) {
  const onCloseRef = useRef(onClose)
  const firstFocusRef = useRef(null)
  const triggerRef = useRef(null)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    triggerRef.current = document.activeElement
    window.history.pushState({ modal: true }, '')
    const handler = () => { onCloseRef.current?.() }
    window.addEventListener('popstate', handler)
    requestAnimationFrame(() => {
      const btns = document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (btns.length) {
        firstFocusRef.current = btns[0]
        btns[0].focus()
      }
    })
    return () => {
      window.removeEventListener('popstate', handler)
      if (window.history.state?.modal) window.history.back()
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          style={ms.overlay}
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onPointerDown={e => e.stopPropagation()}
        >
          <motion.div
            style={ms.box}
            onClick={e => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div style={ms.handle} />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ListSkeleton({ count = 3, height = 92 }) {
  return (
    <div style={ks.lista}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ ...ks.item, height }} />
      ))}
    </div>
  )
}

export function EmptyState({ mensaje, icon, action, sub }) {
  const Icon = icon && typeof icon !== 'string' ? icon : null
  const emojiIcon = typeof icon === 'string' ? icon : null
  return (
    <motion.div
      style={es.wrap}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div style={es.iconWrap}>
        {Icon
          ? <Icon size={26} color="var(--text-dim)" strokeWidth={1.5} />
          : <span style={es.icon}>{emojiIcon ?? '✨'}</span>
        }
      </div>
      <p style={es.text}>{mensaje}</p>
      {sub && <p style={es.sub}>{sub}</p>}
      {action && (
        <motion.button
          style={es.actionBtn}
          onClick={action.onClick}
          whileTap={{ scale: 0.97 }}
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  )
}

export function ConfirmDialog({ open, data, onClose }) {
  return (
    <Modal open={open} onClose={onClose}>
      {data && (
        <>
          <div style={cd.iconWrap}>
            {data.icon && typeof data.icon !== 'string'
              ? <data.icon size={24} color="var(--danger)" strokeWidth={1.5} />
              : <AlertTriangle size={24} color="var(--danger)" strokeWidth={1.5} />
            }
          </div>
          <h2 style={cd.titulo}>{data.titulo}</h2>
          {data.descripcion && <p style={cd.descripcion}>{data.descripcion}</p>}
          <div style={cd.btns}>
            <motion.button style={cd.cancelBtn} onClick={onClose} whileTap={{ scale: 0.97 }}>
              {data.cancelLabel || 'Cancelar'}
            </motion.button>
            <motion.button
              style={data.danger === false ? cd.confirmBtn : cd.confirmDangerBtn}
              onClick={async () => { try { await data.onConfirm?.() } catch (e) { console.error(e) } finally { onClose() } }}
              whileTap={{ scale: 0.97 }}
            >
              {data.confirmLabel || 'Eliminar'}
            </motion.button>
          </div>
        </>
      )}
    </Modal>
  )
}

const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function PageWrapper({ children, style }) {
  const navigate = useNavigate()

  const handleDragEnd = (_, info) => {
    if (document.body.classList.contains('dnd-active')) return
    if (info.offset.x > 80) {
      navigate(-1)
    }
  }

  return (
    <motion.div
      style={{ minHeight: '100dvh', color: 'var(--text)', paddingBottom: '100px', ...style }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      drag={isTouch ? 'x' : false}
      dragConstraints={{ left: 0, right: 200 }}
      dragElastic={{ left: 0, right: 0.4 }}
      onDragEnd={handleDragEnd}
      dragSnapToOrigin
    >
      {children}
      <div style={{ textAlign: 'center', padding: '24px 0 8px', color: 'var(--text-dim)', fontSize: '0.72rem' }}>
        Diseñado por{' '}
        <a href="https://azael-p.github.io/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)', textDecoration: 'none' }}>
          Azael Pignanessi
        </a>
      </div>
    </motion.div>
  )
}

const BADGE_COLORS = {
  green:   { bg: 'rgba(93, 202, 165, 0.14)',  color: 'var(--green)',  border: 'rgba(93, 202, 165, 0.22)' },
  orange:  { bg: 'rgba(240, 153, 123, 0.14)', color: 'var(--orange)', border: 'rgba(240, 153, 123, 0.22)' },
  blue:    { bg: 'rgba(133, 183, 235, 0.14)', color: 'var(--blue)',   border: 'rgba(133, 183, 235, 0.22)' },
  red:     { bg: 'rgba(255, 107, 107, 0.14)', color: 'var(--danger)', border: 'rgba(255, 107, 107, 0.22)' },
  default: { bg: 'var(--bg-input)',           color: 'var(--text-mute)', border: 'var(--border)' },
}

export function Badge({ children, color = 'default' }) {
  const c = BADGE_COLORS[color] || BADGE_COLORS.default
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px',
      borderRadius: '6px',
      fontSize: '0.7rem', fontWeight: 600,
      letterSpacing: '0.02em',
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export function SectionLabel({ children, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      marginBottom: '6px',
    }}>
      <span style={{
        fontSize: '0.68rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.07em',
        color: 'var(--text-dim)',
      }}>
        {children}
      </span>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: '0.78rem', color: 'var(--orange)',
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

const hs = {
  header: {
    display: 'flex', alignItems: 'center',
    padding: '20px 16px 16px',
    paddingTop: 'max(20px, env(safe-area-inset-top))',
    gap: '12px',
    borderBottom: '1px solid var(--border)',
  },
  back: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    width: '44px', height: '44px',
    borderRadius: '12px', fontSize: '1.2rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1 },
  bc: { display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.7rem', color: 'var(--text-dim)', marginBottom: '2px' },
  bcLink: { cursor: 'pointer', color: 'var(--text-dim)', ':hover': { color: 'var(--text)' } },
  bcSep: { color: 'var(--border-strong)', margin: '0 1px' },
  sub: { margin: 0, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' },
  titulo: { margin: '2px 0 0', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em' },
  addBtn: {
    color: '#fff', border: 'none', borderRadius: '12px',
    width: '44px', height: '44px', fontSize: '1.6rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 22px rgba(0,0,0,0.35)',
    flexShrink: 0,
  },
}

const ms = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'var(--bg-overlay)',
    display: 'flex', alignItems: 'flex-end',
    zIndex: 100,
    backdropFilter: 'blur(8px)',
  },
  box: {
    background: 'var(--bg-elev)',
    width: '100%',
    padding: '20px 20px 28px',
    paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
    borderRadius: '24px 24px 0 0',
    display: 'flex', flexDirection: 'column',
    gap: '14px',
    border: '1px solid var(--border)',
    borderBottom: 'none',
  },
  handle: {
    width: '36px', height: '4px',
    background: 'var(--border-strong)',
    borderRadius: '2px',
    margin: '0 auto 4px',
  },
}

const ks = {
  lista: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 14px 0' },
  item: { borderRadius: 'var(--r-lg)' },
}

const es = {
  wrap: { padding: '60px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' },
  iconWrap: {
    width: '56px', height: '56px',
    borderRadius: '18px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '4px',
  },
  icon: { fontSize: '1.6rem' },
  text: { color: 'var(--text-mute)', fontSize: '0.95rem', maxWidth: '280px', lineHeight: 1.5 },
  sub: { color: 'var(--text-dim)', fontSize: '0.82rem', maxWidth: '260px', lineHeight: 1.4, marginTop: '2px' },
  actionBtn: {
    marginTop: '8px', padding: '14px 28px',
    background: 'var(--orange-grad)', color: '#fff',
    border: 'none', borderRadius: 'var(--r-md)',
    fontSize: '0.95rem', fontWeight: 700,
    boxShadow: '0 8px 24px rgba(199, 90, 48, 0.35)',
  },
}

const cd = {
  iconWrap: {
    width: '52px', height: '52px',
    borderRadius: '16px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '2px auto 4px',
  },
  icon: { fontSize: '1.5rem' },
  titulo: { margin: 0, fontSize: '1.1rem', fontWeight: 700, textAlign: 'center', letterSpacing: '-0.01em' },
  descripcion: { margin: 0, color: 'var(--text-mute)', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.45 },
  btns: { display: 'flex', gap: '10px', marginTop: '4px' },
  cancelBtn: { flex: 1, padding: '14px', background: 'var(--bg-input)', color: 'var(--text-mute)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 500 },
  confirmBtn: { flex: 1, padding: '14px', background: 'var(--orange-grad)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700 },
  confirmDangerBtn: { flex: 1, padding: '14px', background: 'linear-gradient(135deg, #c44747, #d95252)', color: '#fff', border: 'none', borderRadius: 'var(--r-md)', fontSize: '0.95rem', fontWeight: 700, boxShadow: '0 6px 18px rgba(255, 107, 107, 0.3)' },
}
