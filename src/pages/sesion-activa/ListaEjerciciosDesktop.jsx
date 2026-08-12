export default function ListaEjerciciosDesktop({ ejercicios, ejIdx, historial }) {
  return (
    <div style={s.desktopEjercicioList}>
      <p style={s.desktopListTitle}>Ejercicios</p>
      {ejercicios.map((ej, i) => {
        const completado = i < ejIdx || (i === ejIdx && historial.some(h => h.ejIdx === i && h.serieIdx === ej.seriesEsperadas - 1))
        const actual = i === ejIdx && !completado
        return (
          <div
            key={ej.id}
            style={{
              ...s.desktopEjItem,
              ...(actual ? s.desktopEjItemActual : {}),
              ...(completado ? s.desktopEjItemDone : {}),
            }}
          >
            <span style={s.desktopEjNum}>{completado ? '✓' : i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={s.desktopEjNombre}>{ej.nombre}</span>
              <span style={s.desktopEjGrupo}>{ej.grupoMuscular}</span>
            </div>
            <span style={s.desktopEjSeries}>{ej.seriesEsperadas}×{ej.repsEsperadas}</span>
          </div>
        )
      })}
    </div>
  )
}

const s = {
  desktopEjercicioList: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  desktopListTitle: {
    margin: '0 0 10px',
    fontSize: '0.7rem', fontWeight: 700,
    color: 'var(--text-mute)',
    textTransform: 'uppercase', letterSpacing: '0.07em',
  },
  desktopEjItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '10px 12px',
    borderRadius: 'var(--r-md)',
    background: 'transparent',
    opacity: 0.5,
  },
  desktopEjItemActual: {
    background: 'rgba(240,153,123,0.1)',
    border: '1px solid rgba(240,153,123,0.3)',
    opacity: 1,
  },
  desktopEjItemDone: {
    opacity: 0.35,
  },
  desktopEjNum: {
    width: '22px', height: '22px',
    borderRadius: '50%',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 700,
    flexShrink: 0, color: 'var(--text-mute)',
  },
  desktopEjNombre: {
    display: 'block',
    fontSize: '0.88rem', fontWeight: 600,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  desktopEjGrupo: {
    display: 'block',
    fontSize: '0.7rem', color: 'var(--text-dim)',
  },
  desktopEjSeries: {
    fontSize: '0.75rem', color: 'var(--text-dim)', flexShrink: 0,
  },
}
