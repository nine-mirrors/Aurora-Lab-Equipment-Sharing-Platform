<!-- VERDANT LAB 项目专属光标：跟随光晕 + 多状态指针 + 点击波纹 -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useUiStore } from '@/stores/Ui'
import { useAiStore } from '@/stores/useAiStore'

const ui = useUiStore()
const ai = useAiStore()

const enabled = ref(false)
const visible = ref(false)
const mode = ref('default')
const pressed = ref('')
const label = ref('')

const dotEl = ref(null)
const ringEl = ref(null)
const auraEl = ref(null)
const badgeEl = ref(null)

let raf = null
let seq = 0
let lastTarget = null
let pressTimer = null
let reduceQuery = null
let pointerQuery = null

const x = { current: -200, target: -200 }
const ring = { x: -200, y: -200 }
const aura = { x: -200, y: -200 }
const mouse = { x: -200, y: -200 }

const ripples = ref([])

const loading = computed(() => ui.routeLoading || ai.pending)

const badgeText = computed(() => {
  if (pressed.value === 'left') return '左键'
  if (pressed.value === 'right') return '右键'
  if (pressed.value === 'middle') return '中键'
  if (mode.value === 'loading') return '载入中'
  if (label.value) return label.value
  if (mode.value === 'text') return '文本'
  return ''
})

const hasBadge = computed(() => Boolean(badgeText.value))

function canUseCursor() {
  return (
    ui.cursorEnabled &&
    window.matchMedia('(pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function detectMode(target) {
  if (!(target instanceof Element)) return 'default'

  const explicit = target.closest('[data-cursor]')?.getAttribute('data-cursor')
  const labelNode = target.closest('[data-cursor-label]')
  label.value = labelNode?.getAttribute('data-cursor-label') || ''

  if (loading.value) return 'loading'
  if (target.closest('input, textarea, [contenteditable="true"]')) return 'text'
  if (target.closest('.is-loading, [aria-busy="true"]')) return 'loading'
  if (target.closest('button:disabled, .is-disabled, [aria-disabled="true"]')) return 'disabled'
  if (explicit) return explicit
  if (
    target.closest(
      'a, button, [role="button"], .el-button, .el-switch, .el-checkbox, .el-radio, .el-select, .el-dropdown, .device-card, .stat-card, .nav-item, .tab-chip'
    )
  ) {
    return 'hover'
  }
  return 'default'
}

function refreshMode() {
  mode.value = detectMode(lastTarget)
}

function onPointerMove(event) {
  if (!enabled.value || event.pointerType !== 'mouse') return
  mouse.x = event.clientX
  mouse.y = event.clientY
  x.target = event.clientX
  x.current = event.clientX
  lastTarget = event.target
  visible.value = true
  mode.value = detectMode(event.target)
}

function onPointerDown(event) {
  if (!enabled.value || event.pointerType !== 'mouse') return
  mouse.x = event.clientX
  mouse.y = event.clientY
  x.target = event.clientX
  x.current = event.clientX
  lastTarget = event.target
  visible.value = true

  pressed.value = ['left', 'middle', 'right'][event.button] || ''
  mode.value = detectMode(event.target)

  const id = ++seq
  ripples.value.push({
    id,
    x: event.clientX,
    y: event.clientY,
    kind: pressed.value
  })
  setTimeout(() => {
    ripples.value = ripples.value.filter(item => item.id !== id)
  }, 640)

  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressed.value = ''
    refreshMode()
  }, 220)
}

function onPointerUp() {
  if (!enabled.value) return
  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressed.value = ''
    refreshMode()
  }, 120)
}

function onContextMenu() {
  if (!enabled.value) return
  pressed.value = 'right'
  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressed.value = ''
    refreshMode()
  }, 420)
}

function onPointerLeave() {
  visible.value = false
  pressed.value = ''
}

function onPointerEnter() {
  if (enabled.value) visible.value = true
}

function onWindowBlur() {
  visible.value = false
}

function tick() {
  if (!enabled.value) return

  ring.x += (x.target - ring.x) * 0.22
  ring.y += (mouse.y - ring.y) * 0.22
  aura.x += (x.target - aura.x) * 0.075
  aura.y += (mouse.y - aura.y) * 0.075

  if (dotEl.value) {
    dotEl.value.style.transform = `translate3d(${x.current}px, ${mouse.y}px, 0) translate(-50%, -50%)`
  }
  if (ringEl.value) {
    ringEl.value.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)`
  }
  if (auraEl.value) {
    auraEl.value.style.transform = `translate3d(${aura.x}px, ${aura.y}px, 0) translate(-50%, -50%)`
  }
  if (badgeEl.value) {
    badgeEl.value.style.transform = `translate3d(${x.current + 20}px, ${mouse.y + 18}px, 0)`
  }

  raf = requestAnimationFrame(tick)
}

function evaluate() {
  const next = canUseCursor()
  if (next === enabled.value) return
  enabled.value = next
  document.documentElement.classList.toggle('cursor-none', next)

  if (next) {
    raf = requestAnimationFrame(tick)
  } else {
    cancelAnimationFrame(raf)
    raf = null
    visible.value = false
    pressed.value = ''
  }
}

function onMediaChange() {
  evaluate()
}

onMounted(() => {
  reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  pointerQuery = window.matchMedia('(pointer: fine)')
  evaluate()

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerdown', onPointerDown, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })
  window.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('blur', onWindowBlur)
  document.addEventListener('pointerleave', onPointerLeave)
  document.addEventListener('pointerenter', onPointerEnter)

  reduceQuery.addEventListener?.('change', onMediaChange)
  pointerQuery.addEventListener?.('change', onMediaChange)
})

watch(
  () => ui.cursorEnabled,
  () => evaluate()
)

watch(loading, () => {
  if (lastTarget) refreshMode()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.clearTimeout(pressTimer)
  document.documentElement.classList.remove('cursor-none')
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('contextmenu', onContextMenu)
  window.removeEventListener('blur', onWindowBlur)
  document.removeEventListener('pointerleave', onPointerLeave)
  document.removeEventListener('pointerenter', onPointerEnter)
  reduceQuery?.removeEventListener?.('change', onMediaChange)
  pointerQuery?.removeEventListener?.('change', onMediaChange)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="enabled"
      class="cursor-lab"
      :class="[
        `mode-${mode}`,
        pressed ? `pressed-${pressed}` : '',
        { 'is-visible': visible, 'has-badge': hasBadge }
      ]"
      aria-hidden="true"
    >
      <span ref="auraEl" class="cursor-aura"></span>

      <span ref="ringEl" class="cursor-ring">
        <span class="ring-shape">
          <i class="ring-cross x"></i>
          <i class="ring-cross y"></i>
        </span>
      </span>

      <span ref="dotEl" class="cursor-dot"></span>
      <span ref="badgeEl" class="cursor-badge">{{ badgeText }}</span>

      <span
        v-for="item in ripples"
        :key="item.id"
        class="cursor-ripple"
        :class="`kind-${item.kind}`"
        :style="{ left: `${item.x}px`, top: `${item.y}px` }"
      ></span>
    </div>
  </Teleport>
</template>

<style>
/* 自定义光标需要在全局 html 上关闭系统光标，故此处不使用 scoped */
html.cursor-none,
html.cursor-none * {
  cursor: none !important;
}
</style>

<style scoped>
.cursor-lab {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.cursor-lab.is-visible {
  opacity: 1;
}

.cursor-dot {
  position: fixed;
  left: 0;
  top: 0;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--primary);
  box-shadow: 0 0 10px var(--primary-glow);
  transition: background 0.16s ease, width 0.16s ease, height 0.16s ease;
  will-change: transform;
}

.cursor-ring {
  position: fixed;
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  will-change: transform;
}

.ring-shape {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 999px;
  border: 1.5px solid color-mix(in srgb, var(--primary) 55%, transparent);
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  transition:
    width 0.2s var(--ease-spring),
    height 0.2s var(--ease-spring),
    border-radius 0.2s ease,
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.16s ease;
}

.cursor-aura {
  position: fixed;
  left: 0;
  top: 0;
  width: 300px;
  height: 300px;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--primary) 16%, transparent) 0%,
    color-mix(in srgb, var(--lime) 8%, transparent) 46%,
    transparent 70%
  );
  filter: blur(18px);
  opacity: 0.55;
  will-change: transform;
}

:root.dark .cursor-aura {
  opacity: 0.4;
}

.cursor-badge {
  position: fixed;
  left: 0;
  top: 0;
  padding: 3px 7px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
  backdrop-filter: blur(10px);
  color: var(--text-2);
  font-size: 9.5px;
  letter-spacing: 0.02em;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.14s ease;
  box-shadow: var(--shadow-xs);
  will-change: transform;
}

.cursor-lab.has-badge .cursor-badge {
  opacity: 1;
}

/* ---------- 悬停 ---------- */
.mode-hover .ring-shape {
  width: 52px;
  height: 52px;
  background: color-mix(in srgb, var(--primary) 12%, transparent);
  border-color: color-mix(in srgb, var(--primary) 75%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 7%, transparent);
}

.mode-hover .cursor-dot {
  background: var(--primary-strong);
}

/* ---------- 文本 ---------- */
.mode-text .cursor-dot {
  opacity: 0;
}

.mode-text .ring-shape {
  width: 2px;
  height: 24px;
  border: none;
  border-radius: 2px;
  background: var(--primary);
  box-shadow: 0 0 8px var(--primary-glow);
}

.mode-text .cursor-badge {
  display: none;
}

/* ---------- 加载 ---------- */
.mode-loading .cursor-dot {
  opacity: 0;
}

.mode-loading .ring-shape {
  width: 38px;
  height: 38px;
  border: 2px solid color-mix(in srgb, var(--primary) 18%, transparent);
  border-top-color: var(--primary);
  border-right-color: var(--lime);
  background: transparent;
  animation: cursor-spin 0.72s linear infinite;
  box-shadow: 0 0 16px color-mix(in srgb, var(--primary) 18%, transparent);
}

.mode-loading .ring-cross {
  display: none;
}

@keyframes cursor-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 禁用态 ---------- */
.mode-disabled .ring-shape {
  width: 34px;
  height: 34px;
  border-style: dashed;
  border-color: color-mix(in srgb, var(--text-3) 55%, transparent);
  background: transparent;
}

.mode-disabled .cursor-dot {
  background: var(--text-3);
  box-shadow: none;
}

/* ---------- 按下：左键 ---------- */
.pressed-left .ring-shape {
  width: 26px;
  height: 26px;
  background: color-mix(in srgb, var(--primary) 26%, transparent);
  border-color: var(--primary);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--primary) 10%, transparent);
}

.pressed-left .cursor-dot {
  background: var(--primary);
}

/* ---------- 按下：右键 ---------- */
.pressed-right .ring-shape {
  width: 34px;
  height: 34px;
  background: color-mix(in srgb, var(--copper) 16%, transparent);
  border-color: var(--copper);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--copper) 10%, transparent);
}

.pressed-right .cursor-dot {
  background: var(--copper);
  box-shadow: 0 0 10px color-mix(in srgb, var(--copper) 60%, transparent);
}

/* ---------- 按下：中键 ---------- */
.pressed-middle .ring-shape {
  width: 34px;
  height: 34px;
  background: color-mix(in srgb, var(--lime) 18%, transparent);
  border-color: var(--lime-deep);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--lime) 12%, transparent);
}

.pressed-middle .cursor-dot {
  background: var(--lime-deep);
}

.ring-cross {
  display: none;
  position: absolute;
  background: var(--lime-deep);
  border-radius: 2px;
}

.pressed-middle .ring-cross {
  display: block;
}

.ring-cross.x {
  width: 12px;
  height: 1.5px;
}

.ring-cross.y {
  width: 1.5px;
  height: 12px;
}

/* ---------- 点击波纹 ---------- */
.cursor-ripple {
  position: fixed;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1.5px solid var(--primary);
  transform: translate(-50%, -50%);
  animation: cursor-ripple 0.62s var(--ease-out) forwards;
}

.cursor-ripple.kind-right {
  border-color: var(--copper);
}

.cursor-ripple.kind-middle {
  border-color: var(--lime-deep);
}

@keyframes cursor-ripple {
  0% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(0.4);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.8);
  }
}

@media (pointer: coarse) {
  .cursor-lab {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cursor-lab {
    display: none;
  }
}
</style>
