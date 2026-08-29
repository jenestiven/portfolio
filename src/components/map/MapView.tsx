import { useEffect } from "react"
import { initMap } from '../../lib/map/initMap'
import { SceneManager } from '../../lib/map/SceneManager'
import { IntroScene } from '../../lib/map/scenes/intro.scene'

export default function MapView() {
  useEffect(() => {
    const map = initMap('map')

    map.on('load', () => {
      const sceneManager = new SceneManager(map)
      sceneManager.goTo(IntroScene)
    })
  }, [])

  return <div id="map" style={{ width: '100%', height: '100vh' }} />
}
