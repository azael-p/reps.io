import * as Sentry from '@sentry/react'

const habilitado = import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  if (!habilitado) return
  Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })
}

export function capturarError(error, contexto) {
  if (!habilitado) return
  Sentry.captureException(error, contexto)
}
