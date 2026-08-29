import type { Map } from 'mapbox-gl'
import type { Scene } from '../../types'

/** Duración del vuelo cuando ni la llamada ni la escena definen una. */
export const DEFAULT_FLY_DURATION_MS = 4000

export type GoToOptions = {
  /**
   * Duración del vuelo en ms. Tiene prioridad sobre `scene.duration`: el tour
   * la calcula por tramo, porque un salto intercontinental necesita mucho más
   * tiempo que el mismo aterrizaje visto desde la ciudad vecina.
   */
  duration?: number
}

export class SceneManager {
  private map: Map

  constructor(map: Map) {
    this.map = map
  }

  goTo(scene: Scene, options: GoToOptions = {}) {
    this.map.flyTo({
      ...scene.camera,
      duration: options.duration ?? scene.duration ?? DEFAULT_FLY_DURATION_MS,
      essential: true,
    })
  }
}
