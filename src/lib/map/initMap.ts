import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.PUBLIC_MAPBOX_TOKEN

export function initMap(containerId: string) {
    // Mapbox Standard ya trae terreno 3D, edificios y landmarks de fábrica:
    // no se añaden DEM, curvas de nivel ni tráfico propios (esos tilesets
    // además no cubren el globo y devolvían 404 fuera de Colombia).
    const map = new mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/standard',
        center: [-76.3, 3.76],
        zoom: 3,
    })

    map.addControl(new mapboxgl.NavigationControl())

    return map
}
