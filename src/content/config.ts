import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const cameraSchema = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number(),
  pitch: z.number(),
  bearing: z.number(),
})

/**
 * Campos comunes a los proyectos de experiencia laboral (Londres y Tokio):
 * cargo, empresa, ubicación y el material de apoyo. Se fusiona con los campos
 * propios de cada kind mediante `.extend()`.
 */
const workDetailBaseSchema = z.object({
  /** Cargo desempeñado, ej. "Desarrollador Full-Stack". */
  role: z.string(),
  company: z.string(),
  companyLocation: z.string(),
  description: z.string(),
  /** Carrusel de imágenes. La primera se usa como preview en el popup. */
  images: z.array(z.string()).optional(),
  /** Video de demo. Tiene prioridad sobre el carrusel si ambos existen. */
  videoUrl: z.string().optional(),
  socialLinks: z
    .object({
      linkedin: z.string().optional(),
      github: z.string().optional(),
      website: z.string().optional(),
    })
    .optional(),
  /** Link a la demo desplegada, si existe. */
  demoUrl: z.string().optional(),
})

const softwareDetailSchema = workDetailBaseSchema.extend({
  kind: z.literal('software'),
  stack: z.array(z.string()),
})

const geospatialDetailSchema = workDetailBaseSchema.extend({
  kind: z.literal('geospatial'),
  diagramAsset: z.string(),
  methodologyText: z.string(),
  liveLayer: z
    .object({
      sourceUrl: z.string(),
      layerType: z.enum(['raster', 'vector']),
    })
    .optional(),
})

const profileDetailSchema = z.object({
  kind: z.literal('profile'),
  subtype: z.enum(['education', 'about', 'interests', 'skills']),
  /** Imagen de la vista previa del popup y del panel. */
  previewImage: z.string(),
  title: z.string(),
  body: z.string(),
  /** Solo para subtype 'skills': badges de tecnologías. */
  skills: z.array(z.string()).optional(),
})

const markerSchema = z.object({
  id: z.string(),
  coord: z.tuple([z.number(), z.number()]),
  title: z.string(),
  type: z.enum(['software', 'geospatial', 'profile']),
  detail: z.discriminatedUnion('kind', [
    softwareDetailSchema,
    geospatialDetailSchema,
    profileDetailSchema,
  ]),
})

const scenes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/scenes' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    /** Nombre corto de la ciudad, para el menú del tour. Cae a `title` si falta. */
    section: z.string().optional(),
    city: z.string().optional(),
    description: z.string(),
    camera: cameraSchema,
    duration: z.number().optional(),
    /** Radio en km alrededor de camera.center para la detección de escena activa. */
    radiusKm: z.number().positive(),
    markers: z.array(markerSchema),
  }),
})

export const collections = { scenes }
