import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const cameraSchema = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number(),
  pitch: z.number(),
  bearing: z.number(),
})

const softwareDetailSchema = z.object({
  kind: z.literal('software'),
  description: z.string(),
  videoUrl: z.string().optional(),
  stack: z.array(z.string()),
  link: z.string().optional(),
})

const geospatialDetailSchema = z.object({
  kind: z.literal('geospatial'),
  description: z.string(),
  diagramAsset: z.string(),
  methodologyText: z.string(),
  liveLayer: z
    .object({
      sourceUrl: z.string(),
      layerType: z.enum(['raster', 'vector']),
    })
    .optional(),
})

const markerSchema = z.object({
  id: z.string(),
  coord: z.tuple([z.number(), z.number()]),
  title: z.string(),
  type: z.enum(['software', 'geospatial']),
  detail: z.discriminatedUnion('kind', [softwareDetailSchema, geospatialDetailSchema]),
})

const scenes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/scenes' }),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    camera: cameraSchema,
    duration: z.number().optional(),
    /** Radio en km alrededor de camera.center para la detección de escena activa. */
    radiusKm: z.number().positive(),
    markers: z.array(markerSchema),
  }),
})

export const collections = { scenes }
