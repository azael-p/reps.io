import { useEffect } from 'react'
import { useTimer } from '../components/timer/useTimer'
import { useWakeLock } from '../components/timer/useWakeLock'
import TimerConfig from '../components/timer/TimerConfig'
import TimerActivo from '../components/timer/TimerActivo'
import TimerFin from '../components/timer/TimerFin'
import { useTimerActivo } from '../context/TimerActivoContext'

export default function Timer() {
  const timer = useTimer()
  const wakeLock = useWakeLock()
  const { setTimerActivo } = useTimerActivo()

  // Avisa al BottomNav si hay tiempo transcurrido en juego, para que
  // confirme antes de navegar afuera y perderlo. Se resetea al desmontar
  // (salida "legítima", ya sea por terminar o por navegar con confirmación).
  useEffect(() => {
    setTimerActivo(timer.iniciado && timer.fase !== 'fin')
    return () => setTimerActivo(false)
  }, [timer.iniciado, timer.fase, setTimerActivo])

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
