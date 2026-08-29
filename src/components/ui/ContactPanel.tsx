import { useEffect, useState } from 'react'

/**
 * Datos de contacto — placeholders. Se reemplazan por los reales en el sprint
 * de contenido, cuando el CV/LinkedIn estén disponibles (ver addendum v5).
 */
const EMAIL = 'contacto@ejemplo.com'
const LINKEDIN_URL = 'https://linkedin.com/in/placeholder'
/** El PDF se sube a `public/cv/` en el sprint de contenido. */
const CV_URL = '/cv/jhon-cv.pdf'

type Props = {
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal de contacto: email, LinkedIn y descarga de CV. Es independiente del
 * mapa — no lee `activeSceneId` ni toca la instancia de Mapbox.
 *
 * Mismo patrón que `ProjectPanel`: fondo semi-opaco que cierra al hacer clic
 * fuera, Escape para cerrar y un botón de cierre explícito.
 */
export default function ContactPanel({ isOpen, onClose }: Props) {
  if (!isOpen) return null

  return <PanelContent onClose={onClose} />
}

/** Estado de disponibilidad del PDF de CV mientras se comprueba. */
type CvStatus = 'checking' | 'available' | 'missing'

function PanelContent({ onClose }: { onClose: () => void }) {
  const [cvStatus, setCvStatus] = useState<CvStatus>('checking')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  /**
   * El PDF todavía no existe en el repo: en vez de ofrecer un enlace roto se
   * comprueba en runtime y el botón cae a "próximamente". Cuando el archivo se
   * suba, se habilita solo — sin tocar este componente ni romper el build.
   */
  useEffect(() => {
    let cancelled = false

    fetch(CV_URL, { method: 'HEAD' })
      .then((response) => {
        // El dev server responde 200 con HTML en rutas no encontradas de más
        // de un framework, así que no basta con response.ok.
        const isPdf = response.headers.get('content-type')?.includes('pdf') ?? false
        if (!cancelled) setCvStatus(response.ok && isPdf ? 'available' : 'missing')
      })
      .catch(() => {
        if (!cancelled) setCvStatus('missing')
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Contacto"
    >
      {/* Fondo semi-opaco: cubre la pantalla y cierra al hacer clic fuera. */}
      <button
        type="button"
        aria-label="Cerrar contacto"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm"
      />

      <div className="animate-scene-in relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-4 z-10 rounded-full border border-white/15 bg-black/50 p-2 text-white/70 transition hover:bg-black/80 hover:text-white"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>

        <div className="flex flex-col gap-6 px-6 py-8 sm:px-8">
          <header className="pr-12">
            <span className="text-xs tracking-[0.2em] text-white/40 uppercase">Contacto</span>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Hablemos</h2>
          </header>

          <ul className="flex flex-col gap-3">
            <li>
              <a
                href={`mailto:${EMAIL}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {EMAIL}
              </a>
            </li>

            <li>
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                  <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-5.7c0-1.36-.03-3.1-1.95-3.1-1.95 0-2.25 1.47-2.25 2.99V21h-4V9Z" />
                </svg>
                LinkedIn
              </a>
            </li>
          </ul>

          {cvStatus === 'available' ? (
            <a
              href={CV_URL}
              download
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/85"
            >
              Descargar CV
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="El CV se publica próximamente"
              className="inline-flex w-fit cursor-not-allowed items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-white/40"
            >
              {cvStatus === 'checking' ? 'CV' : 'CV próximamente'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
