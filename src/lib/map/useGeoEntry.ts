import { useEffect, useRef, useState } from 'react'
import distance from '@turf/distance'
import { point } from '@turf/helpers'

/**
 * Punto de aterrizaje por defecto: Estadio Pascual Guerrero. Se usa cuando no
 * hay geolocalización utilizable (sin soporte, permiso negado, error, timeout)
 * o cuando el usuario está lejos de Cali.
 */
export const FALLBACK_LANDING_POINT: [number, number] = [-76.54108, 3.42989]

/** Radio del área metropolitana de Cali: dentro de él se aterriza en el usuario. */
export const LOCAL_RADIUS_KM = 40

/** Más allá de esto no se espera al GPS: el aterrizaje arranca con el fallback. */
const GEOLOCATION_TIMEOUT_MS = 5000

export type GeoEntry = {
  /** Coordenada donde aterriza el vuelo de entrada. */
  landingPoint: [number, number]
  /**
   * Si el aterrizaje es sobre la posición real del usuario. Solo se usa para
   * variar el texto de bienvenida — el fallback nunca se le anuncia.
   */
  usedRealLocation: boolean
}

const FALLBACK_ENTRY: GeoEntry = {
  landingPoint: FALLBACK_LANDING_POINT,
  usedRealLocation: false,
}

/**
 * Resuelve el punto de aterrizaje. Nunca rechaza: cualquier camino que no
 * termine en una posición cercana a Cali cae en el fallback.
 */
function resolveGeoEntry(caliCenter: [number, number] | null): Promise<GeoEntry> {
  return new Promise((resolve) => {
    // Sin escena "cali" no hay contra qué medir la cercanía; sin API de
    // geolocalización no hay nada que pedir. En ambos casos, fallback directo.
    if (!caliCenter || typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(FALLBACK_ENTRY)
      return
    }

    const onSuccess = (position: GeolocationPosition) => {
      const userPoint: [number, number] = [
        position.coords.longitude,
        position.coords.latitude,
      ]
      const km = distance(point(userPoint), point(caliCenter), { units: 'kilometers' })

      resolve(
        km <= LOCAL_RADIUS_KM
          ? { landingPoint: userPoint, usedRealLocation: true }
          : FALLBACK_ENTRY
      )
    }

    try {
      navigator.geolocation.getCurrentPosition(onSuccess, () => resolve(FALLBACK_ENTRY), {
        timeout: GEOLOCATION_TIMEOUT_MS,
        enableHighAccuracy: false,
      })
    } catch {
      // Algunos navegadores lanzan de forma síncrona (contexto no seguro,
      // política de permisos): también es fallback, no un error a propagar.
      resolve(FALLBACK_ENTRY)
    }
  })
}

/**
 * Pide la ubicación una sola vez por sesión y devuelve el punto de aterrizaje
 * de la entrada. Devuelve `null` mientras resuelve: quien lo consuma debe
 * esperar antes de mover la cámara.
 */
export function useGeoEntry(caliCenter: [number, number] | null): GeoEntry | null {
  const [entry, setEntry] = useState<GeoEntry | null>(null)

  /**
   * El centro se lee desde un ref para que el efecto corra una sola vez: solo
   * importa el valor con el que arranca la sesión, no el de cada render.
   */
  const caliCenterRef = useRef(caliCenter)
  caliCenterRef.current = caliCenter

  useEffect(() => {
    let cancelled = false

    resolveGeoEntry(caliCenterRef.current).then((resolved) => {
      if (!cancelled) setEntry(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return entry
}
