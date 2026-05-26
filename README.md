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
- **Sesión activa**: registrar series en tiempo real con referencia al último peso/reps usado
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
  programaId, nombre, orden

ejerciciosDia/{id}
  diaId, ejercicioId, series, reps, nota, orden

ejercicios/{id}              ← catálogo global
  nombre, grupoMuscular

sesiones/{id}
  usuarioId, diaId, programaId
  creadaEn, completada
  resumen: {                 ← denormalizado al completar
    volumenTotal: number,
    ejercicios: [{ ejercicioId, nombre, grupoMuscular, series: [...] }]
  }

registros/{id}
  sesionId, ejercicioId, numeroSerie
  pesoUsado, repsHechas, nota

peso/{id}
  usuarioId, fecha, valor
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

## Archivos clave

```
src/
  firebase/
    sesiones.js      — CRUD sesiones, getSesionesConResumen, backfillResumen
    registros.js     — CRUD registros, getUltimaVezEjercicioLocal
    programas.js     — CRUD programas y días
    catalogo.js      — catálogo global de ejercicios
    peso.js          — registro de peso corporal
  pages/
    Home.jsx         — dashboard con calendario y accesos rápidos
    SesionActiva.jsx — registro de series en tiempo real
    ResumenSesion.jsx — resumen y edición post-sesión
    Progreso.jsx     — gráficos de progresión, volumen y peso
    Programas.jsx    — gestión de programas y días
  components/
    Calendario.jsx   — calendario mensual con días entrenados
    Onboarding.jsx   — flujo de primera vez
    PullToRefresh.jsx — pull-to-refresh para mobile
  hooks/
    useDesktop.js    — detección de viewport desktop
```
