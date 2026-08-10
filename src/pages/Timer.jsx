import { useState, useRef } from 'react'
import { useTimer } from '../components/timer/useTimer'
import { useWakeLock } from '../components/timer/useWakeLock'
import TimerConfig from '../components/timer/TimerConfig'
import TimerActivo from '../components/timer/TimerActivo'
import TimerFin from '../components/timer/TimerFin'

export default function Timer() {
  const timer = useTimer()
  const wakeLock = useWakeLock()
  const tiempoTotalFinalRef = useRef(0)

  function handleIniciar(config) {
    wakeLock.activar()
    timer.iniciar(config)
  }

  function handleTerminar() {
    tiempoTotalFinalRef.current = timer.tiempoTotalSegundos
    wakeLock.liberar()
    timer.terminar()
  }

  if (!timer.iniciado) {
    return <TimerConfig onIniciar={handleIniciar} />
  }

  if (timer.fase === 'fin') {
    // tiempoTotalFinalRef is set by TERMINAR (manual stop).
    // When the timer completes all phases naturally, capture it from the hook here
    // (timer.tiempoTotalSegundos becomes 0 once terminar() is called, so we capture before).
    const tiempoMostrar = tiempoTotalFinalRef.current || timer.tiempoTotalSegundos
    return (
      <TimerFin
        config={timer.config}
        setsCompletados={timer.config?.sets ?? 0}
        tiempoTotal={tiempoMostrar}
        onVolver={() => { wakeLock.liberar(); timer.terminar() }}
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
