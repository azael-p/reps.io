# reps.io

PWA para seguimiento de entrenamientos de gimnasio. Permite crear programas de entrenamiento, registrar sesiones, editar series en tiempo real y ver el progreso con gráficos.

## Flujo de pantallas

![Flujo de pantallas](gym_app_flow.svg)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite |
| Animaciones | Framer Motion (motion/react) |
| Gráficos | Recharts 3.x |
| Routing | React Router 7 |
| Drag & Drop | dnd-kit |
| Backend / DB | Firebase Firestore |
| Auth | Firebase Auth |
| PWA | vite-plugin-pwa + Workbox |

## Características

- **Programas**: crear y organizar días de entrenamiento con ejercicios configurables (series, reps, notas)
- **Catálogo de ejercicios**: picker con búsqueda fuzzy sobre el catálogo global, normalización de nombres y soporte para ejercicios personalizados
- **Sesión activa**: registrar series en tiempo real con referencia al último peso/reps usado
- **Historial cruzado**: última vez, PR y progreso de un ejercicio se calculan por `catalogoId`, cruzando días distintos que comparten el mismo ejercicio
- **Timer**: cronómetro configurable con presets guardados por usuario (máx. 5) y wake lock para mantener la pantalla activa
- **Resumen de sesión**: editar series completadas; los cambios se propagan al historial
- **Progreso**: gráficos de progresión por ejercicio, volumen por sesión y peso corporal
- **Calendario**: visualización de días entrenados por mes con contador de sesiones
- **Onboarding**: flujo de primera vez para nuevos usuarios
- **Pull-to-refresh**: recarga de datos en mobile
- **Responsive**: layout de dos columnas en desktop

## Instalación

```bash
npm install
```

Crear `.env` con las credenciales de Firebase:

```
VITE_API_KEY=...
VITE_AUTH_DOMAIN=...
VITE_PROJECT_ID=...
VITE_STORAGE_BUCKET=...
VITE_MESSAGING_SENDER_ID=...
VITE_APP_ID=...
```

```bash
npm run dev      # desarrollo
npm run build    # producción
npm run preview  # preview del build
```

## Estructura de Firestore

```
usuarios/{uid}
  nombre, email, creadoEn

programas/{id}
  usuarioId, nombre, descripcion, activo

dias/{id}
  programaId, usuarioId, nombre, orden

ejerciciosDia/{id}
  diaId, usuarioId, nombre, grupoMuscular, esCustom, catalogoId
  seriesEsperadas, repsEsperadas, orden

ejerciciosCatalogo/{id}      ← catálogo global (búsqueda fuzzy en el picker)
  nombre, grupoMuscular

sesiones/{id}
  usuarioId, diaId, programaId
  creadaEn, completada
  resumen: {                 ← denormalizado al completar
    volumenTotal: number,
    ejercicios: [{ ejercicioId, catalogoId, nombre, grupoMuscular, series: [...] }]
  }

registros/{id}
  sesionId, ejercicioId, catalogoId, numeroSerie
  usuarioId, pesoUsado, repsHechas, nota

peso/{id}
  usuarioId, fecha, valor

usuarios/{uid}/timerPresets/{id}
  nombre, duracion, creadoEn
```

## Optimización de lecturas (Firestore Spark)

El plan gratuito tiene 50k lecturas/día. La arquitectura usa **denormalización**: al completar una sesión se escribe un campo `resumen` con todos los datos de esa sesión. Esto permite:

- Cargar el historial completo con **una sola query** (`getSesionesConResumen`)
- Derivar todos los gráficos de Progreso **en el cliente**, sin queries adicionales
- Lookup de "última vez" para cada ejercicio **en el cliente** (`getUltimaVezEjercicioLocal`)

**Costo por usuario activo:**

| Escenario | Lecturas/día |
|---|---|
| Sin denormalización | ~3.000 |
| Con denormalización | ~70 |
| Capacidad Spark (50k) | ~700 workouts → ~350 usuarios activos |

Las sesiones antiguas (sin `resumen`) se ignoran en los gráficos. El fallback a queries individuales solo ocurre si se necesita explícitamente.

## Testing

**149 tests** — unitarios y de componentes, en 16 archivos.

```bash
npm run test        # modo watch (re-corre al guardar)
npm run test:run    # una sola pasada (para antes de hacer push)
```

### Cobertura

| Área | Tests |
|---|---|
| `sesiones.js` (CRUD, `getSesionesConResumen`, `esMismoEjercicio`) | 25 |
| `SeleccionarEjercicio` (componente) | 15 |
| `useTimer` (hook) | 15 |
| `TimerActivo` (componente) | 11 |
| `programas.js` (CRUD) | 11 |
| `registros.js` (CRUD, `getUltimaVezEjercicioLocal`) | 10 |
| `Calendario` (componente) | 9 |
| `ejerciciosDia.js` (CRUD) | 8 |
| `BottomNav` (componente) | 8 |
| `dias.js` (CRUD) | 7 |
| `TimerConfig` (componente) | 7 |
| `Toast` / `ToastProvider` | 6 |
| `SesionActiva` (página) | 6 |
| `timerPresets.js` (CRUD, límite de 5) | 5 |
| `TimerFin` (componente) | 4 |
| `ResumenSesion` (página) | 2 |

### GitHub Actions

Los tests corren automáticamente en cada push y pull request a `main`. Ver resultados en la pestaña **Actions** del repositorio.

---

## Archivos clave

```
src/
  firebase/
    sesiones.js      — CRUD sesiones, getSesionesConResumen, esMismoEjercicio, backfillResumen
    registros.js     — CRUD registros, getUltimaVezEjercicioLocal (cruce por catalogoId)
    programas.js     — CRUD programas y días
    ejerciciosDia.js — CRUD de ejercicios dentro de un día (catalogoId, esCustom)
    catalogo.js      — catálogo global de ejercicios (ejerciciosCatalogo)
    timerPresets.js  — CRUD de presets de timer por usuario (máx. 5)
    peso.js          — registro de peso corporal
  pages/
    Home.jsx         — dashboard con calendario y accesos rápidos
    SesionActiva.jsx — registro de series en tiempo real
    ResumenSesion.jsx — resumen y edición post-sesión
    Progreso.jsx     — gráficos de progresión, volumen y peso
    Programas.jsx    — gestión de programas y días
    Timer.jsx        — pantalla de timer
  components/
    Calendario.jsx   — calendario mensual con días entrenados
    SeleccionarEjercicio.jsx — picker de ejercicios con búsqueda fuzzy
    Onboarding.jsx   — flujo de primera vez
    PullToRefresh.jsx — pull-to-refresh para mobile
    timer/
      useTimer.js      — hook de cronómetro (cuenta regresiva, wake lock)
      TimerConfig.jsx  — configuración de duración y presets
      TimerActivo.jsx  — cronómetro corriendo
      TimerFin.jsx     — pantalla de fin de timer
  hooks/
    useDesktop.js    — detección de viewport desktop
```
