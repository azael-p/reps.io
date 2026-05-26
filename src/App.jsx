import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { AnimatePresence } from 'motion/react'
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

function PrivateRoute({ children }) {
  const { usuario, loading } = useUser()
  if (loading) return null
  return usuario ? <ErrorBoundary>{children}</ErrorBoundary> : <Navigate to="/" replace />
}

function AppRoutes() {
  const location = useLocation()

  useEffect(() => {
    logPaginaVista(location.pathname)
  }, [location.pathname])

  return (
    <>
      <UpdateBanner />
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<ErrorBoundary><Login /></ErrorBoundary>} />
          <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/programas" element={<PrivateRoute><Suspense fallback={null}><Programas /></Suspense></PrivateRoute>} />
          <Route path="/programas/:programaId" element={<PrivateRoute><Suspense fallback={null}><Dias /></Suspense></PrivateRoute>} />
          <Route path="/programas/:programaId/:diaId" element={<PrivateRoute><Suspense fallback={null}><EjerciciosDia /></Suspense></PrivateRoute>} />
          <Route path="/entrenar" element={<PrivateRoute><Suspense fallback={null}><Entrenar /></Suspense></PrivateRoute>} />
          <Route path="/sesion/:sesionId" element={<PrivateRoute><Suspense fallback={null}><SesionActiva /></Suspense></PrivateRoute>} />
          <Route path="/sesion/:sesionId/resumen" element={<PrivateRoute><Suspense fallback={null}><ResumenSesion /></Suspense></PrivateRoute>} />
          <Route path="/progreso" element={<PrivateRoute><Suspense fallback={null}><Progreso /></Suspense></PrivateRoute>} />
        </Routes>
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
      <div className={isLogin ? '' : 'app-main'}>
        <AppRoutes />
      </div>
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
