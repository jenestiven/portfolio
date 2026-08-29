import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import distance from '@turf/distance'
import { point } from '@turf/helpers'
import { driveTo } from '../../lib/map/CartEngine'
import { initMap } from '../../lib/map/initMap'
import { useGeoEntry } from '../../lib/map/useGeoEntry'
import type { Scene } from '../../types'
import MarkerLayer from './MarkerLayer'
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

/** Escena contra la que se mide si el usuario está "en casa" (ver useGeoEntry). */
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
 * Etapas de la entrada. El tour no arranca hasta 'done': el `TourControl` se
 * monta al final de la secuencia, así su lógica interna sigue siendo
 * "arranco al montarme" sin saber nada del aterrizaje.
 */
type EntryPhase = 'idle' | 'flying' | 'welcome' | 'done'

/** Forma del gancho de consola que se publica solo en dev (ver efecto del mapa). */
type CartEngineDevHook = {
  driveTo: (origin: [number, number], destination: [number, number]) => Promise<void>
}

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

  const homeCenter =
    scenes.find((scene) => scene.id === HOME_SCENE_ID)?.camera.center ?? null
  const geoEntry = useGeoEntry(homeCenter)

  useEffect(() => {
    const map = initMap('map')

    map.on('load', () => {
      setMap(map)

      // Gancho de prueba manual del CartEngine (sprint 10): en la consola,
      // window.driveTo([lng, lat], [lng, lat]). El sprint 11 lo conecta al
      // menú de proyectos y a los markers, y este bloque se retira.
      if (import.meta.env.DEV) {
        ;(window as unknown as CartEngineDevHook).driveTo = (origin, destination) =>
          driveTo(map, origin, destination)
      }
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
   * Secuencia de entrada: vuelo al punto de aterrizaje → saludo → tour. Corre
   * una sola vez, cuando el mapa ya cargó y la geolocalización ya resolvió
   * (con posición real o con el fallback); `map` y `geoEntry` no vuelven a
   * cambiar después de eso.
   */
  useEffect(() => {
    if (!map || !geoEntry) return

    setEntryPhase('flying')
    map.flyTo({
      center: geoEntry.landingPoint,
      zoom: LANDING_ZOOM,
      pitch: LANDING_PITCH,
      bearing: LANDING_BEARING,
      duration: LANDING_FLY_MS,
      essential: true,
    })

    const toWelcome = window.setTimeout(() => setEntryPhase('welcome'), LANDING_FLY_MS)
    const toTour = window.setTimeout(
      () => setEntryPhase('done'),
      LANDING_FLY_MS + WELCOME_HOLD_MS
    )

    return () => {
      window.clearTimeout(toWelcome)
      window.clearTimeout(toTour)
    }
  }, [map, geoEntry])

  /**
   * Congela el avance automático del tour mientras el usuario está metido en
   * algo: hoy, con el ProjectPanel abierto.
   *
   * TODO: sprint 10 debe también setear interactionLock = true mientras el
   * carrito se mueve.
   */
  const interactionLock = selectedMarkerId !== null

  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? null
  /**
   * El marker se resuelve contra la escena activa: si cambia la escena, el
   * panel se cierra solo porque el id deja de encontrarse.
   */
  const selectedMarker =
    activeScene?.markers.find((marker) => marker.id === selectedMarkerId) ?? null

  return (
    <>
      <div id="map" className="h-full w-full" />
      {map && (
        <>
          <MarkerLayer
            map={map}
            markers={activeScene?.markers ?? NO_MARKERS}
            onMarkerClick={setSelectedMarkerId}
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
      {entryPhase === 'welcome' && geoEntry && (
        <WelcomeOverlay usedRealLocation={geoEntry.usedRealLocation} />
      )}
      {/* Ambos overlays comparten esquina: el de escena espera a que pase el saludo. */}
      <SceneOverlay activeScene={entryPhase === 'done' ? activeScene : null} />
    </>
  )
}
