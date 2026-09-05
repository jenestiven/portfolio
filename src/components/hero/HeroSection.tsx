import { useEffect, useRef, useState } from 'react'

type Props = {
  /**
   * Dispara la secuencia de entrada (geolocalización → aterrizaje → tour). Se
   * llama en el mismo clic, sin esperar al fade: el vuelo y la salida del
   * Hero se solapan a propósito.
   */
  onStart: () => void
  /** Avisa al padre que el fade terminó y ya puede desmontar el overlay. */
  onDismissed: () => void
  /**
   * El mapa todavía no cargó: el CTA queda inerte hasta entonces para que un
   * clic temprano no se pierda en silencio.
   */
  disabled?: boolean
}

const PILLS = ['Sistemas de Información Geográfica', 'Desarrollo de Software', 'Análisis Espacial', 'Mapas Interactivos', 'Visualización de Datos']

/** Debe coincidir con `duration-700` del contenedor. */
const FADE_MS = 700

/**
 * Portada del portafolio: se dibuja sobre el mapa ya montado en la vista de
 * planeta (ver `HERO_CAMERA` en initMap), no lo reemplaza. Sin header ni nav
 * —la única salida es el CTA—, y sin fondo propio salvo un velo radial que
 * oscurece lo justo para que el texto contraste contra el espacio.
 */
export default function HeroSection({ onStart, onDismissed, disabled = false }: Props) {
  const [leaving, setLeaving] = useState(false)
  const fadeTimerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (fadeTimerRef.current !== null) window.clearTimeout(fadeTimerRef.current)
    },
    []
  )

  const handleStart = () => {
    if (leaving || disabled) return
    setLeaving(true)
    onStart()

    // Red de seguridad: si el navegador no emite 'transitionend' (movimiento
    // reducido, pestaña en segundo plano) el overlay se desmonta igual.
    fadeTimerRef.current = window.setTimeout(onDismissed, FADE_MS + 100)
  }

  return (
    <div
      // pointer-events-none deja el globo arrastrable alrededor del texto: solo
      // el botón recupera los eventos.
      className={`pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-700 ease-out ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.45) 45%, rgba(2,6,23,0) 75%)',
      }}
      onTransitionEnd={(event) => {
        // Solo la opacidad del contenedor cierra el Hero: las transiciones de
        // los hijos (hover del botón) burbujean hasta aquí.
        if (leaving && event.target === event.currentTarget && event.propertyName === 'opacity') {
          onDismissed()
        }
      }}
      aria-hidden={leaving}
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        {PILLS.map((pill) => (
          <span
            key={pill}
            className="rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white/85 backdrop-blur-md sm:text-sm"
          >
            {pill}
          </span>
        ))}
      </div>

      <h1 className="mt-8 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.8)] sm:text-6xl lg:text-7xl">
        ¡Hola! Soy <span className="text-blue-400">Jhon,</span> Desarrollador <span className="text-blue-400">GIS.</span>
      </h1>

      <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
        Especializado en análisis espacial y desarrollo de software: convierto datos
        geográficos en herramientas que la gente usa todos los días.
      </p>

      <button
        type="button"
        onClick={handleStart}
        disabled={disabled || leaving}
        className="pointer-events-auto mt-10 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-slate-900 shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition hover:bg-white/90 disabled:cursor-progress disabled:opacity-60 sm:text-base"
      >
        Comenzar Recorrido
        <span aria-hidden="true">→</span>
      </button>
    </div>
  )
}
