import type { Scene } from '../../types'

/** Orden narrativo del scroll. Las escenas fuera de esta lista van al final. */
const SCENE_ORDER = ['intro', 'topografia', 'gis', 'software']

function orderIndex(id: string) {
  const index = SCENE_ORDER.indexOf(id)
  return index === -1 ? SCENE_ORDER.length : index
}

type Props = {
  scenes: Scene[]
}

export default function ScrollScenes({ scenes }: Props) {
  const ordered = [...scenes].sort((a, b) => orderIndex(a.id) - orderIndex(b.id))

  // pointer-events-none también en el contenedor: si no, su caja tapa el mapa
  // completo y los clics nunca llegan a los markers (MarkerLayer).
  return (
    <div className="pointer-events-none relative z-10">
      {/*
        Secciones sin contenido: solo dan altura de scroll y sirven de trigger
        para Scrollama. El título/descripción los pinta SceneOverlay.
      */}
      {ordered.map((scene) => (
        <section
          key={scene.id}
          id={scene.id}
          data-scene-id={scene.id}
          aria-label={scene.title}
          className="pointer-events-none min-h-screen bg-transparent"
        />
      ))}
    </div>
  )
}
