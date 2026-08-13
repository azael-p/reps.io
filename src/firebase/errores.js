import { logEvento } from './analytics'

// GA4 trunca/limita el tamaño de los parámetros de evento — se recorta
// defensivamente para no perder el evento completo por un stack largo.
export function truncar(str, max = 150) {
  if (str == null) return ''
  const s = String(str)
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export function registrarListenersErrores() {
  window.addEventListener('error', (e) => {
    logEvento('error_js', {
      message: truncar(e.message),
      stack: truncar(e.error?.stack),
      pathname: window.location.pathname,
    })
  })

  window.addEventListener('unhandledrejection', (e) => {
    const razon = e.reason
    logEvento('error_promesa', {
      message: truncar(razon?.message ?? String(razon)),
      stack: truncar(razon?.stack),
      pathname: window.location.pathname,
    })
  })
}
