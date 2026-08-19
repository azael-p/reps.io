import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useUser } from '../context/UserContext'
import { signInWithGoogle } from '../firebase/auth'
import { useDesktop } from '../hooks/useDesktop'

const FEATURES = [
  {
    icon: '📋',
    titulo: 'Organizá tus rutinas',
    desc: 'Creá programas con días y ejercicios personalizados para cada músculo.',
  },
  {
    icon: '🔥',
    titulo: 'Registrá cada sesión',
    desc: 'Anotá peso, repeticiones y notas en tiempo real mientras entrenás.',
  },
  {
    icon: '📈',
    titulo: 'Seguí tu progreso',
    desc: 'Visualizá tu evolución con gráficos y estadísticas de cada ejercicio.',
  },
]

const INSTALL_IOS = [
  { paso: '1', texto: 'Abrí esta página en Safari o Chrome' },
  { paso: '2', texto: 'Tocá el botón compartir ⬆️ (Safari) o los tres puntos ⋯ (Chrome)' },
  { paso: '3', texto: 'Seleccioná "Agregar a pantalla de inicio"' },
]

const INSTALL_ANDROID = [
  { paso: '1', texto: 'Abrí esta página en Chrome' },
  { paso: '2', texto: 'Tocá los tres puntos ⋮ arriba a la derecha' },
  { paso: '3', texto: 'Seleccioná "Agregar a pantalla de inicio"' },
]

export default function Login() {
  const isDesktop = useDesktop()
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')
  const [tabInstall, setTabInstall] = useState('ios')
  const { usuario, loading } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (usuario) navigate('/home', { replace: true })
  }, [usuario, navigate])

  async function handleGoogle() {
    setProcesando(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      const ignored = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request']
      if (!ignored.includes(e.code)) setError('Error al iniciar sesión. Intentá de nuevo.')
      setProcesando(false)
    }
  }

  if (loading) return null

  if (isDesktop) {
    return (
      <motion.div
        className="login-desktop-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Left — marketing */}
        <div className="login-desktop-left">
          <motion.div
            className="login-desktop-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          >
            <div className="login-logo-circle-lg">
              <span className="login-logo-text-lg">R</span>
            </div>
            <h1 className="login-brand-lg">Reps<span className="login-brand-dot">.</span>io</h1>
            <p className="login-tagline-lg">Tu gym tracker personal</p>
          </motion.div>

          <motion.section
            className="login-desktop-section"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <h2 className="login-section-title">¿Qué es Reps.io?</h2>
            <p className="login-section-desc">
              Una app para registrar tus entrenamientos, llevar el control de pesos y repeticiones,
              y ver tu progreso a lo largo del tiempo. Sin distracciones, pensada para usarla
              con el celular en la mano entre series.
            </p>
          </motion.section>

          <motion.div
            className="login-features"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            {FEATURES.map((f) => (
              <div key={f.titulo} className="card login-feature-card">
                <span className="login-feature-icon">{f.icon}</span>
                <div>
                  <p className="login-feature-titulo">{f.titulo}</p>
                  <p className="login-feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right — login panel */}
        <div className="login-desktop-right">
          <div className="login-glow" />
          <div className="login-desktop-panel">
            <motion.div
              className="login-logo-wrap"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            >
              <div className="login-logo-circle">
                <span className="login-logo-text">R</span>
              </div>
              <h1 className="login-brand">Reps<span className="login-brand-dot">.</span>io</h1>
              <p className="login-tagline">Tu gym tracker personal</p>
            </motion.div>

            <motion.div
              style={{ width: '100%' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {error && (
                <motion.p className="login-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.p>
              )}
              <motion.button
                className="login-google-btn"
                style={{ opacity: procesando ? 0.6 : 1 }}
                onClick={handleGoogle}
                disabled={procesando}
                whileTap={{ scale: procesando ? 1 : 0.97 }}
                whileHover={{ y: procesando ? 0 : -2 }}
              >
                {procesando ? <span className="login-spinner" /> : <GoogleIcon />}
                <span>{procesando ? 'Ingresando…' : 'Continuar con Google'}</span>
              </motion.button>
            </motion.div>

            <motion.div
              className="login-divider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            />

            <motion.section
              className="login-section"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
            >
              <h2 className="login-section-title">Cómo instalarla</h2>
              <p className="login-section-desc">
                Reps.io es una PWA — podés instalarla en tu celular como una app nativa,
                sin pasar por el App Store ni Google Play.
              </p>

              <div className="login-tabs">
                {['ios', 'android'].map((t) => (
                  <button
                    key={t}
                    className={`login-tab ${tabInstall === t ? 'login-tab--active' : ''}`}
                    onClick={() => setTabInstall(t)}
                  >
                    {t === 'ios' ? '🍎 iOS' : '🤖 Android'}
                  </button>
                ))}
              </div>

              <div className="login-pasos">
                {(tabInstall === 'ios' ? INSTALL_IOS : INSTALL_ANDROID).map((p) => (
                  <div key={p.paso} className="login-paso">
                    <span className="login-paso-badge">{p.paso}</span>
                    <span className="login-paso-texto">{p.texto}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="login-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="login-glow" />

      <div className="login-inner">

        {/* — Hero — */}
        <motion.div
          className="login-logo-wrap"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div className="login-logo-circle">
            <span className="login-logo-text">R</span>
          </div>
          <h1 className="login-brand">Reps<span className="login-brand-dot">.</span>io</h1>
          <p className="login-tagline">Tu gym tracker personal</p>
        </motion.div>

        {/* — Login — */}
        <motion.div
          style={{ width: '100%' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          {error && (
            <motion.p className="login-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              {error}
            </motion.p>
          )}
          <motion.button
            className="login-google-btn"
            style={{ opacity: procesando ? 0.6 : 1 }}
            onClick={handleGoogle}
            disabled={procesando}
            whileTap={{ scale: procesando ? 1 : 0.97 }}
            whileHover={{ y: procesando ? 0 : -2 }}
          >
            {procesando ? <span className="login-spinner" /> : <GoogleIcon />}
            <span>{procesando ? 'Ingresando…' : 'Continuar con Google'}</span>
          </motion.button>
        </motion.div>

        {/* — Divider — */}
        <motion.div
          className="login-divider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        />

        {/* — Qué es — */}
        <motion.section
          className="login-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <h2 className="login-section-title">¿Qué es Reps.io?</h2>
          <p className="login-section-desc">
            Una app para registrar tus entrenamientos, llevar el control de pesos y repeticiones,
            y ver tu progreso a lo largo del tiempo. Sin distracciones, pensada para usarla
            con el celular en la mano entre series.
          </p>
        </motion.section>

        {/* — Features — */}
        <motion.div
          className="login-features"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          {FEATURES.map((f) => (
            <div key={f.titulo} className="card login-feature-card">
              <span className="login-feature-icon">{f.icon}</span>
              <div>
                <p className="login-feature-titulo">{f.titulo}</p>
                <p className="login-feature-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* — Instalación — */}
        <motion.section
          className="login-section"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          <h2 className="login-section-title">Cómo instalarla</h2>
          <p className="login-section-desc">
            Reps.io es una PWA — podés instalarla en tu celular como una app nativa,
            sin pasar por el App Store ni Google Play.
          </p>

          <div className="login-tabs">
            {['ios', 'android'].map((t) => (
              <button
                key={t}
                className={`login-tab ${tabInstall === t ? 'login-tab--active' : ''}`}
                onClick={() => setTabInstall(t)}
              >
                {t === 'ios' ? '🍎 iOS' : '🤖 Android'}
              </button>
            ))}
          </div>

          <div className="login-pasos">
            {(tabInstall === 'ios' ? INSTALL_IOS : INSTALL_ANDROID).map((p) => (
              <div key={p.paso} className="login-paso">
                <span className="login-paso-badge">{p.paso}</span>
                <span className="login-paso-texto">{p.texto}</span>
              </div>
            ))}
          </div>
        </motion.section>

        <div style={{ height: 'max(20px, env(safe-area-inset-bottom))' }} />
      </div>
    </motion.div>
  )
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

