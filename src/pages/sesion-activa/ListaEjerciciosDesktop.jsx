export default function ListaEjerciciosDesktop({ ejercicios, ejIdx, historial }) {
  return (
    <div className="sa-desktop-ej-list">
      <p className="sa-desktop-list-title">Ejercicios</p>
      {ejercicios.map((ej, i) => {
        const completado = i < ejIdx || (i === ejIdx && historial.some(h => h.ejIdx === i && h.serieIdx === ej.seriesEsperadas - 1))
        const actual = i === ejIdx && !completado
        return (
          <div
            key={ej.id}
            className={`sa-desktop-ej-item ${actual ? 'sa-desktop-ej-item--actual' : ''} ${completado ? 'sa-desktop-ej-item--done' : ''}`}
          >
            <span className="sa-desktop-ej-num">{completado ? '✓' : i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="sa-desktop-ej-nombre">{ej.nombre}</span>
              <span className="sa-desktop-ej-grupo">{ej.grupoMuscular}</span>
            </div>
            <span className="sa-desktop-ej-series">{ej.seriesEsperadas}×{ej.repsEsperadas}</span>
          </div>
        )
      })}
    </div>
  )
}
