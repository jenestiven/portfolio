import { useRef, useState } from 'react'

type Props = {
  /** Rutas de las imágenes, en el orden en que se muestran. */
  images: string[]
  /** Texto base del alt; se le agrega el índice cuando hay más de una. */
  alt?: string
}

/** Distancia mínima (px) de un swipe para que cuente como cambio de imagen. */
const SWIPE_THRESHOLD = 48

/**
 * Carrusel simple de imágenes. Con 0 imágenes no renderiza nada y con 1 sola
 * muestra la imagen sin controles: los proyectos que todavía no tienen
 * material no necesitan un caso especial en el panel.
 */
export default function ImageCarousel({ images, alt = 'Imagen del proyecto' }: Props) {
  const [index, setIndex] = useState(0)
  // Las imágenes viven en /public y llegan en el sprint de contenido: las que
  // fallan se reemplazan por un bloque neutro en vez del ícono roto.
  const [failed, setFailed] = useState<Record<number, boolean>>({})
  const touchStartX = useRef<number | null>(null)

  if (images.length === 0) return null

  const total = images.length
  const hasControls = total > 1
  const go = (next: number) => setIndex((next + total) % total)

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null || !hasControls) return

    const delta = event.changedTouches[0].clientX - start
    if (Math.abs(delta) < SWIPE_THRESHOLD) return
    go(delta < 0 ? index + 1 : index - 1)
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40"
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX
      }}
      onTouchEnd={handleTouchEnd}
    >
      {failed[index] ? (
        <div className="flex aspect-video w-full items-center justify-center text-sm text-white/50">
          Imagen próximamente
        </div>
      ) : (
        <img
          src={images[index]}
          alt={hasControls ? `${alt} (${index + 1} de ${total})` : alt}
          onError={() => setFailed((current) => ({ ...current, [index]: true }))}
          className="aspect-video w-full bg-black object-cover"
        />
      )}

      {hasControls && (
        <>
          <CarouselArrow direction="prev" onClick={() => go(index - 1)} />
          <CarouselArrow direction="next" onClick={() => go(index + 1)} />

          <ul className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {images.map((image, position) => (
              <li key={image}>
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-label={`Ir a la imagen ${position + 1}`}
                  aria-current={position === index}
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    position === index ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                  }`}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function CarouselArrow({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const isPrev = direction === 'prev'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isPrev ? 'Imagen anterior' : 'Imagen siguiente'}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-black/50 p-2 text-white/70 transition hover:bg-black/80 hover:text-white ${
        isPrev ? 'left-3' : 'right-3'
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d={isPrev ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
