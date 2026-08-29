import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.PUBLIC_MAPBOX_TOKEN

export function initMap(containerId: string) {
    const map = new mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/standard',
        center: [-76.3, 3.76],
        zoom: 3,
    })

    map.addControl(new mapboxgl.NavigationControl())

    map.on('load', () => {
        // 1️⃣ Terrain 3D (DEM)
        map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.terrain-rgb',
            tileSize: 512,
            maxzoom: 14
        })

        map.setTerrain({
            source: 'mapbox-dem',
            exaggeration: 1.6
        })

        // 2️⃣ Source vectorial para curvas
        map.addSource('mapbox-terrain', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-terrain-v2'
        })

        // 3️⃣ Layer de curvas de nivel
        map.addLayer({
            id: 'contours',
            type: 'line',
            source: 'mapbox-terrain',
            'source-layer': 'contour',
            paint: {
                'line-color': '#6e5c3a',
                'line-width': [
                    'case',
                    ['==', ['%', ['get', 'ele'], 100], 0],
                    2,
                    0.8
                ]
            }
        })

        map.addSource('mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
        })

        map.addLayer({
            id: 'traffic',
            type: 'line',
            source: 'mapbox-traffic',
            'source-layer': 'traffic',
            "paint": {
                "line-width": 2.5,
                "line-color": [
                    "case",
                    [
                        "==",
                        "low",
                        [
                            "get",
                            "congestion"
                        ]
                    ],
                    "#aab7ef",
                    [
                        "==",
                        "moderate",
                        [
                            "get",
                            "congestion"
                        ]
                    ],
                    "#4264fb",
                    [
                        "==",
                        "heavy",
                        [
                            "get",
                            "congestion"
                        ]
                    ],
                    "#ee4e8b",
                    [
                        "==",
                        "severe",
                        [
                            "get",
                            "congestion"
                        ]
                    ],
                    "#b43b71",
                    "#000000"
                ]
            }
        })
    })
    return map
}
