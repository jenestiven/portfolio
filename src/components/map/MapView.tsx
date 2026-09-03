import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import distance from '@turf/distance'
import { point } from '@turf/helpers'
import { driveTo } from '../../lib/map/CartEngine'
import { resolveGeoEntry, type GeoEntry } from '../../lib/map/geoEntry'
import { initMap } from '../../lib/map/initMap'
import type { Scene } from '../../types'
import HeroSection from '../hero/HeroSection'
import MarkerLayer from './MarkerLayer'
import ProjectMenu from './ProjectMenu'
import ProjectPanel from './ProjectPanel'
import SceneOverlay from './SceneOverlay'
import TourControl from './TourControl'
import WelcomeOverlay from './WelcomeOverlay'

type Props = {
  scenes: Scene[]
}

/** Referencia estable para las escenas sin markers (evita setData en cada render). */
const NO_MARKERS: Scene['markers'] = []

/**
 * Paradas del tour guiado, en orden. Es la fuente de verdad del recorrido:
 * el orden no depende del glob de la Content Collection.
 */
const TOUR_ORDER = ['cali', 'london', 'tokyo'] as const

/** Escena contra la que se mide si el usuario está "en casa" (ver geoEntry.ts). */
const HOME_SCENE_ID = 'cali'

/** Encuadre del aterrizaje: calle a la vista, cámara inclinada. */
const LANDING_ZOOM = 15
const LANDING_PITCH = 60
const LANDING_BEARING = 0
/** Vuelo cinematográfico desde la vista de globo con la que carga el mapa. */
const LANDING_FLY_MS = 5000
/** Tiempo que el saludo queda en pantalla antes de ceder el paso al tour. */
const WELCOME_HOLD_MS = 3500

/**
 * Etapas de la entrada. En 'idle' el mapa se queda en la vista de planeta con
 * el Hero encima: nada se mueve hasta que el usuario pulsa el CTA. El tour no
 * arranca hasta 'done', porque el `TourControl` se monta al final de la
 * secuencia y su lógica interna sigue siendo "arranco al montarme" sin saber
 * nada del aterrizaje.
 */
type EntryPhase = 'idle' | 'flying' | 'welcome' | 'done'

/**
 * Dónde quedó estacionado el carrito en cada ciudad. Es la memoria del
 * recorrido: el próximo viaje dentro de esa ciudad parte de ahí y no del
 * centro de la escena.
 */
type CartPositionByScene = Record<string, [number, number] | null>

export default function MapView({ scenes }: Props) {
  /**
   * Las escenas se leen desde un ref para que el efecto del mapa corra una
   * sola vez: la instancia se monta al inicio y no se reinicializa aunque
   * Astro vuelva a renderizar la isla con un array nuevo.
   */
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes

  /**
   * La escena activa la decide la posición de la cámara, no el scroll: se
   * recalcula en cada 'moveend' por distancia al centro de cada ciudad.
   */
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  /**
   * Se publica el mapa como estado solo después del 'load' para que los hijos
   * (MarkerLayer) puedan añadir sources/layers sobre un estilo ya cargado.
   */
  const [map, setMap] = useState<Map | null>(null)
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null)
  const [entryPhase, setEntryPhase] = useState<EntryPhase>('idle')
  /** Se resuelve al pulsar el CTA, no al montar (ver `startJourney`). */
  const [geoEntry, setGeoEntry] = useState<GeoEntry | null>(null)
  /** El Hero se desmonta cuando termina su fade, no al hacer clic. */
  const [heroDismissed, setHeroDismissed] = useState(false)

  /** Carrito en movimiento: congela el tour igual que el panel abierto. */
  const [driving, setDriving] = useState(false)
  const [cartPositionByScene, setCartPositionByScene] = useState<CartPositionByScene>({})
  /**
   * Espejo del estado anterior: el handler del viaje lo lee y lo escribe fuera
   * del ciclo de render (antes y después del await del recorrido), así dos
   * viajes seguidos no se pisan con un valor viejo capturado en la clausura.
   */
  const cartPositionRef = useRef<CartPositionByScene>({})
  /**
   * Identifica el viaje en curso. Si el usuario elige otro proyecto a mitad de
   * camino, el viaje viejo ve que el token cambió y se retira sin abrir su
   * panel ni sobrescribir la posición del carrito.
   */
  const driveTokenRef = useRef(0)

  /**
   * Solo las escenas de TOUR_ORDER entran al recorrido, y en ese orden. Una
   * escena nueva en la colección aparece en el mapa pero no en el tour hasta
   * que se la agregue aquí explícitamente.
   */
  const tourScenes = useMemo(
    () =>
      TOUR_ORDER.map((id) => scenes.find((scene) => scene.id === id)).filter(
        (scene): scene is Scene => scene !== undefined
      ),
    [scenes]
  )

  /**
   * El centro de "casa" se lee desde un ref: `startJourney` corre una sola vez
   * por sesión y solo le importa el valor vigente en ese momento, no el de
   * cada render.
   */
  const homeCenterRef = useRef<[number, number] | null>(null)
  homeCenterRef.current =
    scenes.find((scene) => scene.id === HOME_SCENE_ID)?.camera.center ?? null

  /** Timers de la secuencia de entrada, para poder cancelarlos al desmontar. */
  const entryTimersRef = useRef<number[]>([])
  /** El recorrido se arranca una sola vez, por más veces que se pulse el CTA. */
  const journeyStartedRef = useRef(false)

  useEffect(() => {
    const map = initMap('map')

    map.on('load', () => {
      setMap(map)
    })

    const handleMoveEnd = () => {
      const { lng, lat } = map.getCenter()
      const cameraCenter = point([lng, lat])
      const match = scenesRef.current.find(
        (scene) =>
          distance(cameraCenter, point(scene.camera.center), { units: 'kilometers' }) <
          scene.radiusKm
      )

      // Sin coincidencia se conserva la última escena conocida: en tránsito
      // entre ciudades el overlay no debe parpadear a vacío.
      if (match) setActiveSceneId(match.id)
    }

    map.on('moveend', handleMoveEnd)

    return () => {
      setMap(null)
      map.off('moveend', handleMoveEnd)
      map.remove()
    }
  }, [])

  /**
   * Secuencia de entrada: geolocalización → vuelo al punto de aterrizaje →
   * saludo → tour. Ya no corre al montar: la dispara el CTA del Hero, así el
   * prompt de permisos del navegador llega tras un gesto del usuario y el mapa
   * puede quedarse en la vista de planeta mientras tanto.
   */
  const startJourney = useCallback(async () => {
    if (!map || journeyStartedRef.current) return
    journeyStartedRef.current = true

    setEntryPhase('flying')

    // Puede tardar hasta el timeout del GPS; mientras tanto el mapa sigue en
    // la vista de planeta y el Hero termina su fade.
    const entry = await resolveGeoEntry(homeCenterRef.current)
    setGeoEntry(entry)

    map.flyTo({
      center: entry.landingPoint,
      zoom: LANDING_ZOOM,
      pitch: LANDING_PITCH,
      bearing: LANDING_BEARING,
      duration: LANDING_FLY_MS,
      essential: true,
    })

    entryTimersRef.current.push(
      window.setTimeout(() => setEntryPhase('welcome'), LANDING_FLY_MS),
      window.setTimeout(() => setEntryPhase('done'), LANDING_FLY_MS + WELCOME_HOLD_MS)
    )
  }, [map])

  useEffect(
    () => () => {
      entryTimersRef.current.forEach(window.clearTimeout)
    },
    []
  )

  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? null

  /**
   * Única puerta de entrada a un proyecto, venga del menú o del clic directo
   * sobre el marker: siempre se viaja en carrito hasta él y el panel se abre
   * al llegar.
   */
  const handleSelectProject = useCallback(
    async (markerId: string) => {
      if (!map || !activeScene) return

      const marker = activeScene.markers.find((marker) => marker.id === markerId)
      if (!marker) return

      // La ciudad se fija al arrancar: durante el viaje la cámara se mueve y
      // activeSceneId podría recalcularse, pero el carrito pertenece a la
      // ciudad desde la que partió.
      const sceneId = activeScene.id
      const origin = cartPositionRef.current[sceneId] ?? activeScene.camera.center
      const token = ++driveTokenRef.current

      setDriving(true)

      await driveTo(map, origin, marker.coord)

      // Otro proyecto tomó el volante mientras este viajaba.
      if (token !== driveTokenRef.current) return

      cartPositionRef.current[sceneId] = marker.coord
      setCartPositionByScene((positions) => ({ ...positions, [sceneId]: marker.coord }))
      // El lock no se suelta al bajar driving: lo sostiene el panel recién
      // abierto hasta que el usuario lo cierre.
      setSelectedMarkerId(markerId)
      setDriving(false)
    },
    [activeScene, map]
  )

  /**
   * Congela el avance automático del tour mientras el usuario está metido en
   * algo: con el ProjectPanel abierto o con el carrito en movimiento.
   */
  const interactionLock = driving || selectedMarkerId !== null

  /**
   * El marker se resuelve contra la escena activa: si cambia la escena, el
   * panel se cierra solo porque el id deja de encontrarse.
   */
  const selectedMarker =
    activeScene?.markers.find((marker) => marker.id === selectedMarkerId) ?? null

  /**
   * Proyecto donde quedó estacionado el carrito en esta ciudad — el punto de
   * partida del próximo viaje. El menú lo marca para que el usuario vea desde
   * dónde va a salir, incluso con el panel ya cerrado.
   */
  const cartPosition = (activeSceneId && cartPositionByScene[activeSceneId]) || null
  const cartAtMarkerId =
    activeScene?.markers.find(
      (marker) =>
        cartPosition !== null &&
        marker.coord[0] === cartPosition[0] &&
        marker.coord[1] === cartPosition[1]
    )?.id ?? null

  return (
    <>
      <div id="map" className="h-full w-full" />
      {map && (
        <>
          <MarkerLayer
            map={map}
            markers={activeScene?.markers ?? NO_MARKERS}
            onMarkerClick={handleSelectProject}
          />
          <ProjectPanel
            map={map}
            marker={selectedMarker}
            onClose={() => setSelectedMarkerId(null)}
          />
          {/* El tour arranca al montarse este componente: se monta al terminar la entrada. */}
          {entryPhase === 'done' && (
            <TourControl map={map} scenes={tourScenes} interactionLock={interactionLock} />
          )}
        </>
      )}
      {!heroDismissed && (
        <HeroSection
          onStart={startJourney}
          onDismissed={() => setHeroDismissed(true)}
          disabled={!map}
        />
      )}
      {entryPhase === 'welcome' && geoEntry && (
        <WelcomeOverlay usedRealLocation={geoEntry.usedRealLocation} />
      )}
      {/* Ambos overlays comparten esquina: el de escena espera a que pase el saludo. */}
      <SceneOverlay activeScene={entryPhase === 'done' ? activeScene : null} />
      {entryPhase === 'done' && (
        <ProjectMenu
          scene={activeScene}
          onSelectProject={handleSelectProject}
          cartAtMarkerId={cartAtMarkerId}
        />
      )}
    </>
  )
}
