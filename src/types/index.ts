/**
 * Campos comunes a los proyectos de experiencia laboral (Londres y Tokio).
 * Es el equivalente a una tarjeta de experiencia de LinkedIn: cargo, empresa,
 * ubicación y el material de apoyo (video y/o carrusel de imágenes).
 */
export type WorkDetailBase = {
  /** Cargo desempeñado, ej. "Desarrollador Full-Stack". */
  role: string
  company: string
  companyLocation: string
  description: string
  /** Carrusel de imágenes. La primera se usa como preview en el popup. */
  images?: string[]
  /** Video de demo. Tiene prioridad sobre el carrusel si ambos existen. */
  videoUrl?: string
  socialLinks?: {
    linkedin?: string
    github?: string
    website?: string
  }
  /** Link a la demo desplegada, si existe. */
  demoUrl?: string
}

export type SoftwareDetail = WorkDetailBase & {
  kind: 'software'
  stack: string[]
}

export type GeospatialDetail = WorkDetailBase & {
  kind: 'geospatial'
  /** Ruta a diagrama de metodología (SVG/PNG) */
  diagramAsset: string
  methodologyText: string
  /** Solo para casos no confidenciales (ej. tesis Siloé) */
  liveLayer?: {
    sourceUrl: string
    layerType: 'raster' | 'vector'
  }
}

export type ProfileDetail = {
  kind: 'profile'
  subtype: 'education' | 'about' | 'interests' | 'skills'
  /** Imagen de la vista previa del popup y del panel. */
  previewImage: string
  title: string
  /** Contenido del panel completo. */
  body: string
  /** Solo para subtype 'skills': badges de tecnologías. */
  skills?: string[]
}

export type ProjectDetail = SoftwareDetail | GeospatialDetail | ProfileDetail

/** Los dos kinds que comparten `WorkDetailBase`. */
export type WorkDetail = SoftwareDetail | GeospatialDetail

export type Marker = {
  id: string
  coord: [number, number]
  title: string
  type: 'software' | 'geospatial' | 'profile'
  detail: ProjectDetail
}

export type Scene = {
  id: string
  title: string
  /** Nombre corto de la ciudad, para el menú del tour. Cae a `title` si falta. */
  section?: string
  city?: string
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
