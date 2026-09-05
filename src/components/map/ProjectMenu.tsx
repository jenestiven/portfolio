import type { Scene } from '../../types'

type Props = {
  /** Escena activa, con sus markers. */
  scene: Scene | null
  /** Dispara el viaje del carrito hacia ese proyecto (ver MapView). */
  onSelectProject: (markerId: string) => void
  /**
   * Proyecto donde quedó estacionado el carrito: se resalta porque es el punto
   * de partida del próximo viaje.
   */
  cartAtMarkerId?: string | null
}

/**
 * Menú flotante con los proyectos de la ciudad actual.
 *
 * No sabe qué ciudades tienen proyectos: se muestra cuando la escena activa
 * trae markers y se esconde cuando no. Las tres ciudades del tour los tienen
 * — Cali con los marcadores de presentación, Londres y Tokio con los
 * laborales — y una ciudad nueva lo hereda sin tocar este componente.
 */
/**
 * Ciudades que se presentan bajo el marco de "Experiencia laboral" (addendum
 * v7 §D). Es solo copy: la lógica de selección de marcadores no cambia.
 */
const WORK_SCENE_IDS = new Set(['london', 'tokyo'])

export default function ProjectMenu({ scene, onSelectProject, cartAtMarkerId = null }: Props) {
  if (!scene || scene.markers.length === 0) return null

  const isWorkScene = WORK_SCENE_IDS.has(scene.id)

  return (
    <nav
      aria-label={`Proyectos en ${scene.city ?? scene.title}`}
      className="fixed top-6 right-6 z-20 w-60 sm:right-10"
    >
      {/*
        La key por scene.id remonta el bloque en cada cambio de ciudad, así la
        animación de entrada vuelve a correr — mismo criterio que SceneOverlay.
      */}
      <div
        key={scene.id}
        className="animate-scene-in overflow-hidden rounded-2xl border border-white/10 bg-black/60 text-white shadow-lg backdrop-blur-md"
      >
        {isWorkScene && (
          <p className="border-b border-white/10 px-4 pt-4 pb-3 text-sm font-medium text-white/90">
            Experiencia laboral
          </p>
        )}

        <p className="px-4 pt-4 pb-2 text-xs tracking-[0.2em] text-white/40 uppercase">
          Proyectos · {scene.city ?? scene.title}
        </p>

        <ul className="max-h-[50vh] overflow-y-auto pb-2">
          {scene.markers.map((marker) => {
            const isActive = marker.id === cartAtMarkerId

            return (
              <li key={marker.id}>
                <button
                  type="button"
                  onClick={() => onSelectProject(marker.id)}
                  aria-current={isActive}
                  className={`flex w-full items-start gap-2 px-4 py-2 text-left text-sm leading-snug transition hover:bg-white/10 ${
                    isActive ? 'text-white' : 'text-white/70'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      isActive ? 'bg-white' : 'bg-white/25'
                    }`}
                  />
                  {marker.title}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
