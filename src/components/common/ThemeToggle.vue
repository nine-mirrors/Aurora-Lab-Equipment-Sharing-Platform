<script setup>
import { useUiStore } from '@/stores/Ui'

const ui = useUiStore()

function toggleTheme(event) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!document.startViewTransition || reduce) {
    ui.toggleTheme()
    return
  }

  const x = event?.clientX ?? window.innerWidth - 48
  const y = event?.clientY ?? 40

  try {
    const transition = document.startViewTransition(() => {
      ui.toggleTheme()
    })

    transition.ready
      .then(() => {
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        )

        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 640,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)'
          }
        )
      })
      .catch(() => {})
  } catch {
    ui.toggleTheme()
  }
}
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :class="{ dark: ui.isDark }"
    role="switch"
    :aria-checked="ui.isDark"
    :aria-label="ui.isDark ? '深空模式已开启，点击切换到浅色模式' : '浅色模式已开启，点击切换到深空模式'"
    :title="ui.isDark ? '切换到浅色模式' : '切换到深空模式'"
    data-cursor-label="切换主题"
    @click="toggleTheme"
  >
    <span class="toggle-track">
      <span class="toggle-thumb">
        <el-icon v-if="ui.isDark" class="icon"><Moon /></el-icon>
        <el-icon v-else class="icon"><Sunny /></el-icon>
      </span>
      <span class="star s1"></span>
      <span class="star s2"></span>
      <span class="star s3"></span>
    </span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 8px;
  margin: -8px;
  cursor: pointer;
  border-radius: 999px;
}

.toggle-track {
  position: relative;
  display: block;
  width: 52px;
  height: 28px;
  border-radius: 999px;
  background: linear-gradient(135deg, #e4efdd, #f5f9f1);
  border: 1px solid var(--border);
  box-shadow: inset 0 1px 3px rgba(13, 33, 25, 0.08);
  transition: background 0.4s var(--ease-out);
  overflow: hidden;
}

.dark .toggle-track {
  background: linear-gradient(135deg, #081510, #1b2f25);
  border-color: #2a4438;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  color: #b58518;
  box-shadow: 0 2px 6px rgba(13, 33, 25, 0.18);
  transition: transform 0.42s var(--ease-spring), background 0.3s ease, color 0.3s ease;
}

.dark .toggle-thumb {
  transform: translateX(24px);
  background: #16271f;
  color: #a8e4cf;
}

.icon {
  font-size: 14px;
  transition: transform 0.4s var(--ease-spring);
}

.toggle-thumb:hover .icon {
  transform: rotate(24deg);
}

.star {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 999px;
  background: #c2dd63;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.dark .star {
  opacity: 0.9;
}

.s1 {
  left: 9px;
  top: 7px;
}

.s2 {
  left: 14px;
  bottom: 8px;
  width: 1.5px;
  height: 1.5px;
}

.s3 {
  left: 6px;
  bottom: 11px;
  width: 1.5px;
  height: 1.5px;
}

@media (max-width: 768px) {
  .toggle-track {
    width: 46px;
  }

  .dark .toggle-thumb {
    transform: translateX(18px);
  }
}
</style>
