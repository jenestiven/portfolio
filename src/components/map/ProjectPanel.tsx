import { useEffect, useState } from 'react'
import type { Map } from 'mapbox-gl'
import ImageCarousel from '../ui/ImageCarousel'
import ResponsiveModal from '../ui/ResponsiveModal'
import type {
  GeospatialDetail,
  Marker,
  ProfileDetail,
  SoftwareDetail,
  WorkDetail
} from '../../types'

type Props = {
  /** Instancia única de Mapbox, ya con el estilo cargado. */
  map: Map
  /** Marker seleccionado, o null si no hay panel abierto. */
  marker: Marker | null
  onClose: () => void
}

/** Etiqueta del encabezado según el tipo de contenido del marcador. */
const KIND_LABELS: Record<Marker['detail']['kind'], string> = {
  software: 'Software',
  geospatial: 'Geoespacial',
  profile: 'Presentación'
}

/**
 * El detalle de un proyecto dentro del `ResponsiveModal` compartido: modal
 * centrado en desktop, drawer en móvil. El fondo, el botón de cierre, Escape y
 * las transiciones viven allí — aquí solo queda el contenido.
 */
export default function ProjectPanel({ map, marker, onClose }: Props) {
  // Se recuerda el último marker para que el contenido siga en pantalla
  // mientras corre la animación de salida, ya que al cerrar `marker` es null.
  const [lastMarker, setLastMarker] = useState(marker)

  useEffect(() => {
    if (marker) setLastMarker(marker)
  }, [marker])

  const shown = marker ?? lastMarker

  return (
    <ResponsiveModal isOpen={marker !== null} onClose={onClose} label={shown?.title}>
      {/*
       * `key` por marker: así los hooks del contenido (toggle de capa, estados
       * de imagen) se reinician al cambiar de proyecto y el panel no arrastra
       * estado del marcador anterior.
       */}
      {shown && <PanelContent key={shown.id} map={map} marker={shown} />}
    </ResponsiveModal>
  )
}

function PanelContent({ map, marker }: { map: Map; marker: Marker }) {
  const detail = marker.detail

  return (
    <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10">
      <header className="pr-12">
        <span className="text-xs tracking-[0.2em] text-white/40 uppercase">
          {KIND_LABELS[detail.kind]}
        </span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{marker.title}</h2>
        {detail.kind !== 'profile' && <WorkHeader detail={detail} />}
      </header>

      {detail.kind === 'software' && <SoftwareBody detail={detail} title={marker.title} />}
      {detail.kind === 'geospatial' && (
        <GeospatialBody map={map} markerId={marker.id} detail={detail} title={marker.title} />
      )}
      {detail.kind === 'profile' && <ProfileBody detail={detail} />}

      {detail.kind !== 'profile' && <WorkLinks detail={detail} />}
    </div>
  )
}

/**
 * Cabecera al estilo de una tarjeta de experiencia de LinkedIn: el cargo en
 * grande y, debajo y más pequeño, la empresa junto a su ubicación.
 */
function WorkHeader({ detail }: { detail: WorkDetail }) {
  return (
    <div className="mt-4 border-l-2 border-white/15 pl-3">
      <p className="text-base font-medium text-white sm:text-lg">{detail.role}</p>
      <p className="mt-0.5 text-sm text-white/55">
        {detail.company}
        <span aria-hidden="true"> · </span>
        {detail.companyLocation}
      </p>
    </div>
  )
}

/**
 * Material de apoyo del proyecto: el video si existe y, si no, el carrusel de
 * imágenes. Sin ninguno de los dos no renderiza nada — el layout es un
 * flex-col con gap, así que la sección simplemente no ocupa lugar.
 */
function WorkMedia({ detail, title }: { detail: WorkDetail; title: string }) {
  // El video vive en /public y puede no estar subido todavía: si no carga se
  // cae al carrusel, igual que si nunca hubiera habido videoUrl.
  const [videoFailed, setVideoFailed] = useState(false)

  if (detail.videoUrl && !videoFailed) {
    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
        <video
          src={detail.videoUrl}
          onError={() => setVideoFailed(true)}
          className="aspect-video w-full bg-black object-cover"
          controls
          loop
          muted
          autoPlay
          playsInline
        />
      </div>
    )
  }

  return <ImageCarousel images={detail.images ?? []} alt={`Imagen de ${title}`} />
}

/** Redes soportadas por `socialLinks`, en el orden en que se muestran. */
const SOCIAL_ORDER = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'github', label: 'GitHub' },
  { key: 'website', label: 'Sitio web' }
] as const

/**
 * Pie del panel: las redes que traiga el proyecto y el botón de demo. Si no
 * hay ninguno de los dos, no se renderiza el bloque ni su separador.
 */
function WorkLinks({ detail }: { detail: WorkDetail }) {
  const social = detail.socialLinks
  const links = SOCIAL_ORDER.map((entry) => ({ ...entry, href: social?.[entry.key] })).filter(
    (link): link is (typeof SOCIAL_ORDER)[number] & { href: string } => Boolean(link.href)
  )

  if (links.length === 0 && !detail.demoUrl) return null

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
      {detail.demoUrl && (
        <a
          href={detail.demoUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/85"
        >
          Ver demo
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}

      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={link.label}
          title={link.label}
          className="rounded-full border border-white/15 bg-white/5 p-2.5 text-white/70 transition hover:bg-white/15 hover:text-white"
        >
          <SocialIcon name={link.key} />
        </a>
      ))}
    </div>
  )
}

function SocialIcon({ name }: { name: (typeof SOCIAL_ORDER)[number]['key'] }) {
  if (name === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.76-1.95C21.4 8.75 22 11 22 14.2V21h-4v-6c0-1.6-.03-3.65-2.25-3.65-2.25 0-2.6 1.73-2.6 3.53V21h-4z" />
      </svg>
    )
  }

  if (name === 'github') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0012 2z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Badges de tecnologías. Lo comparten el stack de los proyectos de software
 * y las `skills` del marcador de perfil: un solo lugar donde vive el estilo.
 */
function TagBadges({ items }: { items: string[] }) {
  if (items.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

function SoftwareBody({ detail, title }: { detail: SoftwareDetail; title: string }) {
  return (
    <>
      <WorkMedia detail={detail} title={title} />

      <p className="text-sm leading-relaxed text-white/80 sm:text-base">{detail.description}</p>

      <TagBadges items={detail.stack} />
    </>
  )
}

type GeospatialBodyProps = {
  map: Map
  markerId: string
  title: string
  detail: GeospatialDetail
}

function GeospatialBody({ map, markerId, title, detail }: GeospatialBodyProps) {
  const [layerEnabled, setLayerEnabled] = useState(false)
  // El diagrama vive en /public y puede no estar generado todavía: si no
  // carga se muestra un bloque neutro en vez del ícono de imagen rota.
  const [diagramFailed, setDiagramFailed] = useState(false)
  const liveLayer = detail.liveLayer

  // La capa se monta/desmonta con el toggle; el cleanup también corre al
  // cerrar el panel o cambiar de marker, así el mapa nunca queda sucio.
  useEffect(() => {
    if (!liveLayer || !layerEnabled) return

    const sourceId = `live-layer-${markerId}`
    const layerId = sourceId

    if (liveLayer.layerType === 'raster') {
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [liveLayer.sourceUrl],
        tileSize: 256
      })
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: { 'raster-opacity': 0.75 }
      })
    } else {
      // El schema no lleva `source-layer`, así que una fuente vectorial de
      // teselas no se puede pintar de forma genérica: se trata el sourceUrl
      // como GeoJSON servido por URL (caso tesis Siloé).
      map.addSource(sourceId, { type: 'geojson', data: liveLayer.sourceUrl })
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#f97316',
          'fill-opacity': 0.45,
          'fill-outline-color': '#fdba74'
        }
      })
    }

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [map, markerId, layerEnabled, liveLayer?.sourceUrl, liveLayer?.layerType])

  return (
    <>
      <WorkMedia detail={detail} title={title} />

      <p className="text-sm leading-relaxed text-white/80 sm:text-base">{detail.description}</p>

      {diagramFailed ? (
        <div className="flex aspect-[16/5] w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-white/50">
          Diagrama próximamente
        </div>
      ) : (
        <img
          src={detail.diagramAsset}
          alt={`Diagrama de metodología — ${title}`}
          onError={() => setDiagramFailed(true)}
          className="w-full rounded-xl border border-white/10 bg-white/5"
        />
      )}

      <p className="text-sm leading-relaxed whitespace-pre-line text-white/70">{detail.methodologyText}</p>

      {liveLayer && (
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-sm text-white/80">Ver capa sobre el mapa</span>
          <input
            type="checkbox"
            checked={layerEnabled}
            onChange={(event) => setLayerEnabled(event.target.checked)}
            className="h-4 w-4 accent-orange-400"
          />
        </label>
      )}
    </>
  )
}

/**
 * Marcadores de presentación (escena Cali). Dos formas según el `subtype`:
 * 'skills' muestra las tecnologías como badges — los mismos de un proyecto de
 * software — y el resto ('education', 'about', 'interests') muestra la imagen
 * grande con el texto debajo.
 */
function ProfileBody({ detail }: { detail: ProfileDetail }) {
  // Las fotos viven en /public y llegan en el sprint de contenido: hasta
  // entonces se cae a un bloque neutro en vez del ícono de imagen rota.
  const [imageFailed, setImageFailed] = useState(false)
  const isSkills = detail.subtype === 'skills'

  return (
    <>
      {imageFailed ? (
        <div
          className={`flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-white/50 ${
            isSkills ? 'aspect-[16/6]' : 'aspect-[4/3]'
          }`}
        >
          Imagen próximamente
        </div>
      ) : (
        <img
          src={detail.previewImage}
          alt={detail.title}
          onError={() => setImageFailed(true)}
          className={`w-full rounded-xl border border-white/10 bg-white/5 object-cover ${
            isSkills ? 'aspect-[16/6]' : 'aspect-[4/3]'
          }`}
        />
      )}

      <p className="text-sm leading-relaxed whitespace-pre-line text-white/80 sm:text-base">
        {detail.body}
      </p>

      {isSkills && <TagBadges items={detail.skills ?? []} />}
    </>
  )
}
