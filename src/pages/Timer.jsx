import { useTimer } from '../components/timer/useTimer'
import { useWakeLock } from '../components/timer/useWakeLock'
import TimerConfig from '../components/timer/TimerConfig'
import TimerActivo from '../components/timer/TimerActivo'
import TimerFin from '../components/timer/TimerFin'

export default function Timer() {
  const timer = useTimer()
  const wakeLock = useWakeLock()

  function handleIniciar(config) {
    wakeLock.activar()
    timer.iniciar(config)
  }

  function handleTerminar() {
    wakeLock.liberar()
    timer.terminar()
  }

  if (!timer.iniciado) {
    return <TimerConfig onIniciar={handleIniciar} />
  }

  if (timer.fase === 'fin') {
    // tiempoTotalSegundos se fija en el estado del hook al entrar a 'fin'.
    return (
      <TimerFin
        setsCompletados={timer.config?.sets ?? 0}
        tiempoTotal={timer.tiempoTotalSegundos}
        onVolver={handleTerminar}
      />
    )
  }

  return (
    <TimerActivo
      fase={timer.fase}
      segundosRestantes={timer.segundosRestantes}
      setActual={timer.setActual}
      config={timer.config}
      pausado={timer.pausado}
      onPausar={timer.pausar}
      onReanudar={timer.reanudar}
      onSaltar={timer.saltarIntervalo}
      onTerminar={handleTerminar}
    />
  )
}
