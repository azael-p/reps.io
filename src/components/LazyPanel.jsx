import { useEffect, useRef, useState } from 'react'

// Difiere el render de contenido pesado (gráficos Recharts + sus animaciones)
// hasta que el panel entra en viewport. Antes de eso muestra un placeholder
// de altura fija para no saltar el scroll. Una vez visible, queda montado
// (no se desmonta al salir del viewport — evita re-animar en cada scroll).
export default function LazyPanel({ children, minHeight = 220 }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (visible || !ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { rootMargin: '200px' }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [visible])

  return (
    <div ref={ref}>
      {visible ? children : <div data-testid="lazy-placeholder" style={{ minHeight }} />}
    </div>
  )
}
