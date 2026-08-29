import { useEffect, useRef, useState } from 'react'
import scrollama from 'scrollama'
import { initMap } from '../../lib/map/initMap'
import { SceneManager } from '../../lib/map/SceneManager'
import type { Scene } from '../../types'
import SceneOverlay from './SceneOverlay'

type Props = {
  scenes: Scene[]
}

export default function MapView({ scenes }: Props) {
  /**
   * Las escenas se leen desde un ref para que el efecto corra una sola vez:
   * el mapa y el scroller se montan al inicio y no se reinicializan aunque
   * Astro vuelva a renderizar la isla con un array nuevo.
   */
  const scenesRef = useRef(scenes)
  scenesRef.current = scenes

  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)

  useEffect(() => {
    const map = initMap('map')
    const scroller = scrollama()
    const handleResize = () => scroller.resize()

    map.on('load', () => {
      const sceneManager = new SceneManager(map)

      // Los <section> los renderiza ScrollScenes.tsx (HTML estático de Astro),
      // así que ya están en el DOM cuando hidrata esta isla.
      scroller
        .setup({ step: '[data-scene-id]', offset: 0.5 })
        .onStepEnter(({ element }) => {
          const scene = scenesRef.current.find((s) => s.id === element.dataset.sceneId)
          if (!scene) return
          sceneManager.goTo(scene)
          setActiveSceneId(scene.id)
        })

      window.addEventListener('resize', handleResize)
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      scroller.destroy()
      map.remove()
    }
  }, [])

  const activeScene = scenes.find((scene) => scene.id === activeSceneId) ?? null

  return (
    <>
      <div id="map" className="h-full w-full" />
      <SceneOverlay activeScene={activeScene} />
    </>
  )
}
