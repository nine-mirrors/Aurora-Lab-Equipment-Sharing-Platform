/**
 * v-spotlight：让卡片跟随鼠标产生柔和高光
 */
export const spotlight = {
  mounted(el) {
    el.classList.add('spotlight')

    const move = event => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${event.clientX - rect.left}px`)
      el.style.setProperty('--my', `${event.clientY - rect.top}px`)
    }

    const leave = () => {
      el.style.setProperty('--mx', '50%')
      el.style.setProperty('--my', '0%')
    }

    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', leave)
    el.__spotlightCleanup = () => {
      el.removeEventListener('mousemove', move)
      el.removeEventListener('mouseleave', leave)
    }
  },

  unmounted(el) {
    el.__spotlightCleanup?.()
  }
}

export default spotlight
