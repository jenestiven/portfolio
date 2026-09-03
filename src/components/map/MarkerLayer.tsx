import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Map } from 'mapbox-gl'
import type { Marker } from '../../types'

/**
 * Color del pin por tipo de contenido. `profile` todavía no existe en el
 * schema (llega con la escena de presentación de Cali), pero el color ya está
 * previsto para que el marcador no dependa de un sprint posterior.
 */
const PIN_COLORS: Record<string, string> = {
  software: '#38bdf8',
  geospatial: '#f97316',
  profile: '#a78bfa'
}

const PIN_FALLBACK_COLOR = '#71717a'

/** Clase con la que global.css oscurece el contenedor que pinta mapbox-gl. */
const POPUP_CLASS = 'portfolio-marker-popup'

/**
 * Imagen de la vista previa. Los campos que la traen — `previewImage` en los
 * marcadores de perfil, `images` en los de trabajo — entran al schema con el
 * contenido de los sprints siguientes: hasta entonces se leen de forma
 * tolerante y el popup se arma sin imagen en vez de romperse.
 */
function previewImageOf(detail: Marker['detail']): string | undefined {
  const source = detail as { previewImage?: unknown; images?: unknown }
  const kind: string = detail.kind

  if (kind === 'profile') {
    return typeof source.previewImage === 'string' && source.previewImage
      ? source.previewImage
      : undefined
  }

  const first = Array.isArray(source.images) ? source.images[0] : undefined
  return typeof first === 'string' && first ? first : undefined
}

/** Ícono del marcador: gota con el color del tipo y borde blanco. */
function createPinElement(detail: Marker['detail'], title: string): HTMLElement {
  const color = PIN_COLORS[detail.kind as string] ?? PIN_FALLBACK_COLOR

  const element = document.createElement('div')
  element.className = 'cursor-pointer drop-shadow-lg'
  element.setAttribute('aria-label', title)
  // SVG estático: el único dato que entra es el color, ya resuelto contra
  // PIN_COLORS, así que no hay contenido del usuario en este markup.
  element.innerHTML = `
    <svg width="28" height="38" viewBox="0 0 24 32" aria-hidden="true">
      <path
        d="M12 1c-6.1 0-11 4.9-11 11 0 8.2 11 19 11 19s11-10.8 11-19c0-6.1-4.9-11-11-11z"
        fill="${color}"
        stroke="#ffffff"
        stroke-width="1.8"
      />
      <circle cx="12" cy="12" r="4" fill="#ffffff" />
    </svg>
  `

  return element
}

/**
 * Contenido del popup. Se arma con nodos DOM (no innerHTML) porque el título
 * y la ruta de la imagen vienen del contenido de las escenas.
 */
function createPopupContent(marker: Marker, onSeeMore: () => void): HTMLElement {
  const container = document.createElement('div')
  container.className = 'flex w-56 flex-col gap-3 p-3 text-white'

  const image = previewImageOf(marker.detail)
  if (image) {
    const img = document.createElement('img')
    img.src = image
    img.alt = marker.title
    img.className = 'h-24 w-full rounded-lg border border-white/10 object-cover'
    // La imagen puede no estar subida todavía: si falla, el popup se queda
    // solo con el título y el botón en vez de mostrar el ícono roto.
    img.addEventListener('error', () => img.remove())
    container.append(img)
  }

  const title = document.createElement('h3')
  title.className = 'pr-4 text-sm leading-snug font-semibold'
  title.textContent = marker.title
  container.append(title)

  const button = document.createElement('button')
  button.type = 'button'
  button.className =
    'w-full rounded-full bg-white px-4 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-white/85'
  button.textContent = 'Ver más'
  button.addEventListener('click', onSeeMore)
  container.append(button)

  return container
}

type Props = {
  /** Instancia única de Mapbox, ya con el estilo cargado. */
  map: Map
  markers: Marker[]
  /** Viaje en carrito + apertura del panel. Solo lo dispara "Ver más". */
  onMarkerClick: (markerId: string) => void
}

export default function MarkerLayer({ map, markers, onMarkerClick }: Props) {
  /**
   * El callback se lee desde un ref para que los listeners de los popups no
   * haya que recrearlos: un cambio de identidad de onMarkerClick no debe
   * reconstruir los marcadores.
   */
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  // Los marcadores son elementos DOM, no una capa del estilo: se crean por
  // escena y se retiran al cambiar de escena o al desmontar.
  useEffect(() => {
    const instances = markers.map((marker) => {
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 34,
        maxWidth: 'none',
        className: POPUP_CLASS
      })

      const instance = new mapboxgl.Marker({
        element: createPinElement(marker.detail, marker.title),
        anchor: 'bottom'
      })
        .setLngLat(marker.coord)
        .setPopup(popup)
        .addTo(map)

      popup.setDOMContent(
        createPopupContent(marker, () => {
          // El popup se retira antes del viaje: la cámara se mueve y el
          // globo colgado del pin estorbaría el recorrido.
          popup.remove()
          onMarkerClickRef.current(marker.id)
        })
      )

      return instance
    })

    // remove() se lleva también el popup asociado, abierto o no.
    return () => instances.forEach((instance) => instance.remove())
  }, [map, markers])

  return null
}
