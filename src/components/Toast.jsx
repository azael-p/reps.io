import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

const VARIANT_STYLES = {
  success: {
    bg: 'var(--bg-card)',
    border: 'var(--border-green)',
    icon: <CheckCircle2 size={18} color="var(--green)" />,
    iconBg: 'rgba(93, 202, 165, 0.14)',
  },
  error: {
    bg: 'var(--bg-card)',
    border: 'rgba(255, 107, 107, 0.3)',
    icon: <AlertCircle size={18} color="var(--danger)" />,
    iconBg: 'var(--danger-bg)',
  },
  info: {
    bg: 'var(--bg-card)',
    border: 'var(--border-blue)',
    icon: <Info size={18} color="var(--blue)" />,
    iconBg: 'rgba(133, 183, 235, 0.14)',
  },
  warning: {
    bg: 'var(--bg-card)',
    border: 'var(--border-orange)',
    icon: <AlertCircle size={18} color="var(--orange)" />,
    iconBg: 'rgba(240, 153, 123, 0.14)',
  },
}

function ToastItem({ toast, onDismiss }) {
  const variant = VARIANT_STYLES[toast.variant] || VARIANT_STYLES.info
  const handleAction = (e) => {
    e.stopPropagation()
    // Descartar primero: cancela el timeoutId para que onTimeout (ej. borrado
    // definitivo) no dispare después de deshacer.
    onDismiss(toast.id)
    toast.action.onClick()
  }
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        // El contenedor usa pointerEvents:'none' para no bloquear la UI;
        // hay que restaurarlos acá o los botones del toast no reciben clicks.
        pointerEvents: 'auto',
        padding: '12px 14px',
        background: variant.bg,
        border: `1px solid ${variant.border}`,
        borderTopColor: 'var(--highlight)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--shadow-md), var(--shadow-inner)',
        cursor: toast.action ? 'default' : 'pointer',
      }}
      onClick={() => toast.action ? null : onDismiss(toast.id)}
      role={toast.action ? 'alertdialog' : 'alert'}
      aria-live="polite"
    >
      <div style={{
        width: 32, height: 32,
        borderRadius: 8,
        background: variant.iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {variant.icon}
      </div>
      <span style={{
        flex: 1,
        fontSize: '0.9rem',
        fontWeight: 500,
        color: 'var(--text)',
      }}>
        {toast.message}
      </span>
      {toast.action && (
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
          onClick={handleAction}
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(toast.id) }}
        style={{
          background: 'none', border: 'none',
          padding: 4, cursor: 'pointer',
          color: 'var(--text-mute)', display: 'flex',
        }}
        aria-label="Cerrar"
      >
        <X size={16} />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const show = useCallback((toast) => {
    const id = crypto.randomUUID()
    let timeoutId = null
    if (toast.duration !== 0) {
      timeoutId = setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
        // onTimeout va fuera del updater: los updaters deben ser puros
        // (StrictMode los ejecuta dos veces) y la promesa necesita su catch.
        if (toast.onTimeout) {
          Promise.resolve(toast.onTimeout()).catch(err => console.error(err))
        }
      }, toast.duration ?? 3000)
    }
    setToasts(t => [...t, { id, duration: 3000, variant: 'success', timeoutId, ...toast }])
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => {
      const toast = prev.find(t => t.id === id)
      if (toast?.timeoutId) clearTimeout(toast.timeoutId)
      return prev.filter(t => t.id !== id)
    })
  }, [])

  return (
    <ToastCtx.Provider value={{ show, dismiss }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 80,
        left: 0, right: 0,
        zIndex: 1000,
        pointerEvents: 'none',
        padding: '0 16px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <AnimatePresence>
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}