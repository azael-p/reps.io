// Fallback de Suspense para las rutas lazy: evita la pantalla en blanco
// mientras se descarga el chunk de la página.
export default function PageLoader() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <span className="spinner" style={{ width: 28, height: 28, color: 'var(--text-mute)' }} />
    </div>
  )
}
