import { useEffect, useState } from 'react'
import type { Map } from 'mapbox-gl'
import type { GeospatialDetail, Marker, SoftwareDetail } from '../../types'
import { MARKER_LAYER_ID } from './MarkerLayer'

type Props = {
  /** Instancia única de Mapbox, ya con el estilo cargado. */
  map: Map
  /** Marker seleccionado, o null si no hay panel abierto. */
  marker: Marker | null
  onClose: () => void
}

/**
 * El contenido vive en un componente aparte para poder montarlo con
 * `key={marker.id}`: así los hooks (toggle de capa, Escape) se reinician al
 * cambiar de proyecto y el panel no arrastra estado del marker anterior.
 */
export default function ProjectPanel({ map, marker, onClose }: Props) {
  if (!marker) return null

  return <PanelContent key={marker.id} map={map} marker={marker} onClose={onClose} />
}

function PanelContent({ map, marker, onClose }: Props & { marker: Marker }) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex" role="dialog" aria-modal="true" aria-label={marker.title}>
      {/* Fondo semi-opaco: cubre la pantalla y cierra al hacer clic fuera. */}
      <button
        type="button"
        aria-label="Cerrar detalle"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div className="animate-scene-in relative ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-white/10 bg-neutral-950 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 z-10 rounded-full border border-white/15 bg-black/50 p-2 text-white/70 transition hover:bg-black/80 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10">
          <header className="pr-12">
            <span className="text-xs tracking-[0.2em] text-white/40 uppercase">
              {marker.detail.kind === 'software' ? 'Software' : 'Geoespacial'}
            </span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{marker.title}</h2>
          </header>

          {marker.detail.kind === 'software' ? (
            <SoftwareBody detail={marker.detail} />
          ) : (
            <GeospatialBody map={map} markerId={marker.id} detail={marker.detail} title={marker.title} />
          )}
        </div>
      </div>
    </div>
  )
}

function SoftwareBody({ detail }: { detail: SoftwareDetail }) {
  // El video vive en /public y puede no estar subido todavía: si no carga se
  // cae al mismo placeholder que cuando videoUrl viene vacío.
  const [videoFailed, setVideoFailed] = useState(false)

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
        {detail.videoUrl && !videoFailed ? (
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
        ) : (
          <div className="flex aspect-video w-full items-center justify-center text-sm text-white/50">
            Demo próximamente
          </div>
        )}
      </div>

      <p className="text-sm leading-relaxed text-white/80 sm:text-base">{detail.description}</p>

      {detail.stack.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {detail.stack.map((tech) => (
            <li
              key={tech}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80"
            >
              {tech}
            </li>
          ))}
        </ul>
      )}

      {detail.link && (
        <a
          href={detail.link}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/85"
        >
          Ver más
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
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
    // Se inserta debajo de los markers para que sigan siendo clicables.
    const beforeId = map.getLayer(MARKER_LAYER_ID) ? MARKER_LAYER_ID : undefined

    if (liveLayer.layerType === 'raster') {
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [liveLayer.sourceUrl],
        tileSize: 256
      })
      map.addLayer(
        {
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: { 'raster-opacity': 0.75 }
        },
        beforeId
      )
    } else {
      // El schema no lleva `source-layer`, así que una fuente vectorial de
      // teselas no se puede pintar de forma genérica: se trata el sourceUrl
      // como GeoJSON servido por URL (caso tesis Siloé).
      map.addSource(sourceId, { type: 'geojson', data: liveLayer.sourceUrl })
      map.addLayer(
        {
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': '#f97316',
            'fill-opacity': 0.45,
            'fill-outline-color': '#fdba74'
          }
        },
        beforeId
      )
    }

    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
    }
  }, [map, markerId, layerEnabled, liveLayer?.sourceUrl, liveLayer?.layerType])

  return (
    <>
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

      <p className="text-sm leading-relaxed text-white/80 sm:text-base">{detail.description}</p>

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
