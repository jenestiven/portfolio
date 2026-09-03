/**
 * Saludo breve que aparece cuando el vuelo de entrada aterriza en Univalle,
 * antes de que arranque el tour. Comparte la caja del `SceneOverlay` (misma
 * esquina, mismo estilo) para que la transición hacia la primera escena no
 * salte.
 */
export default function WelcomeOverlay() {
  return (
    <div className="pointer-events-none fixed bottom-8 left-6 z-20 max-w-[360px] sm:bottom-12 sm:left-10">
      <div className="animate-scene-in rounded-xl border border-white/10 bg-black/60 px-6 py-5 text-white shadow-lg backdrop-blur-md">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Bienvenido a la Universidad del Valle
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
          Donde empezó todo. Desde aquí arranca el recorrido.
        </p>
      </div>
    </div>
  )
}
