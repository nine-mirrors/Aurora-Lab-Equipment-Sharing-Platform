<!-- 粒子光效：漂浮光点 + 微光呼吸 + 鼠标视差 -->
<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  density: { type: Number, default: 38 },
  interactive: { type: Boolean, default: true },
  speed: { type: Number, default: 1 }
})

const canvasRef = ref(null)
let ctx = null
let frame = null
let particles = []
let width = 0
let height = 0
let dpr = 1
let pointer = { x: 0, y: 0, tx: 0, ty: 0 }
let visible = true
const palette = ['#7fe0c3', '#c2dd63', '#f0b27a', '#9fd8c8', '#ffffff']

function random(min, max) {
  return min + Math.random() * (max - min)
}

function createParticle() {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    r: random(0.7, 2.2),
    vx: random(-0.16, 0.16) * props.speed,
    vy: random(-0.24, -0.05) * props.speed,
    alpha: random(0.16, 0.6),
    phase: Math.random() * Math.PI * 2,
    twinkle: random(0.008, 0.022),
    color: palette[Math.floor(Math.random() * palette.length)],
    depth: random(0.3, 1)
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  width = Math.max(1, rect.width)
  height = Math.max(1, rect.height)
  dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const scale = Math.min(1, (width + 420) / 1400)
  const count = Math.max(16, Math.round(props.density * scale))
  particles = Array.from({ length: count }, createParticle)
}

function draw() {
  if (!ctx || !visible) {
    frame = null
    return
  }
  ctx.clearRect(0, 0, width, height)

  pointer.x += (pointer.tx - pointer.x) * 0.05
  pointer.y += (pointer.ty - pointer.y) * 0.05

  particles.forEach(p => {
    p.x += p.vx
    p.y += p.vy
    p.phase += p.twinkle

    if (p.y < -12) {
      p.y = height + 10
      p.x = Math.random() * width
    }
    if (p.x < -12) p.x = width + 10
    if (p.x > width + 12) p.x = -10

    const alpha = p.alpha * (0.62 + Math.sin(p.phase) * 0.38)
    const px = p.x + pointer.x * p.depth
    const py = p.y + pointer.y * p.depth

    ctx.beginPath()
    ctx.arc(px, py, p.r, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.globalAlpha = alpha
    ctx.shadowColor = p.color
    ctx.shadowBlur = p.r * 6
    ctx.fill()

    if (p.r > 1.8) {
      ctx.globalAlpha = alpha * 0.32
      ctx.beginPath()
      ctx.arc(px, py, p.r * 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
  })

  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
  frame = requestAnimationFrame(draw)
}

function onPointerMove(event) {
  if (!props.interactive) return
  pointer.tx = (event.clientX / window.innerWidth - 0.5) * -28
  pointer.ty = (event.clientY / window.innerHeight - 0.5) * -18
}

function onVisibility() {
  visible = !document.hidden
  if (visible && !frame) {
    frame = requestAnimationFrame(draw)
  }
}

onMounted(() => {
  visible = !document.hidden
  resize()
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', onPointerMove, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    draw()
    cancelAnimationFrame(frame)
    frame = null
  } else {
    frame = requestAnimationFrame(draw)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  frame = null
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', onPointerMove)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <canvas ref="canvasRef" class="particle-field" aria-hidden="true"></canvas>
</template>

<style scoped>
.particle-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>
