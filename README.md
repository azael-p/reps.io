# reps.io

PWA para seguimiento de entrenamientos de gimnasio. Permite crear programas de entrenamiento, registrar sesiones, editar series en tiempo real y ver el progreso con gráficos.

Se usa en el gimnasio, con el celular en la mano entre series: mobile-first, botones grandes, pocos taps.

## Flujo de pantallas

![Flujo de pantallas](gym_app_flow.svg)

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 |
| Animaciones | Framer Motion (`motion/react`) |
| Gráficos | Recharts 3.x |
| Routing | React Router 7 |
| Drag & Drop | dnd-kit |
| Búsqueda fuzzy | Fuse.js |
| Iconos | lucide-react |
| Backend / DB | Firebase Firestore |
| Auth | Firebase Auth (Google Sign-In) |
| Analytics | Firebase Analytics (GA4) |
| PWA | vite-plugin-pwa + Workbox |
| Tests | Vitest + Testing Library + jsdom |
| Lint | ESLint 10 (flat config) |

JavaScript sin TypeScript. Sin Prettier: no reformatear con otra herramienta.

## Características

- **Programas**: crear y organizar días de entrenamiento con ejercicios configurables (series, reps, notas), reordenables por drag & drop
- **Catálogo de ejercicios**: picker con búsqueda fuzzy sobre el catálogo global, normalización de nombres y soporte para ejercicios personalizados
- **Sesión activa**: registrar series en tiempo real con referencia al último peso/reps usado, con long-press en los steppers de peso y reps
- **Historial cruzado**: última vez, PR y progreso de un ejercicio se calculan por `catalogoId`, cruzando días distintos que comparten el mismo ejercicio
- **Timer**: cronómetro configurable con presets guardados por usuario (máx. 5) y wake lock para mantener la pantalla activa
- **Resumen de sesión**: editar series completadas; los cambios se propagan al historial y a los agregados
- **Progreso**: gráficos de progresión por ejercicio, volumen por sesión, peso corporal, rachas y frecuencia semanal
- **Calendario**: visualización de días entrenados por mes con contador de sesiones
- **Eliminar con undo**: programas, días y ejercicios usan soft-delete con toast de "Deshacer" (5 s)
- **Swipe to delete**: gesto de deslizar para eliminar en mobile
- **Onboarding**: flujo de primera vez para nuevos usuarios
- **Pull-to-refresh**: recarga de datos en mobile
- **Actualizaciones de la PWA**: `UpdateBanner` detecta una nueva versión del service worker y aplica la actualización
- **Atajos de teclado** (`useKeyboardShortcut`) y **layout de dos columnas con sidebar** en desktop

## Instalación

```bash
npm install
```

Crear `.env.local` (no está versionado; no hay `.env.example` en el repo) con las credenciales de Firebase. **Los nombres llevan el prefijo `VITE_FIREBASE_`** — son los mismos que consume [src/firebase/config.js](src/firebase/config.js) y los secrets del workflow de deploy:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Opcionalmente, `VITE_SENTRY_DSN` con el DSN del proyecto en [sentry.io](https://sentry.io) para reportar errores de JS. Solo se activa en el build de producción (`import.meta.env.PROD`) — en desarrollo local no se envía nada a Sentry, así que dejarla vacía o sin definir no rompe nada.

```
VITE_SENTRY_DSN=...
```

```bash
npm run dev      # desarrollo
npm run build    # producción
npm run preview  # preview del build
npm run lint     # ESLint
npm run test     # tests en watch
npm run test:run # tests, una sola pasada
npm run reporte  # reporte de actividad (requiere scripts/serviceAccount.json)
```

## Arquitectura de la app

### Routing

[src/App.jsx](src/App.jsx) monta todas las rutas. `Login` (`/`) y `Home` (`/home`) se cargan de forma directa; **el resto de las páginas son `lazy` + `Suspense`** con `PageLoader` como fallback, envueltas en `PrivateRoute` (redirige a `/` si no hay sesión) y `ErrorBoundary`. Las transiciones entre pantallas son direccionales: la dirección se deriva de la profundidad de la ruta anterior.

| Ruta | Página |
|---|---|
| `/` | `Login` (única ruta pública) |
| `/home` | `Home` |
| `/programas` | `Programas` |
| `/programas/:programaId` | `Dias` |
| `/programas/:programaId/:diaId` | `EjerciciosDia` |
| `/entrenar` | `Entrenar` |
| `/sesion/:sesionId` | `SesionActiva` |
| `/sesion/:sesionId/resumen` | `ResumenSesion` |
| `/progreso` | `Progreso` |
| `/timer` | `Timer` |

### CSS

Una sola hoja de estilos global: [src/index.css](src/index.css), con clases prefijadas por página o componente (`sa-*` para SesionActiva, `progreso-*`, etc.). No hay CSS-in-JS ni CSS modules — el proyecto ya migró todo a este patrón. [src/App.css](src/App.css) se mantiene casi vacío a propósito.

### Componentes grandes

Cuando una página crece demasiado (referencia: `SesionActiva.jsx` y `Progreso.jsx` al superar ~900 líneas) se divide en subcomponentes dentro de una subcarpeta homónima en minúsculas. El archivo padre queda como orquestador: ver [src/pages/sesion-activa/](src/pages/sesion-activa/) y [src/pages/progreso/](src/pages/progreso/).

### Build y PWA

- `manualChunks` en [vite.config.js](vite.config.js) separa cuatro vendor chunks: `react-vendor`, `firebase-vendor`, `motion-vendor`, `recharts-vendor`.
- Service worker con `registerType: 'autoUpdate'`; `runtimeCaching` de Workbox para Google Fonts y Firestore.
- Persistencia offline multi-tab de Firestore (`persistentLocalCache` + `persistentMultipleTabManager`) en [src/firebase/config.js](src/firebase/config.js). **No usar `localStorage` para estado persistente** — todo va a Firestore.
- [firebase.json](firebase.json): rewrites de SPA y headers de cache (`sw.js` e `index.html` sin cache, `assets/**` immutable).

## Estructura de Firestore

```
usuarios/{uid}
  nombre, email, photoURL

programas/{id}
  usuarioId, nombre, orden
  eliminadoEn               ← transitorio: soft-delete con undo (toast)

dias/{id}
  programaId, usuarioId, nombre, orden
  eliminadoEn               ← transitorio (ídem programas)

ejerciciosDia/{id}
  diaId, usuarioId, nombre, grupoMuscular, esCustom, catalogoId
  seriesEsperadas, repsEsperadas, orden
  eliminadoEn               ← transitorio (ídem programas)

ejerciciosCatalogo/{id}      ← catálogo global, solo lectura desde el cliente
  nombre, grupoMuscular

sesiones/{id}
  usuarioId, diaId, fecha, nota, completada
  resumen: {                 ← denormalizado al completar
    diaNombre, volumenTotal,
    ejercicios: [{ ejercicioId, catalogoId, nombre, grupoMuscular, series: [...] }]
  }

registros/{id}
  usuarioId, sesionId, ejercicioId, nombreEjercicio, grupoMuscular, catalogoId
  numeroSerie, repsEsperadas, repsHechas, pesoUsado, nota

usuarios/{uid}/historialPeso/{id}
  peso, fecha               ← peso corporal (validado 20–300 en las reglas)

usuarios/{uid}/timerPresets/{id}
  nombre, calentamiento, trabajo, descanso, sets, enfriamiento, creadoEn

usuarios/{uid}/stats/global
  diasEntrenados[], volumenPorSesion[]        ← agregado, ver abajo

usuarios/{uid}/statsEjercicios/{catalogoId|slug}
  nombre, grupoMuscular, catalogoId, pr, ultimaVez, puntos[]
```

Las reglas ([firestore.rules](firestore.rules)) validan la propiedad por `usuarioId`, los campos permitidos en cada `create` (`hasOnly`) y los campos que cada `update` puede tocar (`diff().affectedKeys()`). El catálogo global es de solo lectura (`allow write: if false`); se puebla vía Admin SDK desde `scripts/`.

## Optimización de lecturas (Firestore Spark)

El plan gratuito tiene 50k lecturas/día. La arquitectura combina **denormalización** y **agregados**:

1. **`sesiones.resumen`** — al completar una sesión se escribe un campo con todos sus datos. Es la **fuente de verdad**: permite cargar el historial completo con una sola query (`getSesionesConResumen`) y es desde donde se reconstruyen los agregados.
2. **Agregados por usuario** — son el **camino principal de lectura** de la UI; evitan descargar el historial entero en cada visita a Home, Progreso o SesionActiva:
   - **`usuarios/{uid}/stats/global`** — `diasEntrenados` (epochs) y `volumenPorSesion` (cap 200). Alimenta calendario, rachas, frecuencia semanal y el tab Volumen con **1 lectura**.
   - **`usuarios/{uid}/statsEjercicios/{catalogoId|slug}`** — `pr`, `ultimaVez` y `puntos` de gráfico (cap 150) por ejercicio. Reemplaza el recorrido del historial completo en SesionActiva (referencia última vez/PR) y en el gráfico de Progreso.

Ambos se actualizan al completar una sesión ([src/firebase/statsGlobal.js](src/firebase/statsGlobal.js), [src/firebase/statsEjercicios.js](src/firebase/statsEjercicios.js)) y tienen **fallback self-healing**: si el doc no existe todavía, se reconstruye desde `resumen` y se persiste. El historial de la pantalla Historial usa `getSesionesPaginadas` (`limit` + `startAfter`, índice compuesto en [firestore.indexes.json](firestore.indexes.json)) en vez de descargar todo.

Las sesiones antiguas sin `resumen` se ignoran en los gráficos.

**Costo por usuario activo:**

| Escenario | Lecturas/día |
|---|---|
| Sin denormalización | ~3.000 |
| Con denormalización | ~70 |
| Capacidad Spark (50k) | ~700 workouts → ~350 usuarios activos |

**Impacto de los agregados** (usuario con ~200 sesiones): Progreso ~200 → ~21 lecturas, SesionActiva ~200 → ~6, Home (sin cache) ~200 → 1.

Diseño completo en [docs/paginacion-diseno.md](docs/paginacion-diseno.md).

## Scripts de mantenimiento

Corren con Admin SDK y requieren `scripts/serviceAccount.json` (gitignorado). Todos aceptan dry-run por defecto:

| Script | Qué hace |
|---|---|
| `node scripts/backfillStats.js [--aplicar]` | Construye `stats/global` y `statsEjercicios` para usuarios pre-migración |
| `node scripts/migrarSesiones.js [--aplicar]` | Normaliza nombres de ejercicios contra el catálogo |
| `npm run reporte` | Reporte de actividad (read-only). Flags: `--dias=N`, `--sin-conteo-sesiones` |

## Testing

**347 tests** en **41 archivos**, colocados junto al código que testean (`Foo.jsx` + `Foo.test.jsx`). Setup en [src/test/setup.js](src/test/setup.js).

```bash
npm run test        # modo watch (re-corre al guardar)
npm run test:run    # una sola pasada (para antes de hacer push)
npm run lint        # ESLint (también corre en CI)
```

### Cobertura

| Área | Tests |
|---|---|
| Capa Firebase (`sesiones` 29, `statsEjercicios` 12, `programas` 11, `statsGlobal` 11, `registros` 10, `ejerciciosDia` 8, `dias` 7, `auth` 6, `timerPresets` 5, `peso` 4) | 103 |
| Timer (`useTimer` 15, `TimerActivo` 11, `useWakeLock` 10, `TimerConfig` 8, `TimerFin` 4, página `Timer` 6) | 54 |
| Componentes (`ui` 15, `SeleccionarEjercicio` 15, `SwipeToDelete` 11, `Calendario` 9, `Toast` 9, `BottomNav` 8, `ErrorBoundary` 6, `UpdateBanner` 6, `LazyPanel` 4, `Credit` 2, `PageLoader` 1) | 86 |
| Páginas (`Progreso` 16 + `Progreso.render` 6, `Entrenar` 9, `Home` 9, `Dias` 8, `EjerciciosDia` 7, `Programas` 7, `SesionActiva` 7, `Login` 6, `ResumenSesion` 5, `SerieForm` 4) | 84 |
| Hooks (`useKeyboardShortcut` 8, `useLongPress` 7, `useEliminarConUndo` 5) | 20 |

Sin cobertura hoy: `App.jsx`, `UserContext.jsx`, `utils/`, `firebase/{analytics,catalogo,config,errores,softDelete}.js`, `components/{DesktopSidebar,DnDList,Onboarding,PullToRefresh}.jsx` y los subcomponentes de `pages/progreso/`.

### GitHub Actions

- **Tests** (`test.yml`): lint + tests en cada push y pull request a `main`.
- **Deploy** (`deploy.yml`): en cada push a `main`, build y deploy de hosting **y reglas de Firestore**.

---

## Archivos clave

```
src/
  App.jsx            — rutas, lazy loading, transiciones, PrivateRoute
  context/
    UserContext.jsx  — sesión de usuario (provider global)
  firebase/
    config.js        — init de Firebase + persistencia offline multi-tab
    auth.js          — Google Sign-In, signOut, perfil de usuario
    sesiones.js      — CRUD sesiones, getSesionesConResumen, getSesionesPaginadas,
                       esMismoEjercicio, backfillResumen
    registros.js     — CRUD registros (cruce por catalogoId)
    programas.js     — CRUD programas
    dias.js          — CRUD días
    ejerciciosDia.js — CRUD de ejercicios dentro de un día (catalogoId, esCustom)
    catalogo.js      — catálogo global de ejercicios (ejerciciosCatalogo)
    statsGlobal.js   — agregado stats/global (calendario, rachas, volumen)
    statsEjercicios.js — agregado por ejercicio (PR, última vez, puntos)
    timerPresets.js  — CRUD de presets de timer por usuario (máx. 5)
    peso.js          — registro de peso corporal
    softDelete.js    — helpers de soft-delete y reordenamiento
    analytics.js     — GA4: logPaginaVista, logEvento
    errores.js       — listeners globales de error, reporte a GA4
  pages/
    Login.jsx        — pantalla de acceso (única ruta pública)
    Home.jsx         — dashboard con calendario y accesos rápidos
    Programas.jsx    — gestión de programas
    Dias.jsx         — días de un programa
    EjerciciosDia.jsx — ejercicios de un día
    Entrenar.jsx     — elegir programa y día, iniciar sesión
    SesionActiva.jsx — registro de series en tiempo real
      sesion-activa/ — SerieForm, SerieFooter, ReferenciaCard, EjercicioInfo,
                       ListaEjerciciosDesktop, Confetti
    ResumenSesion.jsx — resumen y edición post-sesión
    Progreso.jsx     — gráficos de progresión, volumen, peso y rachas
      progreso/      — GraficoTab, VolumenTab, PesoTab, RachasTab, HistorialTab,
                       HeaderProgreso, ChipsFiltro, PesoModal, format.js
    Timer.jsx        — pantalla de timer
  components/
    ui.jsx           — design system interno (Modal, EmptyState, breadcrumbs, …)
    BottomNav.jsx    — navegación inferior mobile
    DesktopSidebar.jsx — navegación lateral desktop
    Calendario.jsx   — calendario mensual con días entrenados
    SeleccionarEjercicio.jsx — picker de ejercicios con búsqueda fuzzy
    DnDList.jsx      — wrapper genérico de dnd-kit
    SwipeToDelete.jsx — gesto de deslizar para eliminar
    Toast.jsx        — provider de toasts + undo
    Onboarding.jsx   — flujo de primera vez
    PullToRefresh.jsx — pull-to-refresh para mobile
    LazyPanel.jsx    — defer de gráficos vía IntersectionObserver
    UpdateBanner.jsx — actualización del service worker
    ErrorBoundary.jsx, PageLoader.jsx, Credit.jsx
    timer/
      useTimer.js      — hook de cronómetro (cuenta regresiva por fases)
      useWakeLock.js   — wake lock de pantalla (+ fallback de audio en iOS)
      TimerConfig.jsx  — configuración de duración y presets
      TimerActivo.jsx  — cronómetro corriendo
      TimerFin.jsx     — pantalla de fin de timer
  hooks/
    useDesktop.js         — detección de viewport desktop
    useLongPress.js       — long-press para steppers
    useEliminarConUndo.js — soft-delete optimista + toast Deshacer
    useKeyboardShortcut.js — atajos de teclado
  utils/
    fechas.js        — toDate (normaliza Timestamp | Date | epoch)
    stats.js         — calcular1RM, calcularStreaks, frecuenciaSemanal
```
