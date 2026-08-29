import type { Scene } from '../../types'

/** Solo lo que el overlay necesita pintar de la escena activa. */
type ActiveScene = Pick<Scene, 'id' | 'title' | 'description'>

type Props = {
  activeScene: ActiveScene | null
}

export default function SceneOverlay({ activeScene }: Props) {
  if (!activeScene) return null

  return (
    <div className="pointer-events-none fixed bottom-8 left-6 z-20 max-w-[360px] sm:bottom-12 sm:left-10">
      {/*
        La key por scene.id fuerza el remontaje del bloque en cada cambio de
        escena, así la animación de entrada (animate-scene-in) vuelve a correr.
      */}
      <div
        key={activeScene.id}
        className="animate-scene-in rounded-xl border border-white/10 bg-black/60 px-6 py-5 text-white shadow-lg backdrop-blur-md"
      >
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {activeScene.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
          {activeScene.description}
        </p>
      </div>
    </div>
  )
}
