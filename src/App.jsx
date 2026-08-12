import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { UserProvider, useUser } from './context/UserContext'
import { logPaginaVista } from './firebase/analytics'
import BottomNav from './components/BottomNav'
import DesktopSidebar from './components/DesktopSidebar'
import ErrorBoundary from './components/ErrorBoundary'
import UpdateBanner from './components/UpdateBanner'
import Login from './pages/Login'
import Home from './pages/Home'

const Programas     = lazy(() => import('./pages/Programas'))
const Dias          = lazy(() => import('./pages/Dias'))
const EjerciciosDia = lazy(() => import('./pages/EjerciciosDia'))
const Entrenar      = lazy(() => import('./pages/Entrenar'))
const SesionActiva  = lazy(() => import('./pages/SesionActiva'))
const ResumenSesion = lazy(() => import('./pages/ResumenSesion'))
const Progreso      = lazy(() => import('./pages/Progreso'))
const Timer         = lazy(() => import('./pages/Timer'))

function PrivateRoute({ children }) {
  const { usuario, loading } = useUser()
  if (loading) return null
  return usuario ? <ErrorBoundary>{children}</ErrorBoundary> : <Navigate to="/" replace />
}

function AppRoutes() {
  const location = useLocation()
  const [prevPath, setPrevPath] = useState(location.pathname)
  const [direction, setDirection] = useState(1)

  useEffect(() => {
    logPaginaVista(location.pathname)
  }, [location.pathname])

  // Ajuste de estado durante el render (patrón "derivar de renders previos"):
  // la dirección de la transición depende de la ruta anterior.
  if (prevPath !== location.pathname) {
    setDirection(location.pathname.length >= prevPath.length ? 1 : -1)
    setPrevPath(location.pathname)
  }

  return (
    <>
      <UpdateBanner />
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={location.pathname}
          custom={direction}
          initial={d => ({ x: d > 0 ? 40 : -40, opacity: 0 })}
          animate={{ x: 0, opacity: 1 }}
          exit={d => ({ x: d > 0 ? -40 : 40, opacity: 0 })}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<ErrorBoundary><Login /></ErrorBoundary>} />
            <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/programas" element={<PrivateRoute><Suspense fallback={null}><Programas /></Suspense></PrivateRoute>} />
            <Route path="/programas/:programaId" element={<PrivateRoute><Suspense fallback={null}><Dias /></Suspense></PrivateRoute>} />
            <Route path="/programas/:programaId/:diaId" element={<PrivateRoute><Suspense fallback={null}><EjerciciosDia /></Suspense></PrivateRoute>} />
            <Route path="/entrenar" element={<PrivateRoute><Suspense fallback={null}><Entrenar /></Suspense></PrivateRoute>} />
            <Route path="/sesion/:sesionId" element={<PrivateRoute><Suspense fallback={null}><SesionActiva /></Suspense></PrivateRoute>} />
            <Route path="/sesion/:sesionId/resumen" element={<PrivateRoute><Suspense fallback={null}><ResumenSesion /></Suspense></PrivateRoute>} />
            <Route path="/progreso" element={<PrivateRoute><Suspense fallback={null}><Progreso /></Suspense></PrivateRoute>} />
            <Route path="/timer" element={<PrivateRoute><Suspense fallback={null}><Timer /></Suspense></PrivateRoute>} />
          </Routes>
        </motion.div>
      </AnimatePresence>
      <BottomNav />
    </>
  )
}

function AppShell() {
  const { pathname } = useLocation()
  const isLogin = pathname === '/'
  return (
    <>
      {!isLogin && <DesktopSidebar />}
      <main className={isLogin ? '' : 'app-main'}>
        <AppRoutes />
      </main>
    </>
  )
}

export default function App() {
  return (
    <UserProvider>
      <AppShell />
    </UserProvider>
  )
}
