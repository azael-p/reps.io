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
        style={s.desktopContainer}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Left — marketing */}
        <div style={s.desktopLeft}>
          <motion.div
            style={s.desktopHero}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          >
            <div style={s.logoCircleLg}>
              <span style={s.logoTextLg}>R</span>
            </div>
            <h1 style={s.brandLg}>Reps<span style={s.brandDot}>.</span>io</h1>
            <p style={s.taglineLg}>Tu gym tracker personal</p>
          </motion.div>

          <motion.section
            style={s.desktopSection}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <h2 style={s.sectionTitle}>¿Qué es Reps.io?</h2>
            <p style={s.sectionDesc}>
              Una app para registrar tus entrenamientos, llevar el control de pesos y repeticiones,
              y ver tu progreso a lo largo del tiempo. Sin distracciones, pensada para usarla
              con el celular en la mano entre series.
            </p>
          </motion.section>

          <motion.div
            style={s.features}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            {FEATURES.map((f) => (
              <div key={f.titulo} style={s.featureCard}>
                <span style={s.featureIcon}>{f.icon}</span>
                <div>
                  <p style={s.featureTitulo}>{f.titulo}</p>
                  <p style={s.featureDesc}>{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right — login panel */}
        <div style={s.desktopRight}>
          <div style={s.glow} />
          <div style={s.desktopPanel}>
            <motion.div
              style={s.logoWrap}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            >
              <div style={s.logoCircle}>
                <span style={s.logoText}>R</span>
              </div>
              <h1 style={s.brand}>Reps<span style={s.brandDot}>.</span>io</h1>
              <p style={s.tagline}>Tu gym tracker personal</p>
            </motion.div>

            <motion.div
              style={{ width: '100%' }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {error && (
                <motion.p style={s.error} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                  {error}
                </motion.p>
              )}
              <motion.button
                style={{ ...s.googleBtn, opacity: procesando ? 0.6 : 1 }}
                onClick={handleGoogle}
                disabled={procesando}
                whileTap={{ scale: procesando ? 1 : 0.97 }}
                whileHover={{ y: procesando ? 0 : -2 }}
              >
                {procesando ? <span style={s.spinner} /> : <GoogleIcon />}
                <span>{procesando ? 'Ingresando…' : 'Continuar con Google'}</span>
              </motion.button>
            </motion.div>

            <motion.div
              style={s.divider}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            />

            <motion.section
              style={s.section}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4 }}
            >
              <h2 style={s.sectionTitle}>Cómo instalarla</h2>
              <p style={s.sectionDesc}>
                Reps.io es una PWA — podés instalarla en tu celular como una app nativa,
                sin pasar por el App Store ni Google Play.
              </p>

              <div style={s.tabs}>
                {['ios', 'android'].map((t) => (
                  <button
                    key={t}
                    style={{ ...s.tab, ...(tabInstall === t ? s.tabActive : {}) }}
                    onClick={() => setTabInstall(t)}
                  >
                    {t === 'ios' ? '🍎 iOS' : '🤖 Android'}
                  </button>
                ))}
              </div>

              <div style={s.pasos}>
                {(tabInstall === 'ios' ? INSTALL_IOS : INSTALL_ANDROID).map((p) => (
                  <div key={p.paso} style={s.paso}>
                    <span style={s.pasoBadge}>{p.paso}</span>
                    <span style={s.pasoTexto}>{p.texto}</span>
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
      style={s.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div style={s.glow} />

      <div style={s.inner}>

        {/* — Hero — */}
        <motion.div
          style={s.logoWrap}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div style={s.logoCircle}>
            <span style={s.logoText}>R</span>
          </div>
          <h1 style={s.brand}>Reps<span style={s.brandDot}>.</span>io</h1>
          <p style={s.tagline}>Tu gym tracker personal</p>
        </motion.div>

        {/* — Login — */}
        <motion.div
          style={{ width: '100%' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          {error && (
            <motion.p style={s.error} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              {error}
            </motion.p>
          )}
          <motion.button
            style={{ ...s.googleBtn, opacity: procesando ? 0.6 : 1 }}
            onClick={handleGoogle}
            disabled={procesando}
            whileTap={{ scale: procesando ? 1 : 0.97 }}
            whileHover={{ y: procesando ? 0 : -2 }}
          >
            {procesando ? <span style={s.spinner} /> : <GoogleIcon />}
            <span>{procesando ? 'Ingresando…' : 'Continuar con Google'}</span>
          </motion.button>
        </motion.div>

        {/* — Divider — */}
        <motion.div
          style={s.divider}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        />

        {/* — Qué es — */}
        <motion.section
          style={s.section}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <h2 style={s.sectionTitle}>¿Qué es Reps.io?</h2>
          <p style={s.sectionDesc}>
            Una app para registrar tus entrenamientos, llevar el control de pesos y repeticiones,
            y ver tu progreso a lo largo del tiempo. Sin distracciones, pensada para usarla
            con el celular en la mano entre series.
          </p>
        </motion.section>

        {/* — Features — */}
        <motion.div
          style={s.features}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
        >
          {FEATURES.map((f) => (
            <div key={f.titulo} style={s.featureCard}>
              <span style={s.featureIcon}>{f.icon}</span>
              <div>
                <p style={s.featureTitulo}>{f.titulo}</p>
                <p style={s.featureDesc}>{f.desc}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* — Instalación — */}
        <motion.section
          style={s.section}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          <h2 style={s.sectionTitle}>Cómo instalarla</h2>
          <p style={s.sectionDesc}>
            Reps.io es una PWA — podés instalarla en tu celular como una app nativa,
            sin pasar por el App Store ni Google Play.
          </p>

          <div style={s.tabs}>
            {['ios', 'android'].map((t) => (
              <button
                key={t}
                style={{ ...s.tab, ...(tabInstall === t ? s.tabActive : {}) }}
                onClick={() => setTabInstall(t)}
              >
                {t === 'ios' ? '🍎 iOS' : '🤖 Android'}
              </button>
            ))}
          </div>

          <div style={s.pasos}>
            {(tabInstall === 'ios' ? INSTALL_IOS : INSTALL_ANDROID).map((p) => (
              <div key={p.paso} style={s.paso}>
                <span style={s.pasoBadge}>{p.paso}</span>
                <span style={s.pasoTexto}>{p.texto}</span>
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

const s = {
  /* ── Mobile layout ── */
  container: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'max(40px, env(safe-area-inset-top)) 20px 0',
    position: 'relative',
    overflowX: 'hidden',
  },
  glow: {
    position: 'fixed',
    top: '-200px', left: '50%',
    transform: 'translateX(-50%)',
    width: '600px', height: '600px',
    background: 'radial-gradient(circle, rgba(133,183,235,0.12), transparent 60%)',
    pointerEvents: 'none', zIndex: 0,
  },
  inner: {
    width: '100%', maxWidth: '380px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '20px',
    position: 'relative', zIndex: 1,
  },

  /* ── Desktop layout ── */
  desktopContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: '100dvh',
  },
  desktopLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    padding: '64px 56px',
    overflowY: 'auto',
  },
  desktopHero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  desktopSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  desktopRight: {
    background: 'var(--bg-elev)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '64px 48px',
    position: 'relative',
    overflowY: 'auto',
  },
  desktopPanel: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    position: 'sticky',
    top: '40px',
    zIndex: 1,
  },

  /* ── Shared branding ── */
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
  logoCircle: {
    width: '64px', height: '64px', borderRadius: '20px',
    background: 'linear-gradient(135deg, #f0997b 0%, #c75a30 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 10px 30px rgba(240,153,123,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
  },
  logoText: { fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' },
  brand: { fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)', margin: 0 },
  brandDot: { color: 'var(--orange)' },
  tagline: { color: 'var(--text-mute)', fontSize: '0.9rem', margin: 0 },

  /* ── Desktop large hero branding ── */
  logoCircleLg: {
    width: '80px', height: '80px', borderRadius: '24px',
    background: 'linear-gradient(135deg, #f0997b 0%, #c75a30 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 14px 40px rgba(240,153,123,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
  },
  logoTextLg: { fontSize: '2.6rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' },
  brandLg: { fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text)', margin: 0 },
  taglineLg: { color: 'var(--text-mute)', fontSize: '1rem', margin: 0 },

  /* ── Google button ── */
  googleBtn: {
    width: '100%', padding: '15px 20px',
    background: 'var(--bg-card)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
    fontSize: '1rem', fontWeight: 600,
    boxShadow: 'var(--shadow-sm)', cursor: 'pointer',
  },
  error: { color: 'var(--danger)', fontSize: '0.88rem', textAlign: 'center', marginBottom: '10px' },
  spinner: {
    width: '18px', height: '18px',
    border: '2px solid var(--border)', borderTopColor: 'var(--text)',
    borderRadius: '50%', display: 'inline-block',
    animation: 'spin 0.7s linear infinite', flexShrink: 0,
  },

  /* ── Divider ── */
  divider: {
    width: '100%', height: '1px',
    background: 'var(--border)', margin: '4px 0',
  },

  /* ── Sections ── */
  section: { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionTitle: {
    fontSize: '1.1rem', fontWeight: 700,
    color: 'var(--text)', margin: 0, letterSpacing: '-0.02em',
  },
  sectionDesc: {
    fontSize: '0.9rem', color: 'var(--text-mute)',
    lineHeight: 1.6, margin: 0,
  },

  /* ── Features ── */
  features: { width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' },
  featureCard: {
    display: 'flex', gap: '14px', alignItems: 'flex-start',
    padding: '14px 16px',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)',
  },
  featureIcon: { fontSize: '1.5rem', lineHeight: 1, flexShrink: 0, marginTop: '2px' },
  featureTitulo: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 3px' },
  featureDesc: { fontSize: '0.85rem', color: 'var(--text-mute)', margin: 0, lineHeight: 1.5 },

  /* ── Install tabs ── */
  tabs: { display: 'flex', gap: '8px', width: '100%' },
  tab: {
    flex: 1, padding: '10px',
    background: 'var(--bg-card)', color: 'var(--text-mute)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
    fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--bg-elev)', color: 'var(--text)',
    borderColor: 'var(--border-strong)', fontWeight: 600,
  },
  pasos: { display: 'flex', flexDirection: 'column', gap: '8px' },
  paso: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '12px 14px',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
  },
  pasoBadge: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: 'var(--orange-grad)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.8rem', fontWeight: 700, color: '#fff', flexShrink: 0,
  },
  pasoTexto: { fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.4 },
}
