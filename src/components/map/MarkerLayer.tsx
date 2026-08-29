import { useEffect, useRef } from 'react'
import type { GeoJSONSource, Map, MapMouseEvent } from 'mapbox-gl'
import type { Marker } from '../../types'

const SOURCE_ID = 'scene-markers'
const LAYER_ID = 'scene-markers'

/** Solo lo que la capa necesita del marker: la geometría y lo que va en properties. */
type MarkerFeature = {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: string; title: string; type: Marker['type'] }
}

type MarkerCollection = {
  type: 'FeatureCollection'
  features: MarkerFeature[]
}

function toFeatureCollection(markers: Marker[]): MarkerCollection {
  return {
    type: 'FeatureCollection',
    features: markers.map((marker) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: marker.coord },
      // El detail no viaja en properties: Mapbox serializa los valores y el
      // panel de detalle lo resuelve desde la escena por id.
      properties: { id: marker.id, title: marker.title, type: marker.type }
    }))
  }
}

type Props = {
  /** Instancia única de Mapbox, ya con el estilo cargado. */
  map: Map
  markers: Marker[]
  onMarkerClick: (markerId: string) => void
}

export default function MarkerLayer({ map, markers, onMarkerClick }: Props) {
  /**
   * El callback se lee desde un ref para que los listeners se registren una
   * sola vez: un cambio de identidad de onMarkerClick no debe re-suscribir.
   */
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  // Alta de la capa y de los listeners: corre solo al montar (o si cambia el mapa).
  useEffect(() => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: toFeatureCollection([])
      })
    }

    if (!map.getLayer(LAYER_ID)) {
      map.addLayer({
        id: LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 7,
          'circle-color': [
            'case',
            ['==', ['get', 'type'], 'software'],
            '#3f3f46',
            ['==', ['get', 'type'], 'geospatial'],
            '#a8a29e',
            '#71717a'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      })
    }

    const handleClick = (event: MapMouseEvent) => {
      const feature = event.features?.[0]
      const markerId = feature?.properties?.id
      if (typeof markerId === 'string') onMarkerClickRef.current(markerId)
    }

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer'
    }

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = ''
    }

    map.on('click', LAYER_ID, handleClick)
    map.on('mouseenter', LAYER_ID, handleMouseEnter)
    map.on('mouseleave', LAYER_ID, handleMouseLeave)

    return () => {
      map.off('click', LAYER_ID, handleClick)
      map.off('mouseenter', LAYER_ID, handleMouseEnter)
      map.off('mouseleave', LAYER_ID, handleMouseLeave)

      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
  }, [map])

  // Cambio de escena: se actualiza la data de la source, no se recrea la capa.
  useEffect(() => {
    const source = map.getSource<GeoJSONSource>(SOURCE_ID)
    if (!source) return
    source.setData(toFeatureCollection(markers))
  }, [map, markers])

  return null
}
