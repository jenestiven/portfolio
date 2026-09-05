import { useEffect, useState, type ReactNode } from 'react'

/**
 * Duración de la animación de salida (ms). Coincide con la clase `duration-250`
 * del panel: el desmontaje se retrasa justo lo que dura esa transición.
 */
const EXIT_MS = 250

type Props = {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  /** Texto del `aria-label` del diálogo. */
  label?: string
}

/**
 * Contenedor común de los modales del sitio: en `md+` (≥768px) es un modal
 * centrado y por debajo de ese ancho un drawer anclado al borde inferior. Es un
 * único árbol JSX con clases responsivas — no hay dos versiones del contenido
 * ni lógica de breakpoint en JS — así que cualquier cambio de estilo de los
 * modales se hace solo aquí.
 *
 * Cierra con clic en el fondo, con Escape y con el botón X. El contenido lo
 * aporta quien lo use, con su propio padding: este componente pone el marco, el
 * scroll interno y las transiciones.
 */
export default function ResponsiveModal({ isOpen, onClose, children, label }: Props) {
  // El montaje sobrevive al cierre lo que dura la salida, para que la
  // animación se llegue a ver antes de que el contenido desaparezca.
  const [mounted, setMounted] = useState(isOpen)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      setClosing(false)
      return
    }

    if (!mounted) return

    setClosing(true)
    const timer = window.setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, EXIT_MS)

    return () => window.clearTimeout(timer)
  }, [isOpen, mounted])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4">
      {/* Fondo semi-opaco: cubre la pantalla y cierra al hacer clic fuera. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full cursor-default bg-black/70 backdrop-blur-sm ${
          closing ? 'opacity-0 transition-opacity duration-250 ease-in' : 'animate-modal-fade-in'
        }`}
      />

      {/*
       * El mismo bloque en los dos casos: pegado abajo y a todo el ancho en
       * móvil, centrado y con ancho máximo en desktop. La entrada va por
       * keyframes (sube desde abajo o aparece con fundido, según el breakpoint)
       * y la salida por transición, deshaciendo el mismo gesto.
       */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl md:max-h-[85vh] md:max-w-2xl md:rounded-2xl ${
          closing
            ? 'translate-y-full transition duration-250 ease-in md:translate-y-3 md:opacity-0'
            : 'animate-modal-drawer-in md:animate-modal-center-in'
        }`}
      >
        {/* Handle del drawer: puramente decorativo, solo tiene sentido en móvil. */}
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-white/25 md:hidden"
        />

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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}
