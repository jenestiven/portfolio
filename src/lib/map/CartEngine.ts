import mapboxgl from 'mapbox-gl'
import type { Map } from 'mapbox-gl'
import along from '@turf/along'
import bearing from '@turf/bearing'
import length from '@turf/length'
import lineSliceAlong from '@turf/line-slice-along'
import { lineString } from '@turf/helpers'

/**
 * Motor de recorrido del "carrito": anima un trayecto por calles reales entre
 * dos puntos de una misma ciudad, dibujando la ruta (azul lo que falta, gris lo
 * ya recorrido) con la cámara siguiendo el avance.
 *
 * Es deliberadamente agnóstico de React y de quién lo dispara: el sprint 11 lo
 * usa tanto desde el menú de proyectos como desde el clic directo en un marker.
 */

/**
 * Duración fija del recorrido. La velocidad es artística, no realista: da igual
 * si la ruta mide 200 m o 3 km, el viaje siempre dura lo mismo para que la
 * navegación se sienta ágil.
 */
export const DRIVE_DURATION_MS = 6000

/** Encuadre "vista de conductor" que se mantiene durante todo el trayecto. */
const DRIVE_ZOOM = 19
const DRIVE_PITCH = 60

/**
 * Distancia (km) que se mira hacia adelante sobre la ruta para calcular el
 * rumbo. Muy corta y el bearing tiembla entre vértices; muy larga y la cámara
 * anticipa curvas que aún no llegan.
 */
const BEARING_LOOKAHEAD_KM = 0.015

const DIRECTIONS_PROFILE = 'walking'

/** Ruta por recorrer (azul) y ya recorrida (gris). Un id sirve de source y de layer. */
const REMAINING_ID = 'route-remaining'
const TRAVELED_ID = 'route-traveled'
const REMAINING_COLOR = '#3B82F6'
const TRAVELED_COLOR = '#9CA3AF'
const ROUTE_WIDTH = 8

const CAR_ICON_SIZE_PX = 64

/**
 * El SVG viene dibujado en perspectiva isométrica con el frente hacia la
 * esquina inferior derecha (~120°). Este offset lo compensa para que un rumbo
 * de 0° deje el carro apuntando hacia arriba en pantalla.
 */
const CAR_ICON_HEADING_OFFSET_DEG = 0

type RouteLine = ReturnType<typeof lineString>
type LngLat = [number, number]

/**
 * Marker único del carrito: se crea la primera vez y queda estacionado en el
 * destino entre recorridos, así el usuario ve dónde "dejó" el carrito.
 */
let cartMarker: mapboxgl.Marker | null = null
/** El <img> interno, que es el que rota; al contenedor lo posiciona Mapbox. */
let cartIcon: HTMLElement | null = null

/**
 * Identifica el recorrido en curso. Si llega un `driveTo` nuevo mientras otro
 * anima, el viejo ve que el id cambió y abandona el rAF sin pelear por la
 * cámara ni por las layers (su promesa igual resuelve, para no dejar colgado a
 * quien lo esperaba).
 */
let currentDriveId = 0

function createCartElement(): HTMLElement {
  const element = document.createElement('div')
  const icon = document.createElement('img')

  icon.src = '/icons/car.svg'
  icon.alt = ''
  icon.style.width = `${CAR_ICON_SIZE_PX}px`
  icon.style.height = `${CAR_ICON_SIZE_PX}px`
  // El giro es sobre el propio eje del carro, no sobre una esquina.
  icon.style.transformOrigin = 'center'
  icon.style.display = 'block'

  element.appendChild(icon)
  cartIcon = icon

  return element
}

function getCartMarker(map: Map, position: LngLat): mapboxgl.Marker {
  if (!cartMarker) {
    cartMarker = new mapboxgl.Marker({ element: createCartElement() })
  }

  cartMarker.setLngLat(position)

  // addTo es idempotente sobre el mismo mapa: reubica el marker si ya estaba.
  return cartMarker.addTo(map)
}

/**
 * Orienta el ícono. Al rumbo se le descuenta el bearing de la cámara porque el
 * mapa ya gira con el recorrido: lo que se aplica al <img> es el ángulo que
 * queda en pantalla, no el rumbo absoluto.
 */
function pointCartTo(map: Map, headingDeg: number) {
  if (!cartIcon) return

  const screenAngle = headingDeg - map.getBearing() + CAR_ICON_HEADING_OFFSET_DEG
  cartIcon.style.transform = `rotate(${screenAngle}deg)`
}

/** Quita el carrito del mapa (por si una escena necesita limpiarlo). */
export function removeCart() {
  cartMarker?.remove()
  cartMarker = null
  cartIcon = null
}

/** Línea degenerada: GeoJSON válido que no pinta nada (tramo de longitud cero). */
function emptyLineAt(point: LngLat): RouteLine {
  return lineString([point, point])
}

function setRouteData(map: Map, id: string, line: RouteLine) {
  const source = map.getSource(id)
  if (source && source.type === 'geojson') source.setData(line)
}

function addRouteLayers(map: Map, route: RouteLine) {
  removeRouteLayers(map)

  const start = route.geometry.coordinates[0] as LngLat

  for (const [id, color, data] of [
    [REMAINING_ID, REMAINING_COLOR, route],
    [TRAVELED_ID, TRAVELED_COLOR, emptyLineAt(start)],
  ] as const) {
    map.addSource(id, { type: 'geojson', data })
    map.addLayer({
      id,
      type: 'line',
      source: id,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': ROUTE_WIDTH },
    })
  }
}

/** Deja el mapa limpio para el próximo viaje: sin restos de la ruta anterior. */
function removeRouteLayers(map: Map) {
  for (const id of [REMAINING_ID, TRAVELED_ID]) {
    if (map.getLayer(id)) map.removeLayer(id)
    if (map.getSource(id)) map.removeSource(id)
  }
}

/**
 * Pide la ruta peatonal real a la Directions API. Devuelve `null` ante
 * cualquier problema (red, token, puntos inalcanzables a pie) para que el
 * llamador caiga al trazo recto en vez de romper la experiencia.
 */
async function fetchWalkingRoute(origin: LngLat, destination: LngLat): Promise<RouteLine | null> {
  const token = import.meta.env.PUBLIC_MAPBOX_TOKEN
  const coordinates = `${origin.join(',')};${destination.join(',')}`
  const url = `https://api.mapbox.com/directions/v5/mapbox/${DIRECTIONS_PROFILE}/${coordinates}?geometries=geojson&access_token=${token}`

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()
    const geometry = data?.routes?.[0]?.geometry

    if (geometry?.type !== 'LineString' || geometry.coordinates?.length < 2) return null

    return lineString(geometry.coordinates)
  } catch {
    return null
  }
}

/**
 * Lleva la cámara (y el carrito) de `origin` a `destination` siguiendo la ruta
 * peatonal real, o una línea recta si la Directions API no responde. Mientras
 * viaja, la ruta se ve como una línea azul que se acorta y una gris que crece.
 *
 * La promesa resuelve cuando la animación termina — quien la espera puede
 * entonces abrir el panel del proyecto de destino.
 */
export async function driveTo(map: Map, origin: LngLat, destination: LngLat): Promise<void> {
  const driveId = ++currentDriveId

  const route = (await fetchWalkingRoute(origin, destination)) ?? lineString([origin, destination])

  // Otro recorrido arrancó mientras se resolvía la ruta: este ya no manda.
  if (driveId !== currentDriveId) return

  const totalKm = length(route, { units: 'kilometers' })

  const pointAt = (km: number): LngLat =>
    along(route, Math.min(Math.max(km, 0), totalKm), { units: 'kilometers' }).geometry
      .coordinates as LngLat

  // Origen y destino coinciden (o la ruta es degenerada): no hay nada que
  // recorrer, solo se planta el carrito y se encuadra el destino.
  if (totalKm === 0) {
    getCartMarker(map, destination)
    map.easeTo({ center: destination, pitch: DRIVE_PITCH, zoom: DRIVE_ZOOM, duration: 0 })
    return
  }

  const marker = getCartMarker(map, pointAt(0))
  addRouteLayers(map, route)

  return new Promise<void>((resolve) => {
    const startedAt = performance.now()
    // Se conserva el último rumbo válido: al final de la ruta el punto de
    // referencia adelantado colapsa sobre el actual y el bearing sería 0.
    let lastBearing = map.getBearing()

    const step = () => {
      if (driveId !== currentDriveId) {
        resolve()
        return
      }

      const elapsed = performance.now() - startedAt
      const progress = Math.min(elapsed / DRIVE_DURATION_MS, 1)
      const traveledKm = progress * totalKm

      const current = pointAt(traveledKm)
      const ahead = pointAt(traveledKm + BEARING_LOOKAHEAD_KM)

      if (ahead[0] !== current[0] || ahead[1] !== current[1]) {
        lastBearing = bearing(current, ahead)
      }

      marker.setLngLat(current)
      // duration: 0 = salto inmediato de frame a frame; la suavidad la da la
      // interpolación de turf/along, no el easing de Mapbox.
      map.easeTo({
        center: current,
        bearing: lastBearing,
        pitch: DRIVE_PITCH,
        zoom: DRIVE_ZOOM,
        duration: 0,
      })
      // Después del easeTo, para que el descuento use el bearing ya aplicado.
      pointCartTo(map, lastBearing)

      setRouteData(
        map,
        TRAVELED_ID,
        traveledKm > 0 ? lineSliceAlong(route, 0, traveledKm) : emptyLineAt(current)
      )
      setRouteData(
        map,
        REMAINING_ID,
        traveledKm < totalKm ? lineSliceAlong(route, traveledKm, totalKm) : emptyLineAt(current)
      )

      if (progress >= 1) {
        // Se limpia el mapa para el próximo viaje; el carrito queda estacionado.
        removeRouteLayers(map)
        resolve()
        return
      }

      requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  })
}
