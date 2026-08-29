type Props = {
  /** Decide el texto: solo cambia el saludo, nunca menciona el fallback. */
  usedRealLocation: boolean
}

/**
 * Saludo breve que aparece cuando el vuelo de entrada aterriza, antes de que
 * arranque el tour. Comparte la caja del `SceneOverlay` (misma esquina, mismo
 * estilo) para que la transición hacia la primera escena no salte.
 */
export default function WelcomeOverlay({ usedRealLocation }: Props) {
  return (
    <div className="pointer-events-none fixed bottom-8 left-6 z-20 max-w-[360px] sm:bottom-12 sm:left-10">
      <div className="animate-scene-in rounded-xl border border-white/10 bg-black/60 px-6 py-5 text-white shadow-lg backdrop-blur-md">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {usedRealLocation ? 'Te encontré cerca de Cali' : 'Bienvenido a Cali'}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
          {usedRealLocation
            ? 'Bienvenido a mi mundo. Desde aquí arranca el recorrido.'
            : 'Mi ciudad natal. Desde aquí arranca el recorrido.'}
        </p>
      </div>
    </div>
  )
}
