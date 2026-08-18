import { describe, it, expect } from 'vitest'
import {
  DIA_MS,
  calcularStreaks,
  agregarSerieDiaria,
  indexarDiaAPrograma,
  resolverNombresSesion,
  construirArbolProgramas,
  construirSesionesUsuario,
  construirDetalleUsuario,
} from './transformar.js'

const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
const diasAtras = n => hoy() - n * DIA_MS

describe('calcularStreaks', () => {
  it('devuelve ceros sin días entrenados', () => {
    expect(calcularStreaks([])).toEqual({ actual: 0, maxima: 0 })
    expect(calcularStreaks(undefined)).toEqual({ actual: 0, maxima: 0 })
  })

  it('cuenta la racha en curso hasta hoy', () => {
    expect(calcularStreaks([diasAtras(2), diasAtras(1), hoy()])).toEqual({ actual: 3, maxima: 3 })
  })

  it('mantiene la racha si el último día fue ayer', () => {
    expect(calcularStreaks([diasAtras(2), diasAtras(1)]).actual).toBe(2)
  })

  it('corta la racha actual si el último día fue hace más de un día', () => {
    const r = calcularStreaks([diasAtras(6), diasAtras(5), diasAtras(4)])
    expect(r).toEqual({ actual: 0, maxima: 3 })
  })

  it('toma la racha máxima histórica, no la última', () => {
    const r = calcularStreaks([diasAtras(10), diasAtras(9), diasAtras(8), diasAtras(1), hoy()])
    expect(r).toEqual({ actual: 2, maxima: 3 })
  })

  it('dedupica días repetidos', () => {
    expect(calcularStreaks([hoy(), hoy(), diasAtras(1)])).toEqual({ actual: 2, maxima: 2 })
  })
})

describe('agregarSerieDiaria', () => {
  it('emite un punto por día de la ventana, incluidos los vacíos', () => {
    const serie = agregarSerieDiaria([{ uid: 'a', diasEntrenadosEpochs: [hoy()] }], 5)
    expect(serie).toHaveLength(5)
    expect(serie.at(-1)).toMatchObject({ diasEntrenados: 1, usuariosActivos: 1 })
    expect(serie[0]).toMatchObject({ diasEntrenados: 0, usuariosActivos: 0 })
  })

  it('suma usuarios distintos en el mismo día', () => {
    const serie = agregarSerieDiaria([
      { uid: 'a', diasEntrenadosEpochs: [hoy()] },
      { uid: 'b', diasEntrenadosEpochs: [hoy()] },
    ], 3)
    expect(serie.at(-1)).toMatchObject({ diasEntrenados: 2, usuariosActivos: 2 })
  })

  it('ignora días anteriores a la ventana', () => {
    const serie = agregarSerieDiaria([{ uid: 'a', diasEntrenadosEpochs: [diasAtras(40)] }], 7)
    expect(serie.every(d => d.diasEntrenados === 0)).toBe(true)
  })
})

const crudo = () => ({
  sesiones: [],
  programas: [
    { id: 'p1', usuarioId: 'u1', nombre: 'Full body', orden: 2 },
    { id: 'p2', usuarioId: 'u1', nombre: 'Push Pull Legs', orden: 1 },
    { id: 'p3', usuarioId: 'u1', nombre: 'Viejo', orden: 3, eliminadoEn: 1234 },
    { id: 'p9', usuarioId: 'otro', nombre: 'De otro usuario', orden: 1 },
  ],
  dias: [
    { id: 'd1', usuarioId: 'u1', programaId: 'p2', nombre: 'Pull', orden: 2 },
    { id: 'd2', usuarioId: 'u1', programaId: 'p2', nombre: 'Push', orden: 1 },
    { id: 'd3', usuarioId: 'u1', programaId: 'p2', nombre: 'Borrado', orden: 3, eliminadoEn: 1234 },
  ],
  ejerciciosDia: [
    { id: 'e1', usuarioId: 'u1', diaId: 'd2', nombre: 'Press banca', grupoMuscular: 'Pecho', orden: 1, seriesEsperadas: 4, repsEsperadas: 8, esCustom: false },
    { id: 'e2', usuarioId: 'u1', diaId: 'd2', nombre: 'Fondos', grupoMuscular: 'Pecho', orden: 2, seriesEsperadas: 3, repsEsperadas: 10, esCustom: true },
    { id: 'e3', usuarioId: 'u1', diaId: 'd2', nombre: 'Borrado', orden: 3, eliminadoEn: 1234 },
  ],
})

describe('construirArbolProgramas', () => {
  it('arma la jerarquía por FK y respeta el campo orden en los 3 niveles', () => {
    const arbol = construirArbolProgramas('u1', crudo())
    expect(arbol.map(p => p.nombre)).toEqual(['Push Pull Legs', 'Full body'])
    expect(arbol[0].dias.map(d => d.nombre)).toEqual(['Push', 'Pull'])
    expect(arbol[0].dias[0].ejercicios.map(e => e.nombre)).toEqual(['Press banca', 'Fondos'])
  })

  it('excluye los soft-deleted en los 3 niveles', () => {
    const arbol = construirArbolProgramas('u1', crudo())
    expect(arbol.map(p => p.nombre)).not.toContain('Viejo')
    expect(arbol[0].dias.map(d => d.nombre)).not.toContain('Borrado')
    expect(arbol[0].dias[0].ejercicios.map(e => e.nombre)).not.toContain('Borrado')
  })

  it('no mezcla datos de otros usuarios', () => {
    expect(construirArbolProgramas('otro', crudo()).map(p => p.nombre)).toEqual(['De otro usuario'])
  })

  it('deja el programa con dias vacío si no tiene días', () => {
    expect(construirArbolProgramas('u1', crudo()).find(p => p.id === 'p1').dias).toEqual([])
  })

  it('normaliza los campos del ejercicio', () => {
    const ej = construirArbolProgramas('u1', crudo())[0].dias[0].ejercicios[1]
    expect(ej).toEqual({
      nombre: 'Fondos', grupoMuscular: 'Pecho', esCustom: true,
      seriesEsperadas: 3, repsEsperadas: 10,
    })
  })
})

describe('resolverNombresSesion', () => {
  const indice = () => indexarDiaAPrograma(crudo().programas, crudo().dias)

  it('resuelve los nombres siguiendo la FK del día', () => {
    expect(resolverNombresSesion({ diaId: 'd1' }, indice()))
      .toEqual({ diaNombre: 'Pull', programaNombre: 'Push Pull Legs' })
  })

  it('resuelve días soft-deleted: la sesión ya ocurrió', () => {
    expect(resolverNombresSesion({ diaId: 'd3' }, indice()).diaNombre).toBe('Borrado')
  })

  it('cae al nombre denormalizado del resumen si el día ya no existe', () => {
    const s = { diaId: 'fantasma', resumen: { diaNombre: 'Día 1', programaNombre: 'Rutina vieja' } }
    expect(resolverNombresSesion(s, indice()))
      .toEqual({ diaNombre: 'Día 1', programaNombre: 'Rutina vieja' })
  })

  it('cae al resumen solo para el programa si el día existe pero el programa fue borrado', () => {
    const dias = [{ id: 'd8', programaId: 'inexistente', nombre: 'Torso' }]
    const s = { diaId: 'd8', resumen: { diaNombre: 'viejo', programaNombre: 'Rutina vieja' } }
    expect(resolverNombresSesion(s, indexarDiaAPrograma([], dias)))
      .toEqual({ diaNombre: 'Torso', programaNombre: 'Rutina vieja' })
  })

  it('devuelve el guion cuando no hay ni FK ni resumen', () => {
    expect(resolverNombresSesion({ diaId: 'fantasma' }, indice()))
      .toEqual({ diaNombre: '–', programaNombre: '–' })
  })
})

describe('construirSesionesUsuario', () => {
  const sesiones = [
    {
      id: 's1', usuarioId: 'u1', diaId: 'd2', fechaMs: diasAtras(3), nota: '',
      resumen: {
        volumenTotal: 1200, diaNombre: 'Push', programaNombre: 'PPL',
        ejercicios: [{
          nombre: 'Press banca', grupoMuscular: 'Pecho',
          series: [
            { numeroSerie: 2, pesoUsado: 62.5, repsHechas: 7 },
            { numeroSerie: 1, pesoUsado: 60, repsHechas: 8 },
          ],
        }],
      },
    },
    { id: 's2', usuarioId: 'u1', diaId: 'd1', fechaMs: diasAtras(1), nota: 'pesada' },
    { id: 's3', usuarioId: 'otro', diaId: 'd1', fechaMs: diasAtras(2), resumen: { ejercicios: [] } },
  ]

  it('ordena desc por fecha y filtra por usuario', () => {
    const out = construirSesionesUsuario('u1', sesiones, indexarDiaAPrograma(crudo().programas, crudo().dias))
    expect(out.map(s => s.id)).toEqual(['s2', 's1'])
  })

  it('aplana ejercicios y ordena las series por numeroSerie', () => {
    const s = construirSesionesUsuario('u1', sesiones, new Map())[1]
    expect(s.ejercicios[0].series.map(x => x.numeroSerie)).toEqual([1, 2])
    expect(s.totalSeries).toBe(2)
    expect(s.volumenTotal).toBe(1200)
    expect(s.sinResumen).toBe(false)
    expect(s.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('marca las sesiones sin resumen sin inventar datos', () => {
    const s = construirSesionesUsuario('u1', sesiones, new Map())[0]
    expect(s).toMatchObject({ id: 's2', sinResumen: true, volumenTotal: 0, totalSeries: 0, ejercicios: [], nota: 'pesada' })
  })

  it('normaliza la nota vacía a null', () => {
    expect(construirSesionesUsuario('u1', sesiones, new Map())[1].nota).toBeNull()
  })
})

describe('construirDetalleUsuario', () => {
  it('junta sesiones, rutinas y el conteo de soft-deleted del usuario', () => {
    const datos = { ...crudo(), sesiones: [{ id: 's1', usuarioId: 'u1', diaId: 'd2', fechaMs: diasAtras(1) }] }
    const detalle = construirDetalleUsuario('u1', datos, indexarDiaAPrograma(datos.programas, datos.dias))
    expect(detalle.sesiones).toHaveLength(1)
    expect(detalle.programas).toHaveLength(2)
    expect(detalle.eliminados).toBe(3)
  })

  it('devuelve estructuras vacías para un usuario sin datos', () => {
    const datos = crudo()
    expect(construirDetalleUsuario('nadie', datos, new Map()))
      .toEqual({ sesiones: [], programas: [], eliminados: 0 })
  })
})
