type Props = {
  /** Abre el ContactPanel (el estado vive en ContactWidget). */
  onOpen: () => void
  /** True mientras el panel está abierto: solo para el aria-expanded. */
  isOpen: boolean
}

/**
 * Botón flotante de contacto. Vive fuera de MapView y no depende de la escena
 * activa ni del tour: está visible en cualquier ciudad y durante el recorrido
 * automático.
 *
 * Esquina superior izquierda a propósito: la superior derecha la ocupa
 * `ProjectMenu` y la inferior derecha `TourControl`. El z-index queda por
 * encima de ambos (z-20) pero por debajo del `ProjectPanel` (z-30), que es un
 * modal y sí debe taparlo mientras esté abierto.
 */
export default function ContactButton({ onOpen, isOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      title="Contacto"
      className="fixed top-6 left-6 z-[25] flex h-11 items-center gap-2 rounded-full border border-white/10 bg-black/60 px-4 text-sm font-medium text-white shadow-lg backdrop-blur-md transition hover:bg-black/75 sm:left-10"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 7 8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Contacto
    </button>
  )
}
