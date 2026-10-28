import spotlight from './spotlight'
import tilt from './tilt'

export function setupDirectives(app) {
  app.directive('spotlight', spotlight)
  app.directive('tilt', tilt)
}
