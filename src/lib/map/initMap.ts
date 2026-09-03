import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.PUBLIC_MAPBOX_TOKEN

/**
 * Cámara con la que abre el portafolio: el planeta visto de lejos, con
 * Colombia al centro y espacio alrededor para que el Hero respire encima.
 * El recorrido no arranca aquí — espera al clic del CTA (ver `startJourney`
 * en MapView).
 */
export const HERO_CAMERA = {
    center: [-76, 4] as [number, number],
    zoom: 3,
    pitch: 40,
    bearing: 0,
}

/**
 * Atmósfera del Hero. `star-intensity` es lo que dibuja el campo de estrellas
 * detrás del globo: Standard no lo trae encendido de fábrica, y por debajo de
 * ~0.4 el fondo se ve plano contra el negro del espacio.
 */
const HERO_FOG = {
    'star-intensity': 0.55,
    'space-color': '#01030a',
    'horizon-blend': 0.02,
} as const

export function initMap(containerId: string) {
    // Mapbox Standard ya trae terreno 3D, edificios y landmarks de fábrica:
    // no se añaden DEM, curvas de nivel ni tráfico propios (esos tilesets
    // además no cubren el globo y devolvían 404 fuera de Colombia).
    const map = new mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/standard',
        projection: 'globe',
        ...HERO_CAMERA,
    })

    // El fog se pierde si el estilo se recarga, así que se reaplica en cada
    // 'style.load' en vez de una sola vez tras el 'load' inicial.
    map.on('style.load', () => {
        map.setFog(HERO_FOG)
    })

    map.addControl(new mapboxgl.NavigationControl())

    return map
}
