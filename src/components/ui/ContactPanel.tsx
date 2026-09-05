import { useEffect, useState } from 'react'
import ResponsiveModal from './ResponsiveModal'

/**
 * ───────────────────────────────────────────────────────────────────────────
 * CONTENIDO PENDIENTE — qué espera este componente (addendum v7 §F)
 * ───────────────────────────────────────────────────────────────────────────
 * PDFs de CV — se copian tal cual en `public/`, sin renombrar:
 *   public/cv/jhon-desarrollador.pdf  → botón "CV Desarrollador"
 *   public/cv/jhon-ingeniero.pdf      → botón "CV Ingeniero"
 *   Mientras un archivo no exista, ese botón se muestra deshabilitado como
 *   "… próximamente" — se comprueba en runtime, nunca rompe el build (mismo
 *   mecanismo del CV único del sprint 12). Al subir el PDF se habilita solo,
 *   sin tocar este archivo. Los dos son independientes: uno puede estar
 *   publicado y el otro pendiente.
 *
 * Redes sociales — solo hacen falta URLs: los íconos son SVG inline, no hay
 * assets que subir a `public/`. Para completar, se reemplazan las URLs
 * placeholder de `SOCIAL_LINKS`. Para agregar una red nueva basta con añadir
 * un objeto más al array (no hay campos fijos):
 *     { label: 'Instagram', url: 'https://instagram.com/…' }
 *   `icon` acepta 'linkedin' | 'github' | 'link'; si se omite cae en el ícono
 *   genérico de enlace, así una red nueva no exige dibujar un SVG primero.
 *
 * Email — reemplazar `EMAIL` por el definitivo (heredado del sprint 12).
 */

/** Datos de contacto — placeholders hasta el sprint de contenido. */
const EMAIL = 'jhon.gonzalez.aricapa@gmail.com'

type SocialIconName = 'linkedin' | 'github' | 'link'

type SocialLink = {
  label: string
  url: string
  /** Ícono inline; por defecto el genérico de enlace. */
  icon?: SocialIconName
}

/**
 * Array, no campos fijos: agregar una tercera o cuarta red es añadir un objeto
 * aquí — el grid y los íconos se adaptan solos.
 */
const SOCIAL_LINKS: SocialLink[] = [
  { label: 'LinkedIn', url: 'https://linkedin.com/in/jhon-aricapa', icon: 'linkedin' },
  { label: 'GitHub', url: 'https://github.com/jenestiven', icon: 'github' },
]

type CvLink = {
  label: string
  url: string
}

/** Los dos CVs son públicos y sin jerarquía entre ellos (addendum v7 §F). */
const CV_LINKS: CvLink[] = [
  { label: 'CV Desarrollador', url: '/cv/jhon-desarrollador.pdf' },
  { label: 'CV Ingeniero', url: '/cv/jhon-ingeniero.pdf' },
]

/** Constante de módulo: identidad estable para el efecto de comprobación. */
const CV_URLS = CV_LINKS.map((cv) => cv.url)

type Props = {
  isOpen: boolean
  onClose: () => void
}

/**
 * Modal de contacto: email, redes sociales y descarga de los dos CV. Es
 * independiente del mapa — no lee `activeSceneId` ni toca la instancia de
 * Mapbox, y se sigue abriendo desde `ContactButton` a través de
 * `ContactWidget` con la misma prop `isOpen` del sprint 12: ninguno de esos
 * dos componentes cambia.
 *
 * Usa el mismo `ResponsiveModal` que `ProjectPanel` — modal centrado en
 * desktop, drawer en móvil — así que el fondo, el cierre (clic fuera, Escape,
 * botón X) y las transiciones se definen en un solo lugar. `PanelContent` solo
 * se monta con el modal abierto: la comprobación de los PDFs no corre al
 * cargar la página.
 */
export default function ContactPanel({ isOpen, onClose }: Props) {
  return (
    <ResponsiveModal isOpen={isOpen} onClose={onClose} label="Contacto">
      <PanelContent />
    </ResponsiveModal>
  )
}

/** Estado de disponibilidad de un PDF mientras se comprueba. */
type AssetStatus = 'checking' | 'available' | 'missing'

/**
 * Comprueba por HEAD cuáles de los PDFs existen realmente. Devuelve un estado
 * por URL, así un CV subido y el otro pendiente conviven sin problema.
 */
function useAssetAvailability(urls: string[]): Record<string, AssetStatus> {
  const [statuses, setStatuses] = useState<Record<string, AssetStatus>>(() =>
    Object.fromEntries(urls.map((url) => [url, 'checking' as AssetStatus])),
  )

  useEffect(() => {
    let cancelled = false

    for (const url of urls) {
      fetch(url, { method: 'HEAD' })
        .then((response) => {
          // El dev server responde 200 con HTML en rutas no encontradas de más
          // de un framework, así que no basta con response.ok.
          const isPdf = response.headers.get('content-type')?.includes('pdf') ?? false
          const status: AssetStatus = response.ok && isPdf ? 'available' : 'missing'
          if (!cancelled) setStatuses((prev) => ({ ...prev, [url]: status }))
        })
        .catch(() => {
          if (!cancelled) setStatuses((prev) => ({ ...prev, [url]: 'missing' }))
        })
    }

    return () => {
      cancelled = true
    }
  }, [urls])

  return statuses
}

function PanelContent() {
  const cvStatuses = useAssetAvailability(CV_URLS)

  return (
    <div className="flex flex-col gap-6 px-6 py-8 sm:px-8 sm:py-10">
      <header className="pr-12">
        <span className="text-xs tracking-[0.2em] text-white/40 uppercase">Contacto</span>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Hablemos</h2>
      </header>

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

      <section className="flex flex-col gap-3">
        <h3 className="text-xs tracking-[0.2em] text-white/40 uppercase">Redes</h3>
        <ul className="grid grid-cols-2 gap-3">
          {SOCIAL_LINKS.map((social) => (
            <li key={social.url}>
              <a
                href={social.url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <SocialIcon name={social.icon ?? 'link'} />
                {social.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs tracking-[0.2em] text-white/40 uppercase">Hoja de vida</h3>
        <div className="flex flex-wrap gap-3">
          {CV_LINKS.map((cv) => (
            <CvButton key={cv.url} cv={cv} status={cvStatuses[cv.url] ?? 'checking'} />
          ))}
        </div>
      </section>
    </div>
  )
}

/**
 * Botón de descarga de un CV. Mientras el PDF no exista cae a "próximamente"
 * deshabilitado, igual que el CV único del sprint 12.
 */
function CvButton({ cv, status }: { cv: CvLink; status: AssetStatus }) {
  if (status === 'available') {
    return (
      <a
        href={cv.url}
        download
        className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-white/85"
      >
        {cv.label}
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
    )
  }

  return (
    <button
      type="button"
      disabled
      title={`${cv.label}: se publica próximamente`}
      className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-white/40"
    >
      {status === 'checking' ? cv.label : `${cv.label} — próximamente`}
    </button>
  )
}

/** Íconos inline de redes. `link` es el genérico para redes sin ícono propio. */
function SocialIcon({ name }: { name: SocialIconName }) {
  const className = 'h-4 w-4 shrink-0'

  if (name === 'linkedin') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.75V21h-4v-5.7c0-1.36-.03-3.1-1.95-3.1-1.95 0-2.25 1.47-2.25 2.99V21h-4V9Z" />
      </svg>
    )
  }

  if (name === 'github') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path
        d="M10.5 13.5a4 4 0 0 0 5.66 0l2.5-2.5a4 4 0 1 0-5.66-5.66l-1 1M13.5 10.5a4 4 0 0 0-5.66 0l-2.5 2.5a4 4 0 1 0 5.66 5.66l1-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
