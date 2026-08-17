import { Component } from 'react'
import { logEvento } from '../firebase/analytics'
import { truncar } from '../firebase/errores'
import { capturarError } from '../sentry'

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
    logEvento('error_react', {
      message: truncar(error.message),
      stack: truncar(error.stack),
      pathname: window.location.pathname,
    })
    capturarError(error, { contexts: { react: { componentStack: info.componentStack } } })
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
        <div className="error-boundary-page">
          <div className="error-boundary-card">
            <span className="error-boundary-icon">⚠️</span>
            <h2 className="error-boundary-titulo">Algo salió mal</h2>
            <p className="error-boundary-sub">Ocurrió un error inesperado.</p>
            <div className="error-boundary-btns">
              <button className="error-boundary-btn-secondary" onClick={this.handleRetry}>
                Reintentar
              </button>
              <button className="error-boundary-btn" onClick={this.handleGoHome}>
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
