import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import distance from '@turf/distance'
import { point } from '@turf/helpers'
import { DEFAULT_FLY_DURATION_MS, SceneManager } from '../../lib/map/SceneManager'
import type { Scene } from '../../types'

/**
 * Pausa mínima en cada ciudad, contada desde que la cámara aterriza. Es
 * independiente de la duración del vuelo: aunque el `flyTo` termine antes, la
 * escena se queda en pantalla estos 20s antes del siguiente `goTo`.
 */
const DWELL_MS = 20000

/**
 * Por debajo de este umbral el tramo es un movimiento local (reencuadre dentro
 * de la misma ciudad): no se le impone duración, manda la `duration` de la escena.
 */
const LOCAL_HOP_KM = 500
/** Tramo que ya se cobra el tiempo máximo — media vuelta al planeta. */
const LONGEST_HOP_KM = 12000
/** Rango de duración de un vuelo entre ciudades. */
const MIN_FLIGHT_MS = 6000
const MAX_FLIGHT_MS = 10000

/**
 * Duración del tramo en ms, proporcional a la distancia recorrida. Devuelve
 * `undefined` en movimientos locales para que la escena conserve su tiempo.
 *
 * Solo se controla el tiempo: la altura del vuelo la decide la curva por
 * defecto de `flyTo`, que en trayectos de miles de km se aleja hasta vista de
 * globo y vuelve a acercarse al aterrizar.
 */
function legDurationMs(scene: Scene, fromLng: number, fromLat: number): number | undefined {
  const km = distance(point([fromLng, fromLat]), point(scene.camera.center), {
    units: 'kilometers',
  })

  if (km < LOCAL_HOP_KM) return undefined

  const ratio = Math.min((km - LOCAL_HOP_KM) / (LONGEST_HOP_KM - LOCAL_HOP_KM), 1)
  return Math.round(MIN_FLIGHT_MS + (MAX_FLIGHT_MS - MIN_FLIGHT_MS) * ratio)
}

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
  /** Paradas del tour, ya en el orden del recorrido (las ordena MapView). */
  scenes: Scene[]
  /**
   * Mientras esté en true el dwell no dispara el avance automático: el tour
   * queda congelado en la ciudad actual hasta que la interacción termine — el
   * carrito llega a destino y el usuario cierra el ProjectPanel (ver MapView).
   */
  interactionLock?: boolean
}

/**
 * Recorrido guiado interrumpible: arranca solo al montar, se cancela con el
 * primer gesto del usuario y se retoma desde la escena más cercana a donde
 * haya quedado la cámara. Los controles manuales (atrás, adelante, menú de
 * ciudades) también lo pasan a modo libre.
 */
export default function TourControl({ map, scenes, interactionLock = false }: Props) {
  const [running, setRunning] = useState(false)
  /** Última parada a la que se voló, sea por el scheduler o a mano. */
  const [currentIndex, setCurrentIndex] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  /**
   * Las escenas se leen desde un ref para que el scheduler no dependa de la
   * identidad del array: Astro puede re-renderizar la isla sin cortar el tour.
   */
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes

  /** Espera a que aterrice el vuelo; al vencer arranca el dwell de la ciudad. */
  const flightTimerRef = useRef<number | null>(null)
  /** Espera en la ciudad. Es el único cancelable/reanudable por interactionLock. */
  const dwellTimerRef = useRef<number | null>(null)
  /** Lo que falta del dwell: se descuenta al pausar para no reiniciar los 20s. */
  const dwellRemainingRef = useRef(DWELL_MS)
  /** Momento en que se armó el dwell vigente, o null si está pausado. */
  const dwellStartedAtRef = useRef<number | null>(null)
  /** Escena a la que se saltará al vencer el dwell, o null si no hay avance en cola. */
  const pendingIndexRef = useRef<number | null>(null)
  /** El lock se lee desde un ref: los timers viven fuera del ciclo de render. */
  const lockRef = useRef(interactionLock)
  /** El paso del scheduler, para poder retomarlo desde el efecto del lock. */
  const stepRef = useRef<((index: number) => void) | null>(null)

  const manager = useMemo(() => new SceneManager(map), [map])

  const clearTimers = useCallback(() => {
    if (flightTimerRef.current !== null) {
      window.clearTimeout(flightTimerRef.current)
      flightTimerRef.current = null
    }
    if (dwellTimerRef.current !== null) {
      window.clearTimeout(dwellTimerRef.current)
      dwellTimerRef.current = null
    }
    dwellStartedAtRef.current = null
    pendingIndexRef.current = null
  }, [])

  const stop = useCallback(() => {
    clearTimers()
    setRunning(false)
  }, [clearTimers])

  /**
   * Arma la espera en la ciudad actual. Con el lock puesto no se programa nada:
   * el avance queda en cola con su tiempo restante y lo retoma el efecto del
   * lock cuando la interacción termina.
   */
  const armDwell = useCallback((nextIndex: number, remainingMs: number) => {
    pendingIndexRef.current = nextIndex
    dwellRemainingRef.current = remainingMs

    if (lockRef.current) {
      dwellStartedAtRef.current = null
      return
    }

    dwellStartedAtRef.current = Date.now()
    dwellTimerRef.current = window.setTimeout(() => {
      dwellTimerRef.current = null
      dwellStartedAtRef.current = null
      pendingIndexRef.current = null
      stepRef.current?.(nextIndex)
    }, remainingMs)
  }, [])

  /** Encadena las escenas desde fromIndex hasta la última: vuelo → dwell → vuelo. */
  const start = useCallback(
    (fromIndex: number) => {
      const tourScenes = scenesRef.current
      if (tourScenes.length === 0) return

      clearTimers()
      setRunning(true)

      const step = (index: number) => {
        const scene = tourScenes[index]

        // Se acabaron las escenas: el tour se apaga solo.
        if (!scene) {
          setRunning(false)
          return
        }

        // El tramo se mide desde donde está la cámara ahora, no desde la
        // escena anterior: así también sale bien al retomar el tour a mitad.
        const { lng, lat } = map.getCenter()
        const duration = legDurationMs(scene, lng, lat)

        manager.goTo(scene, { duration })
        setCurrentIndex(index)

        // El dwell se cuenta desde el aterrizaje, no desde el despegue.
        const flightMs = duration ?? scene.duration ?? DEFAULT_FLY_DURATION_MS
        flightTimerRef.current = window.setTimeout(() => {
          flightTimerRef.current = null
          armDwell(index + 1, DWELL_MS)
        }, flightMs)
      }

      stepRef.current = step
      step(fromIndex)
    },
    [armDwell, clearTimers, manager, map]
  )

  /** Salto manual a una parada: apaga el modo automático y vuela hasta ella. */
  const goToIndex = useCallback(
    (index: number) => {
      const scene = scenesRef.current[index]
      if (!scene) return

      stop()

      const { lng, lat } = map.getCenter()
      manager.goTo(scene, { duration: legDurationMs(scene, lng, lat) })
      setCurrentIndex(index)
    },
    [manager, map, stop]
  )

  // Al cargar, la cámara ejecuta el flythrough automático desde la primera escena.
  useEffect(() => {
    start(0)
    return stop
  }, [start, stop])

  /**
   * Pausa y reanudación del avance automático por interacción del usuario:
   * panel de proyecto abierto o carrito en movimiento (lo decide MapView).
   */
  useEffect(() => {
    lockRef.current = interactionLock

    if (interactionLock) {
      // Se congela lo que falte del dwell para retomarlo donde iba.
      if (dwellTimerRef.current !== null) {
        window.clearTimeout(dwellTimerRef.current)
        dwellTimerRef.current = null

        const startedAt = dwellStartedAtRef.current
        if (startedAt !== null) {
          dwellRemainingRef.current = Math.max(
            dwellRemainingRef.current - (Date.now() - startedAt),
            0
          )
          dwellStartedAtRef.current = null
        }
      }
      return
    }

    // Se soltó el lock: si había un avance en cola, se retoma con lo que faltaba.
    const pending = pendingIndexRef.current
    if (pending !== null && dwellTimerRef.current === null) {
      armDwell(pending, dwellRemainingRef.current)
    }
  }, [armDwell, interactionLock])

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

  // El menú flotante se cierra con Escape, como cualquier popover.
  useEffect(() => {
    if (!menuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  const handleToggle = () => {
    if (running) {
      map.stop()
      stop()
      return
    }

    // Se retoma desde la escena más cercana a donde quedó la cámara, no desde 0.
    const { lng, lat } = map.getCenter()
    start(nearestSceneIndex(scenesRef.current, lng, lat))
  }

  const handleSelect = (index: number) => {
    setMenuOpen(false)
    goToIndex(index)
  }

  const atFirst = currentIndex <= 0
  const atLast = currentIndex >= scenes.length - 1

  const stepButton =
    'flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-black/60'

  return (
    <div className="fixed right-6 bottom-16 z-20 flex items-center gap-2 sm:right-10">
      <button
        type="button"
        onClick={() => goToIndex(Math.max(currentIndex - 1, 0))}
        disabled={atFirst}
        aria-label="Ciudad anterior"
        title="Ciudad anterior"
        className={stepButton}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M14 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 text-sm font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/75"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
          Ciudades
        </button>

        {menuOpen && (
          <ul
            role="menu"
            aria-label="Ciudades del recorrido"
            className="animate-scene-in absolute right-0 bottom-full mb-2 min-w-44 overflow-hidden rounded-2xl border border-white/10 bg-black/80 py-1 text-sm text-white shadow-xl backdrop-blur-md"
          >
            {scenes.map((scene, index) => (
              <li key={scene.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(index)}
                  aria-current={index === currentIndex}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left transition hover:bg-white/10 ${
                    index === currentIndex ? 'text-white' : 'text-white/70'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${
                      index === currentIndex ? 'bg-white' : 'bg-white/25'
                    }`}
                  />
                  {scene.city ?? scene.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => goToIndex(Math.min(currentIndex + 1, scenes.length - 1))}
        disabled={atLast}
        aria-label="Ciudad siguiente"
        title="Ciudad siguiente"
        className={stepButton}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M10 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={handleToggle}
        aria-pressed={running}
        className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-5 text-sm font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/75"
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
    </div>
  )
}
