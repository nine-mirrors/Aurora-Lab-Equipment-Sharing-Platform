/**
 * v-tilt：鼠标驱动的轻量 3D 倾斜
 * 仅在精细指针设备且未开启“减少动态效果”时生效。
 */
const store = new WeakMap()

function canUse() {
  return (
    window.matchMedia('(pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default {
  mounted(el, binding) {
    if (!canUse()) return

    const max = Number(binding.value?.max) || 5
    el.classList.add('tilt-target')

    const move = event => {
      const rect = el.getBoundingClientRect()
      const px = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
      const py = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
      const rotateX = (0.5 - py) * max * 2
      const rotateY = (px - 0.5) * max * 2

      el.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`
      el.style.setProperty('--tilt-x', `${(px * 100).toFixed(1)}%`)
      el.style.setProperty('--tilt-y', `${(py * 100).toFixed(1)}%`)
    }

    const leave = () => {
      el.style.transform = ''
      el.style.removeProperty('will-change')
    }

    const enter = () => {
      el.style.willChange = 'transform'
    }

    el.addEventListener('pointerenter', enter, { passive: true })
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', leave, { passive: true })

    store.set(el, { move, leave, enter })
  },

  unmounted(el) {
    const handlers = store.get(el)
    if (!handlers) return
    el.removeEventListener('pointerenter', handlers.enter)
    el.removeEventListener('pointermove', handlers.move)
    el.removeEventListener('pointerleave', handlers.leave)
    store.delete(el)
  }
}
