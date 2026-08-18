import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { ToastProvider } from './components/Toast'
import { registrarListenersErrores } from './firebase/errores'
import { initSentry } from './sentry'
import './index.css'
import App from './App.jsx'

initSentry()
registrarListenersErrores()

// Aplica la hoja de fuentes ya precargada por el <link rel="preload"> del
// index.html. Vivía en un atributo de evento inline, que la CSP bloquea:
// script-src no los cubre salvo con 'unsafe-hashes'. El preload ya disparó la
// descarga durante el parseo del HTML, así que mover solo el swap acá no
// retrasa la request.
document.getElementById('font-css')?.setAttribute('rel', 'stylesheet')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {/* La media query de index.css solo frena las animaciones CSS; los
          initial/animate de cada motion.div las ignoran. MotionConfig es lo
          que hace que Framer respete prefers-reduced-motion del sistema. */}
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)
