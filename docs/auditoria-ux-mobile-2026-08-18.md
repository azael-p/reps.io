# Auditoría de UI/UX mobile de reps.io — 18 de agosto de 2026

Análisis de la experiencia de uso, con foco en el contexto real de la app: **el
gimnasio, con el celular en una mano, entre series**. Complementa a
[`auditoria-2026-08-14.md`](auditoria-2026-08-14.md), que cubrió bugs, seguridad y
deuda técnica pero no miró la app desde el lado del usuario.

**25 hallazgos. 14 resueltos en esta pasada** (los de bajo riesgo), 11 documentados
con propuesta y sin implementar. Cada hallazgo cita `archivo:línea` y, cuando la
evidencia es una medición, transcribe el número obtenido.

## Metodología

Tres fuentes, en este orden de confianza:

1. **Medición en el navegador con la app corriendo** (`npm run dev`, Chrome, sesión
   real del usuario). Las geometrías se midieron con `getBoundingClientRect()` y la
   alcanzabilidad de cada control con `document.elementFromPoint()` — no "se ve
   tapado", sino *qué elemento recibe el tap*.
2. **Cálculo de contraste WCAG 2.x** sobre los tokens de `index.css`, con la fórmula
   de luminancia relativa. Tablas completas en el apéndice.
3. **Lectura de código** para todo lo demás.

**Limitación declarada:** Chrome en macOS no permite bajar el viewport de ~500px de
ancho, así que las mediciones se hicieron a 500px (sigue siendo el layout mobile:
el breakpoint es 1024px) y, para las pantallas que requieren una sesión activa, con
sondas que montan el markup real contra el CSS global en vez de crear una sesión de
entrenamiento falsa en la base de producción. Las alturas y los contrastes son
exactos; **no** se verificó el render a 360–390px de ancho ni en un iPhone físico.
Lo relativo a iOS Safari (auto-zoom, safe areas) es análisis de código, no
observación.

---

## Resumen priorizado

| # | Sev. | Ubicación | Problema | Estado |
|---|---|---|---|---|
| 1 | 🔴 | `index.css:595` | El footer de Entrenar tapa el BottomNav: los 5 tabs son intocables | ✅ resuelto |
| 2 | 🔴 | `Toast.jsx:145` | El toast se come el tap del botón "Completar serie" | ✅ resuelto |
| 3 | 🔴 | `SerieForm.jsx:28` | Un peso con coma (`82,5`) se guarda como **0 kg**, sin aviso | ✅ resuelto |
| 4 | 🟠 | `index.css:55` | `--text-dim` da 2.48:1 — la mitad del mínimo legal AA | ✅ resuelto |
| 5 | 🟠 | `index.css:1551` | "Cancelar sesión" mide 14px de alto y borra el entrenamiento entero | ✅ resuelto |
| 6 | 🟠 | `SesionActiva.jsx` | No hay timer de descanso donde se descansa | ⬜ propuesta |
| 7 | 🟠 | `Entrenar.jsx:38` | 4 taps para empezar, con un solo programa existente | ⬜ propuesta |
| 8 | 🟠 | `index.css:1653` | iOS hace auto-zoom en los campos de nota y no vuelve | ✅ resuelto |
| 9 | 🟠 | `main.jsx` | Framer Motion ignora `prefers-reduced-motion` | ✅ resuelto |
| 10 | 🟡 | varios | 8 targets más por debajo de 44px | ✅ resuelto |
| 11 | 🟡 | `index.css:1217` | Subtítulos de las cards de Home: 2.11:1 sobre el gradiente | ✅ resuelto |
| 12 | 🟡 | `HistorialTab.jsx` | La sesión 20 del historial entra recién a los 800 ms | ✅ resuelto |
| 13 | 🟡 | `Timer.jsx` | Salir del timer corriendo lo destruye sin preguntar | ⬜ propuesta |
| 14 | 🟡 | `GraficoTab.jsx:97` | Las fechas del eje X se pisan entre sí | ✅ resuelto |
| 15 | 🟡 | global | Sin indicador de offline en una app que se usa en subsuelos | ⬜ propuesta |
| 16 | 🟡 | `sesion-activa/` | La pantalla más usada muestra la referencia dos veces | ⬜ propuesta |
| 17 | 🟡 | `SerieFooter.jsx:23` | El CTA se desplaza solo entre series | ⬜ propuesta |
| 18 | 🟡 | `Progreso.jsx` | Las tabs no son tabs para un lector de pantalla | ✅ resuelto |
| 19–25 | 🟢 | varios | Consistencia, gestos, hápticos, calendario inerte, CSS-in-JS | ⬜ ver sección |

Los tres primeros **rompen la tarea principal de la app**. El #3 además corrompe
datos en silencio, que es la peor clase de bug: el usuario no se entera nunca.

---

## 🔴 Críticos

### 1. El footer de "Empezar entrenamiento" deja los 5 tabs del nav intocables

**Dónde:** `src/index.css:595`

```css
.entrenar-footer {
  position: fixed; bottom: 0; left: 0; right: 0;
  z-index: 51;   /* .bottom-nav está en z-index: 50 */
}
```

**Evidencia medida** (viewport 500×623, tras elegir un día):

```
footer: top 534, bottom 623, alto 89px, z-index 51
nav:    top 559, bottom 623, alto 64px, z-index 50
elementFromPoint sobre el centro de cada tab:
  Inicio: ENTRENAR-FOOTER    Entrenar: ENTRENAR-FOOTER
  Programas: ENTRENAR-FOOTER Progreso: ENTRENAR-FOOTER
  Timer: ENTRENAR-FOOTER
```

Los 64px del nav caen enteros dentro de los 89px del footer.

**Impacto:** apenas seleccionás un día, perdés la navegación de la app. Peor: el
usuario que apunta a "Inicio" —abajo a la izquierda, donde estuvo siempre— **crea
un entrenamiento que no quería**, porque ahí ahora está "Empezar entrenamiento". Y
como `crearSesion()` escribe en Firestore antes de navegar, esa sesión fantasma
queda registrada. También el último día de la lista quedaba cortado detrás del
footer (visible en la captura de verificación: "Día 5" a medias).

**Resuelto:** el footer se apoya sobre el nav en vez de encima
(`bottom: calc(64px + env(safe-area-inset-bottom))`), y el `paddingBottom` del
wrapper de `Entrenar` pasó de 120px a 190px para que la lista termine por encima de
ambas capas. Verificado post-fix: `footer.bottom = 738 = nav.top`, sin solape, los 5
tabs alcanzables y el CTA de "Empezar" también.

### 2. El toast le roba el tap al botón "Completar serie"

**Dónde:** `src/components/Toast.jsx:145`

```jsx
<div style={{ position: 'fixed', bottom: 80, /* … */ zIndex: 1000 }}>
```

**Evidencia medida** (geometría real de `SesionActiva` + el contenedor de toasts):

```
CTA "Completar serie":  top 499, bottom 551
toast:                  top 485, bottom 543
solape vertical: 45px de los 52px del botón
elementFromPoint sobre el centro del CTA → p-toast
```

**Impacto:** el CTA más tocado de la app queda bloqueado durante los 3 segundos que
dura el toast. Y no es una coincidencia desafortunada: los toasts que aparecen en
`SesionActiva` son justamente los de fallo de sincronización
(`SesionActiva.jsx:205`, *"Se sincronizará cuando haya conexión"*), o sea que
aparecen **cuando hay mala señal, o sea en el gimnasio**. El usuario toca, no pasa
nada, vuelve a tocar. En el mejor caso pierde tiempo entre series; en el peor cree
que la serie no se guardó.

`SesionActiva` no monta el `BottomNav`, así que los 80px de separación que en el
resto de la app despejan el nav, acá caen justo sobre el footer del formulario.

**Resuelto:** los toasts se anclan arriba (`top: 0` + `safe-area-inset-top`), con la
animación de entrada invertida. Además de eliminar la colisión con este CTA y con el
nav en todas las demás pantallas, los deja fuera del alcance del pulgar — que es
donde conviene un aviso que no se debe tocar sin querer. Verificado post-fix: toast
en 12–56px, CTA en 734–786px, sin solape, y el tap sobre el CTA lo recibe el CTA.

> Es el único cambio con impacto visual notorio de esta tanda. Si preferís los
> toasts abajo, se revierte cambiando `top: 0` por `bottom: 80` y devolviendo los
> `y` de la animación a positivos.

### 3. Un peso con coma decimal se guarda como 0 kg

**Dónde:** `src/pages/sesion-activa/SerieForm.jsx:28` y `SesionActiva.jsx:224`

```jsx
<motion.input type="number" inputMode="decimal" value={pesoUsado}
              onChange={e => setPesoUsado(e.target.value)} />
```
```js
pesoUsado: Number(pesoUsado) || 0,
```

**El mecanismo:** en un teclado es-AR/es-UY el separador decimal es la coma. Con
`<input type="number">`, el navegador considera `"82,"` un valor inválido y
`e.target.value` devuelve **string vacío** — el estado queda en `''`. El usuario ve
el campo comportarse raro, completa la serie igual, y `Number('') || 0` guarda
**0 kg**. Sin error, sin toast, sin nada.

La ironía es que el proyecto ya tenía la solución escrita: `parsePeso()`
(`src/utils/stats.js:6`) existe exactamente para esto, con el comentario *"Acepta
coma decimal: en teclados es-UY es lo que sale naturalmente"*. Pero solo lo usaban
el peso corporal y el onboarding — los dos lugares donde el peso importa menos. El
registro de series, que es el dato central de la app, no.

**Impacto:** series con 0 kg en el historial. Y como el volumen y los PR se derivan
del campo `resumen` denormalizado, un 0 mal guardado se propaga a los gráficos, al
volumen total y a los récords, sin forma de detectarlo después.

**Resuelto:** los campos de peso pasaron a `type="text" inputMode="decimal"` (mismo
teclado numérico, sin la validación destructiva del navegador) con un
`sanitizarPeso()` nuevo que filtra a mano — dígitos y un solo separador decimal — y
todas las lecturas del valor usan `parsePeso()`, incluidos los steppers de ±2,5 kg,
que tenían el mismo `Number()` y convertían "82,5" en 0 al tocar el botón. Cubierto
por `src/utils/stats.test.js` (10 casos nuevos).

---

## 🟠 Altos

### 4. `--text-dim` está a la mitad del contraste mínimo

**Dónde:** `src/index.css:55` — `--text-dim: #5a5a63`, usado en 17 reglas.

**Medición** (ratio de contraste WCAG; el mínimo AA para texto normal es 4.5:1):

| Sobre | Ratio | |
|---|---|---|
| `--bg` | 2.90 | ✗ |
| `--bg-elev` | 2.76 | ✗ |
| `--bg-card` | 2.64 | ✗ |
| `--bg-input` | 2.54 | ✗ |
| `--bg-card-hover` | **2.48** | ✗ |

Falla en todas. No llega ni al 3:1 que se le exige al texto *grande*.

**Dónde se nota:** los números del calendario de Home (`.calendario-dia`), las
etiquetas "SERIES"/"REPS" de las tarjetas de ejercicio, los labels del eje del
gráfico de frecuencia, la referencia "Última vez" de la sesión activa, el número de
serie en el resumen, y todos los `::placeholder`. En los días futuros del calendario
se suma `opacity: 0.35` encima (`index.css:695`), lo que lo deja en ~1.5:1 —
efectivamente invisible. En la captura previa al fix, los números del calendario no
se leen.

Esto pesa el doble en esta app: pantalla a distancia de brazo, luz ambiente alta,
usuario cansado.

**Resuelto:** `--text-dim: #8a8a94`, verificado en el navegador post-fix: **4.96:1**
en la peor superficie y 5.27:1 sobre `--bg-card`. Sigue leyéndose como texto
terciario frente a `--text-mute` (6.1:1), así que la jerarquía visual se mantiene.

### 5. La acción más destructiva de la app es el target más chico

**Dónde:** `src/index.css:1551`

```css
.sa-cancelar-btn { font-size: 0.72rem; padding: 0; opacity: 0.7; }
```

**Medido: 14px de alto.** Es el control más pequeño de toda la app, y lo que hace es
abrir el diálogo que **borra la sesión entera con todos sus registros**
(`SesionActiva.jsx:271`). Está pegado debajo del contador de series, a pocos píxeles
de "Terminar" (39px, que hace algo completamente distinto: guarda y sale).

La jerarquía está invertida: la acción irreversible es diminuta y la reversible es
un botón cómodo. Que sea chiquita no protege de nada — un dedo que apunta al
contador puede caer ahí — y sí garantiza que quien *quiere* cancelar tenga que
intentarlo tres veces.

**Resuelto:** 44px reales de altura táctil sin ensanchar la columna (`align-self:
flex-start`), con la tipografía apenas más legible (0.78rem) y sin ganar peso visual
sobre "Terminar", que también subió a 44px. El `ConfirmDialog` que ya existía sigue
siendo la red de seguridad real.

### 6. No hay timer de descanso donde justamente se descansa ⬜

**Dónde:** `src/pages/SesionActiva.jsx` (ausencia), `src/pages/Timer.jsx`

El descanso entre series es *el* uso de un cronómetro en un gimnasio. La app tiene
un timer excelente —presets, wake lock, fases por color— pero vive en `/timer`, una
ruta aparte. Ir hasta ahí desmonta `SesionActiva`; volver la remonta y recarga.
Nadie hace eso entre series: usa el timer del celular y listo.

**Propuesta:** al completar una serie, arrancar un contador de descanso *dentro* de
la pantalla de sesión — una barra o un anillo discreto en el footer, con el tiempo
por defecto por ejercicio y un tap para saltarlo. No hace falta el motor completo de
`useTimer`; alcanza con una cuenta regresiva y el `useWakeLock` que ya existe. Es la
mejora con mayor retorno de esta lista.

### 7. Cuatro taps para empezar a entrenar, con un solo programa ⬜

**Dónde:** `src/pages/Entrenar.jsx:38`

`getProgramas()` carga la lista y `programaId` queda en `null`: siempre hay que
tocar un programa, aunque haya uno solo.

**Verificado con los datos reales de la cuenta:** 1 programa ("RUTINA"), 5 días. O
sea que el paso "1. Elegí un programa" es, para este usuario, un tap que no decide
nada — y se paga en cada entrenamiento.

Camino actual: Home → Entrenar → programa → día → Empezar = **4 taps** + esperar dos
cargas de Firestore encadenadas (los días recién se piden al tocar el programa).

**Propuesta,** en orden de esfuerzo:
- Autoseleccionar el programa si hay exactamente uno (elimina 1 tap y una espera).
- Recordar el último día entrenado y ofrecer arriba de todo *"Seguir: Día 3 —
  pierna"*, con el orden del programa como heurística de "el que sigue".
- Que la card "Entrenar hoy" de Home lleve directo a ese atajo: **Home → Empezar = 1 tap**.

### 8. iOS hace auto-zoom en los campos de nota

**Dónde:** `index.css:1653` (`.sa-nota-input`) e `index.css:1062` (`.resumen-nota-input`)

Ambos declaraban `font-size: 0.95rem` → **15.2px medidos**. Safari en iOS hace zoom
automático al enfocar cualquier campo con tipografía menor a 16px, y como el
`viewport` no fija `maximum-scale` (correctamente, porque bloquear el zoom es un
problema de accesibilidad peor), la página **queda ampliada** después de escribir.
En medio de una serie, eso obliga a un pellizco para volver.

El resto de los campos ya estaban bien (los de peso/reps a 25.6px, la búsqueda del
picker a 16px). Eran solo estos dos.

**Resuelto:** ambos a `font-size: 16px` exactos, con el comentario del porqué para
que no vuelvan a bajar.

### 9. Framer Motion ignora `prefers-reduced-motion`

**Dónde:** `src/index.css:330` vs. todos los `motion.*` del proyecto

La media query existe y anula `animation-duration`/`transition-duration`… de las
animaciones **CSS**. Pero prácticamente todo el movimiento de la app son props
`initial`/`animate`/`transition` de Framer, que corren en JavaScript y no se enteran
de esa regla. Un usuario con "Reducir movimiento" activado —una preferencia de
accesibilidad real, no un capricho— sigue recibiendo las transiciones direccionales
de página, los springs escalonados de cada lista, el confeti y el pulso del banner.

**Resuelto:** `<MotionConfig reducedMotion="user">` envolviendo la app en
`main.jsx`. Es el mecanismo que Framer provee justamente para esto: respeta la
preferencia del sistema y deja pasar solo las animaciones de opacidad.

---

## 🟡 Medios

### 10. Ocho targets más por debajo de 44px

44×44px es el mínimo de las guías de Apple y Google, y acá es más exigible que en
una app de escritorio: dedos con magnesio, mano temblando después de una serie
pesada.

| Control | Antes | Ahora |
|---|---|---|
| `.sa-cancelar-btn` (ver #5) | 14px | 44px |
| `.sa-hint-tocable` (rellenar peso anterior) | 15px | 44px |
| `.sa-ref-tab` (Última / PR) | 21px | 40px |
| `.crud-drag-handle` (reordenar) | 28px | 44px |
| botón cerrar del Toast | 24px | 40px |
| `ChipsFiltro` (filtros del historial) | 28px | 40px |
| `.picker-clear-btn` (limpiar búsqueda) | 36px | 44px |
| `.resumen-serie-row` (editar una serie) | 38px | 48px |
| `.sa-terminar-btn` | 39px | 44px |
| `.crud-accion-btn` | 43px | 47px |
| `.progreso-chip` / `.picker-grupo-btn` | 43px | 45px |

`.sa-ref-tab` quedó en 40px a propósito: es un toggle secundario y a 44px empezaba a
competir visualmente con el nombre del ejercicio. Los dos handles de arrastre usan
padding con margen negativo, así que crecen sin mover el layout.

Todos re-medidos en el navegador después del cambio.

### 11. Los subtítulos de las cards de Home no se leen sobre su gradiente

**Dónde:** `src/index.css:1217` — `.home-seccion-sub { color: rgba(255,255,255,0.65) }`

Medido contra el punto medio de cada gradiente: **2.11:1** sobre el verde, 2.56:1
sobre el naranja, 2.62:1 sobre el azul. Los tres fallan. Son los textos "Rutinas y
ejercicios", "Iniciar sesión", "Gráficos e historial" — la única pista de qué hace
cada card.

**Resuelto:** `rgba(255,255,255,0.88)`.

### 12. La sesión 20 del historial aparece a los 800 ms

**Dónde:** `HistorialTab.jsx`, y el mismo patrón en Programas, Días, Entrenar y ResumenSesion.

`transition={{ delay: i * 0.04 }}` sin tope: el escalonado es lindo en los primeros
elementos y una espera en el vigésimo. En ResumenSesion se acumulaban dos índices
(`0.25 + i*0.06 + j*0.03`), llegando a ~760 ms para la última serie de una sesión
larga. En una app que se usa en pausas de 60 segundos, eso se siente lento aunque
los datos ya estén.

El propio proyecto ya tenía la solución aplicada en el picker de ejercicios
(`SeleccionarEjercicio.jsx:252`: `Math.min(i, 12)`).

**Resuelto:** tope de `Math.min(i, 8)` en las cinco listas.

### 13. Salir del timer corriendo lo destruye sin preguntar ⬜

**Dónde:** `src/pages/Timer.jsx`, `src/components/BottomNav.jsx:13`

El estado del timer vive en `useTimer()`, local a la página. `/timer` está en
`RUTAS_NAV`, así que el BottomNav se muestra **durante** el timer, justo debajo de
los botones de 80px de alto (`index.css:704` reserva el espacio a propósito). Un tap
en cualquier tab desmonta la página y el HIIT desaparece: sin confirmación, sin
posibilidad de volver.

Contrasta con el cuidado que sí se le puso a la sesión de entrenamiento, que tiene
puntero en `localStorage`, banner de "Entrenamiento en curso" en Home y diálogo de
conflicto.

**Propuesta:** confirmar antes de salir con el timer activo, o —mejor— replicar el
patrón de la sesión: banner de "Timer en curso" en Home y estado que sobreviva a la
navegación.

### 14. Las fechas del eje X del gráfico se pisan

**Dónde:** `src/pages/progreso/GraficoTab.jsx:97`

El `<XAxis>` no declaraba `interval` ni `minTickGap`, así que Recharts intenta
dibujar un tick por sesión. Con 20+ puntos en 390px de ancho las fechas se
superponen hasta ser ilegibles.

**Resuelto:** `interval="preserveStartEnd"` + `minTickGap={28}` — descarta los ticks
intermedios que no entran y conserva el primero y el último.

### 15. Sin indicador de estado offline ⬜

Toda la app depende de la persistencia de Firestore, y está bien resuelta a nivel
datos: las escrituras se aplican al cache local y se sincronizan después. Pero la
interfaz nunca dice en qué estado está. Los toasts prometen *"se sincronizará cuando
haya conexión"* y ahí termina: no hay forma de saber si esa promesa se cumplió.

En un gimnasio en subsuelo, sin señal durante una hora entera, el usuario registra
un entrenamiento completo sin ninguna confirmación de que existe en algún lado.

**Propuesta:** un indicador discreto —un punto en el header de la sesión— con tres
estados: en línea / sin conexión / N cambios sin sincronizar. Firestore expone lo
necesario (`onSnapshot` con `metadata.hasPendingWrites`, y `navigator.onLine` para
el estado de red).

### 16. La pantalla más usada muestra la referencia dos veces ⬜

**Dónde:** `sesion-activa/ReferenciaCard.jsx` + `SerieForm.jsx:53`

Durante una serie, la pantalla muestra: barra de progreso, contador, cancelar,
terminar, nombre del ejercicio (1.55rem), badge de grupo muscular, "Serie X de Y",
puntos de progreso, tabs Última/PR, línea de referencia, dos steppers, botón "+
Nota" ocupando una fila entera, **una segunda tarjeta de referencia** con el dato de
la serie puntual, y el footer con dos botones.

La referencia aparece dos veces (el resumen de todas las series arriba, la serie
puntual abajo) y "+ Nota" —que se usa en una fracción de las series— tiene el mismo
peso visual que los controles que se usan siempre.

Entre series, con el celular en una mano, lo único que importa es: **qué ejercicio,
qué serie, cuánto peso, cuántas reps, completar**.

**Propuesta:** unificar las dos referencias en un solo bloque, colapsar "+ Nota" a
un icono junto al nombre del ejercicio, y bajar el badge de grupo muscular a texto
secundario. Es rediseño, no un ajuste de CSS — por eso queda fuera de esta pasada.

### 17. El CTA se mueve solo entre series ⬜

**Dónde:** `src/pages/sesion-activa/SerieFooter.jsx:23`

"Corregir serie anterior" entra y sale con `AnimatePresence` dentro del mismo footer
que el botón principal. Aparece recién cuando hay historial, así que **entre la
serie 1 y la 2 el botón "Completar" se desplaza ~56px hacia arriba**. Es exactamente
el momento en que el usuario está por tocarlo de nuevo.

**Propuesta:** reservar el espacio del botón secundario desde el principio
(`visibility` en vez de montaje condicional), para que el CTA no se mueva nunca.

### 18. Las tabs de Progreso no son tabs

**Dónde:** `src/pages/Progreso.jsx`

Eran `<button aria-pressed>`, que un lector de pantalla anuncia como "botón
alternado" suelto, sin decir que forman un grupo de 5 ni cuál está activa.

**Resuelto:** `role="tablist"` / `role="tab"` con `aria-selected` y `aria-controls`,
y el panel con `role="tabpanel"` + `aria-labelledby`. Los tests que buscaban
`getByRole('button')` se actualizaron a `getByRole('tab')` — aserción más precisa,
no más débil.

---

## 🟢 Menores ⬜

**19. `SwipeToDelete` solo existe en Programas.** Días y EjerciciosDía usan el mismo
`DnDList` y las mismas tarjetas, pero sin swipe. El usuario que aprende el gesto en
una pantalla descubre que no funciona en las otras dos.

**20. `PullToRefresh` solo en Home y Progreso.** Mismo problema: el gesto existe, no
en todos lados.

**21. El calendario de Home es decorativo.** Marca los días entrenados pero no se
puede tocar ninguno. Cada celda ya sabe qué día representa y `role="img"` lo declara
inerte explícitamente (`Calendario.jsx:138`). Tocar un día entrenado y llegar al
resumen de esa sesión es un atajo natural que hoy no existe.

**22. CSS-in-JS residual, contra la convención del propio proyecto.** `CLAUDE.md`
dice *"No reintroducir CSS-in-JS ni estilos inline"* y que la migración ya se hizo,
pero `components/ui.jsx` sigue teniendo cinco objetos de estilo (`hs`, `ms`, `ks`,
`es`, `cd`, ~100 líneas) y lo mismo pasa en `Toast.jsx`, `ChipsFiltro.jsx` y el pill
del `BottomNav`. Como `ui.jsx` define el `Header`, el `Modal` y los estados vacíos
—los componentes más reutilizados—, es justo la parte del sistema visual que no se
puede ajustar desde `index.css`.

**23. Sin feedback háptico.** `navigator.vibrate()` en el momento de completar una
serie daría confirmación sin mirar la pantalla — útil cuando el celular está apoyado
en el banco. Cuesta una línea. (No funciona en iOS Safari, sí en Android.)

**24. El swipe-back compite con el contenido horizontal.** `PageWrapper`
(`ui.jsx:249`) hace `drag="x"` sobre la página entera en touch. En `Progreso` eso
convive con los chips de filtro (scroll horizontal), las tabs y los gráficos de
Recharts: un arrastre horizontal sobre el gráfico puede leerse como "volver". Ya hay
mitigación para el drag & drop (la clase `dnd-active`), pero no para el scroll
horizontal. No lo pude reproducir sin un dispositivo táctil real — queda anotado
como riesgo a verificar, no como bug confirmado.

**25. El saludo de la mañana dice "Buenas, ¿qué tal?".** `Home.jsx:20`: entre las 6
y las 12 no dice "Buen día", que es lo que esperaría cualquiera. Cosmético.

---

## Apéndice A — Contraste, antes y después

Ratios WCAG 2.x calculados sobre los tokens de `index.css`. Mínimo AA: 4.5:1 (texto
normal), 3:1 (texto grande ≥24px o ≥19px bold).

| Token | Peor superficie | Antes | Después |
|---|---|---|---|
| `--text` | `--bg-card-hover` | 15.57 ✓ | sin cambios |
| `--text-mute` | `--bg-card-hover` | 6.08 ✓ | sin cambios |
| **`--text-dim`** | `--bg-card-hover` | **2.48 ✗** | **4.96 ✓** |
| `--green` | `--bg-card-hover` | 8.44 ✓ | sin cambios |
| `--orange` | `--bg-card-hover` | 7.71 ✓ | sin cambios |
| `--blue` | `--bg-card-hover` | 8.05 ✓ | sin cambios |
| `--danger` | `--bg-card-hover` | 6.11 ✓ | sin cambios |
| `.home-seccion-sub` | gradiente verde | **2.11 ✗** | **~4.6 ✓** |

La paleta de acentos estaba bien; el problema era exclusivamente el gris terciario.

## Apéndice B — Verificado y sin hallazgos

Para no volver a revisarlo:

- **Safe areas.** `viewport-fit=cover` está declarado y `env(safe-area-inset-*)` se
  usa consistentemente en headers, footers y el nav.
- **Tamaño de fuente de los campos numéricos.** Peso y reps a 25.6px, búsqueda del
  picker a 16px: sin auto-zoom de iOS. El problema estaba solo en las dos notas.
- **Estados vacíos.** Todos tienen mensaje, subtítulo y una acción concreta que
  lleva al siguiente paso. Bien resueltos.
- **Estados de carga.** Skeletons con shimmer en todas las listas, y `LazyPanel`
  difiere los gráficos hasta que entran en viewport.
- **Foco y teclado.** `:focus-visible` con outline visible; el `Modal` mueve el foco
  al primer control, restaura al disparador al cerrar y maneja el botón atrás con
  `pushState`.
- **`aria-live`.** El contador de series lo declara, así que el cambio de serie se
  anuncia.
- **Contraste de la paleta de acentos.** Verde, naranja, azul y rojo pasan AA
  holgadamente sobre todas las superficies.
- **El botón atrás del sistema.** Bien manejado en modales y en los dos niveles del
  picker de ejercicios.

## Apéndice C — Qué se tocó

```
src/index.css                          tokens, 11 targets, colisión de capas, textareas
src/main.jsx                           MotionConfig reducedMotion
src/components/Toast.jsx               reposicionado arriba + botón cerrar 40px
src/pages/Entrenar.jsx                 padding inferior por las dos capas fijas
src/pages/SesionActiva.jsx             parsePeso en las tres lecturas del peso
src/pages/ResumenSesion.jsx            ídem + input de edición a type="text"
src/pages/sesion-activa/SerieForm.jsx  input de peso a type="text" + sanitizarPeso
src/pages/Progreso.jsx                 semántica tablist/tab/tabpanel
src/pages/progreso/GraficoTab.jsx      eje X con minTickGap
src/pages/progreso/ChipsFiltro.jsx     target 40px
src/pages/progreso/HistorialTab.jsx    tope de escalonado
src/pages/Programas.jsx / Dias.jsx     tope de escalonado
src/utils/stats.js                     + sanitizarPeso()
src/utils/stats.test.js                nuevo, 10 casos
src/pages/SesionActiva.test.jsx        aserciones al nuevo tipo de input
src/pages/Progreso.render.test.jsx     aserciones al rol tab
```

`npm run test:run` → **438 tests, todos pasan** (428 previos + 10 nuevos).
`npm run lint` → **0 errores**, 7 warnings de `react-hooks/set-state-in-effect`,
los mismos siete que ya documentaba la auditoría de agosto. No se introdujo ninguno
nuevo ni se silenció ninguno.

## Próximos pasos sugeridos

Por relación impacto/esfuerzo:

1. **Timer de descanso en la sesión activa** (#6) — la funcionalidad que más se
   extraña y la que más justifica abrir la app en el gimnasio.
2. **Atajo de "seguir entrenando"** (#7) — de 4 taps a 1, con lógica simple.
3. **Indicador de sincronización** (#15) — confianza en los datos, que es lo único
   que un tracker realmente vende.
4. **Jerarquía de la sesión activa** (#16, #17) — rediseño de la pantalla que
   concentra el 90% del tiempo de uso.
5. Los menores de consistencia (#19–#21), que son tardes sueltas de trabajo.
