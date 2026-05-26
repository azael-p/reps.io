import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  handleGoHome = () => {
    this.setState({ error: null })
    window.location.href = '/home'
  }

  render() {
    if (this.state.error) {
      return (
        <div style={s.page}>
          <div style={s.card}>
            <span style={s.icon}>⚠️</span>
            <h2 style={s.titulo}>Algo salió mal</h2>
            <p style={s.sub}>Ocurrió un error inesperado.</p>
            <div style={s.btns}>
              <button style={s.btnSecondary} onClick={this.handleRetry}>
                Reintentar
              </button>
              <button style={s.btn} onClick={this.handleGoHome}>
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const s = {
  page: {
    minHeight: '100dvh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg)',
    padding: '24px',
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '12px', textAlign: 'center',
  },
  icon: { fontSize: '2.5rem' },
  titulo: { margin: 0, fontSize: '1.2rem', fontWeight: 700 },
  sub: { margin: 0, fontSize: '0.9rem', color: 'var(--text-mute)' },
  btns: { display: 'flex', gap: '10px', marginTop: '8px' },
  btn: {
    padding: '14px 28px',
    background: 'var(--orange-grad)', color: '#fff',
    border: 'none', borderRadius: 'var(--r-md)',
    fontSize: '0.95rem', fontWeight: 700,
    boxShadow: '0 8px 24px rgba(199, 90, 48, 0.35)',
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: '14px 28px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-mute)',
    borderRadius: 'var(--r-md)',
    fontSize: '0.95rem', fontWeight: 600,
    cursor: 'pointer',
  },
}
