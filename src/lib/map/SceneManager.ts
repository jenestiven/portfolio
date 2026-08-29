import type { Map } from 'mapbox-gl'

export class SceneManager {
  private map: Map

  constructor(map: Map) {
    this.map = map
  }

  goTo(scene: any) {
    this.map.flyTo({
      ...scene.camera,
      duration: scene.duration || 4000,
      essential: true
    })
  }
}
