import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import { SceneManager } from '../../lib/map/SceneManager'
import type { Scene } from '../../types'

/** Debe coincidir con el fallback de SceneManager.goTo(). */
const DEFAULT_DURATION_MS = 4000
/** Pausa en cada escena una vez que la cámara aterriza, antes de saltar a la siguiente. */
const DWELL_MS = 1500

/**
 * Índice de la escena cuya cámara está más cerca del punto dado. La distancia
 * es euclidiana en grados a propósito: solo se usa para ordenar escenas por
 * cercanía, no para reportar una medida, así que no hace falta geodésica.
 */
function nearestSceneIndex(scenes: Scene[], lng: number, lat: number): number {
  let nearest = 0
  let nearestDistance = Infinity

  scenes.forEach((scene, index) => {
    const [sceneLng, sceneLat] = scene.camera.center
    const distance = Math.hypot(sceneLng - lng, sceneLat - lat)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearest = index
    }
  })

  return nearest
}

/**
 * Distingue el gesto del usuario del movimiento programático: los eventos que
 * dispara flyTo no traen originalEvent, los del mouse/touch/rueda sí.
 */
function isUserGesture(event: unknown): boolean {
  return (
    typeof event === 'object' &&
    event !== null &&
    'originalEvent' in event &&
    Boolean((event as { originalEvent?: unknown }).originalEvent)
  )
}

type Props = {
  /** Instancia única de Mapbox, ya con el estilo cargado. */
  map: Map
  scenes: Scene[]
}

/**
 * Recorrido guiado interrumpible: arranca solo al montar, se cancela con el
 * primer gesto del usuario y se retoma desde la escena más cercana a donde
 * haya quedado la cámara.
 */
export default function TourControl({ map, scenes }: Props) {
  const [running, setRunning] = useState(false)

  /**
   * Las escenas se leen desde un ref para que el scheduler no dependa de la
   * identidad del array: Astro puede re-renderizar la isla sin cortar el tour.
   */
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes

  const timerRef = useRef<number | null>(null)
  const manager = useMemo(() => new SceneManager(map), [map])

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setRunning(false)
  }, [])

  /** Encadena las escenas desde fromIndex hasta la última, una por timeout. */
  const start = useCallback(
    (fromIndex: number) => {
      const tourScenes = scenesRef.current
      if (tourScenes.length === 0) return

      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      setRunning(true)

      const step = (index: number) => {
        const scene = tourScenes[index]

        // Se acabaron las escenas: el tour se apaga solo.
        if (!scene) {
          timerRef.current = null
          setRunning(false)
          return
        }

        manager.goTo(scene)

        const wait = (scene.duration ?? DEFAULT_DURATION_MS) + DWELL_MS
        timerRef.current = window.setTimeout(() => step(index + 1), wait)
      }

      step(fromIndex)
    },
    [manager]
  )

  // Al cargar, la cámara ejecuta el flythrough automático desde la primera escena.
  useEffect(() => {
    start(0)
    return stop
  }, [start, stop])

  // Cualquier gesto del usuario cancela el tour y pasa el mapa a modo libre.
  useEffect(() => {
    const cancel = (event: unknown) => {
      if (isUserGesture(event)) stop()
    }

    map.on('dragstart', cancel)
    map.on('zoomstart', cancel)
    map.on('rotatestart', cancel)
    map.on('pitchstart', cancel)

    return () => {
      map.off('dragstart', cancel)
      map.off('zoomstart', cancel)
      map.off('rotatestart', cancel)
      map.off('pitchstart', cancel)
    }
  }, [map, stop])

  const handleClick = () => {
    if (running) {
      map.stop()
      stop()
      return
    }

    // Se retoma desde la escena más cercana a donde quedó la cámara, no desde 0.
    const { lng, lat } = map.getCenter()
    start(nearestSceneIndex(scenesRef.current, lng, lat))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={running}
      className="fixed bottom-16 right-6 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-5 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 sm:right-10"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={`h-4 w-4 ${running ? 'animate-spin [animation-duration:6s]' : ''}`}
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M15.5 8.5 10.5 10.5 8.5 15.5 13.5 13.5Z" fill="currentColor" />
      </svg>
      {running ? 'Detener recorrido' : 'Continuar recorrido'}
    </button>
  )
}
