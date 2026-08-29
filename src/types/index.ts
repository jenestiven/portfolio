export type SoftwareDetail = {
  kind: 'software'
  description: string
  /** Vacío o ausente = placeholder "próximamente" (caso CDA) */
  videoUrl?: string
  stack: string[]
  link?: string
}

export type GeospatialDetail = {
  kind: 'geospatial'
  description: string
  /** Ruta a diagrama de metodología (SVG/PNG) */
  diagramAsset: string
  methodologyText: string
  /** Solo para casos no confidenciales (ej. tesis Siloé) */
  liveLayer?: {
    sourceUrl: string
    layerType: 'raster' | 'vector'
  }
}

export type ProjectDetail = SoftwareDetail | GeospatialDetail

export type Marker = {
  id: string
  coord: [number, number]
  title: string
  type: 'software' | 'geospatial'
  detail: ProjectDetail
}

export type Scene = {
  id: string
  title: string
  description: string
  camera: {
    center: [number, number]
    zoom: number
    pitch: number
    bearing: number
  }
  duration?: number
  /** Radio en km alrededor de camera.center para la detección de escena activa. */
  radiusKm: number
  markers: Marker[]
}
