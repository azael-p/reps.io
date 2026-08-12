# Diseño: paginación y agregados (reporte 3.8)

> Estado: **propuesta** — no implementado. 2026-08-12.

## Problema

Hoy no hay ningún `limit()` en el proyecto. `getSesionesConResumen` descarga **todas** las sesiones completadas (con su `resumen` embebido, el objeto más pesado del modelo) en cada visita a Progreso y en cada inicio de SesionActiva; `getFechasSesiones` descarga todas las sesiones para pintar el calendario. Con 1–2 años de uso (150–300 sesiones) cada visita cuesta cientos de lecturas y varios cientos de KB.

**No alcanza con agregar `limit(20)»**: PR, "última vez" y los gráficos de progresión se calculan cruzando **todo** el historial por `catalogoId`. Limitar la query rompería esa semántica silenciosamente (un PR de hace 6 meses desaparecería). Por eso este cambio es de diseño, no un fix puntual.

## Propuesta: agregados denormalizados + paginación real

Extiende el patrón que ya usa la app (el campo `resumen` se escribe al completar la sesión). Tres piezas:

### 1. `usuarios/{uid}/statsEjercicios/{catalogoId}` — un doc por ejercicio

Actualizado al completar la sesión (junto con `backfillResumen`) y al editar series en ResumenSesion:

```
statsEjercicios/{catalogoId}
  nombre, grupoMuscular
  pr:        { peso, reps, fecha, sesionId }
  ultimaVez: { fecha, sesionId, series: [{ numeroSerie, pesoUsado, repsHechas }] }
  puntos:    [{ fecha, pesoMax, oneRm, volumen }]   ← 1 entrada por sesión, cap ~150
```

Quién lo consume:

| Lector | Hoy | Con stats |
|---|---|---|
| SesionActiva (referencia última vez/PR) | todas las sesiones | 1 query a `statsEjercicios` (docs del día) |
| Progreso → Gráfico (peso/1RM/volumen por serie) | todas las sesiones | 1 doc (`puntos`) |
| SeleccionarEjercicio / lista de ejercicios usados | derivado del historial | la colección `statsEjercicios` completa (≤ decenas de docs) |

### 2. `usuarios/{uid}/resumenGlobal` — un solo doc

```
resumenGlobal (doc único "stats")
  diasEntrenados: [epochDia, ...]      ← días únicos, para calendario + rachas + frecuencia
  volumenPorSesion: [{ fecha, volumen, diaNombre, sesionId }]  ← cap ~200
```

Reemplaza `getFechasSesiones` (calendario de Home), `getStreaksLocal` (rachas), `frecuenciaSemanal` y `getVolumenPorSesionLocal` con **1 lectura**. El cache de localStorage del calendario se mantiene como está.

### 3. Paginación real del historial

`getSesionesConResumen` queda solo para el tab Historial de Progreso, con paginación de verdad:

```js
query(sesiones, where('usuarioId','==',uid), where('completada','==',true),
      orderBy('fecha','desc'), limit(20) /* + startAfter(ultimoDoc) */)
```

Requiere índice compuesto → crear **`firestore.indexes.json`** (hoy no existe) y agregar `"firestore": { "indexes": "firestore.indexes.json" }` a `firebase.json` para que CI lo despliegue:

```json
{ "indexes": [{ "collectionGroup": "sesiones", "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "usuarioId", "order": "ASCENDING" },
    { "fieldPath": "completada", "order": "ASCENDING" },
    { "fieldPath": "fecha", "order": "DESCENDING" } ] }] }
```

Nota: los filtros por programa/mes del Historial se siguen aplicando en cliente sobre las páginas cargadas (agregar más índices para cada combinación no vale la pena a esta escala).

## Escrituras: cuándo y cómo se actualizan los agregados

- **Al completar sesión** (`ResumenSesion.cargar` → hoy llama `backfillResumen` + `completarSesion`): además, batch que actualiza `resumenGlobal` + un doc de `statsEjercicios` por ejercicio de la sesión (típicamente 4–8 docs). Costo: ~10 escrituras por workout — irrelevante frente al ahorro de lecturas.
- **Al editar una serie en ResumenSesion**: recalcular el doc de stats del ejercicio afectado usando el `resumen` de las sesiones que lo contienen (o, más simple, recalcular solo `pr`/`ultimaVez`/`puntos` de ese ejercicio desde `registros` de esa sesión + su doc stats previo).
- **Al eliminar una sesión** (Progreso): recalcular los agregados afectados. Es el caso más delicado — ver riesgos.

## Migración

Script one-off `scripts/backfillStats.js` con firebase-admin (mismo patrón dry-run/`--aplicar` de los scripts existentes): recorre `sesiones` con `resumen`, construye `statsEjercicios` y `resumenGlobal` por usuario. Se corre una vez antes de desplegar los lectores nuevos.

## Reglas de Firestore

Las nuevas subcolecciones viven bajo `usuarios/{uid}` → heredan el patrón de dueño. Agregar bloques con `hasOnly` para `statsEjercicios` y `resumenGlobal` (create/update solo del dueño; los campos listados arriba).

## Impacto estimado (usuario con 200 sesiones, 30 ejercicios distintos)

| Pantalla | Lecturas hoy | Con este diseño |
|---|---|---|
| Progreso (primera carga) | ~200 | ~21 (20 historial + 1 resumenGlobal) |
| Progreso → Gráfico | 0 extra (ya descargado) | 1 doc por ejercicio consultado |
| SesionActiva (inicio) | ~200 | ~6 (stats de los ejercicios del día) |
| Home (calendario, sin cache) | ~200 | 1 |

## Orden de implementación (cada fase deployable por separado)

1. `firestore.indexes.json` + deploy de índices (sin cambio de app).
2. `resumenGlobal`: escritura al completar sesión + lectores de calendario/rachas/frecuencia/volumen + backfill.
3. `statsEjercicios`: escritura + lectores de SesionActiva y Gráfico + backfill.
4. Paginación real del Historial con `startAfter` (y retirar la descarga completa).

## Riesgos

- **Consistencia**: los agregados pueden divergir si una escritura parcial falla (no hay Cloud Functions en plan Spark; todo es client-side). Mitigación: batch atómico para sesión+agregados, y el script de backfill sirve como herramienta de reparación.
- **Borrado/edición de sesiones viejas**: recalcular agregados desde el cliente exige leer las sesiones del ejercicio afectado. Aceptable porque es una operación rara; documentar que el costo de borrar es mayor que el de crear.
- **Docs con arrays acotados**: `puntos` y `volumenPorSesion` necesitan cap (~150–200 entradas) para no acercarse al límite de 1 MB por doc; al superarlo, se recorta lo más viejo (los gráficos muestran una ventana, el PR se conserva aparte).
