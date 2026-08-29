import { useEffect, useMemo, useRef, useState } from 'react'
import type { Map } from 'mapbox-gl'
import distance from '@turf/distance'
import { point } from '@turf/helpers'
import { initMap } from '../../lib/map/initMap'
import type { Scene } from '../../types'
import MarkerLayer from './MarkerLayer'
import ProjectPanel from './ProjectPanel'
import SceneOverlay from './SceneOverlay'
import TourControl from './TourControl'

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

  useEffect(() => {
    const map = initMap('map')

    map.on('load', () => setMap(map))

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
          <TourControl map={map} scenes={tourScenes} />
        </>
      )}
      <SceneOverlay activeScene={activeScene} />
    </>
  )
}
