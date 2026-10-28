<!-- 自研加载组件：启动页 / 遮罩 / 行内 三种形态 -->
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BrandMark from './BrandMark.vue'
import BeakerLoader from './BeakerLoader.vue'
import ParticleField from './ParticleField.vue'

const props = defineProps({
  variant: { type: String, default: 'inline' }, // splash | overlay | inline
  label: { type: String, default: '正在加载' },
  hint: { type: String, default: '' },
  progress: { type: Number, default: null },
  size: { type: String, default: 'md' } // sm | md | lg
})

const isSplash = computed(() => props.variant === 'splash')
const isOverlay = computed(() => props.variant === 'overlay')

const percent = ref(0)
let frame = null

const stageText = computed(() => {
  if (percent.value >= 100) return '工作台已就绪'
  if (percent.value >= 72) return '正在点亮你的工作台'
  if (percent.value >= 36) return '正在注入设备与借用数据'
  return '正在连接实验室服务'
})

onMounted(() => {
  if (!isSplash.value) return
  const start = performance.now()
  const duration = 1350

  const tick = now => {
    const value = Math.min(100, ((now - start) / duration) * 100)
    percent.value = Math.round(value)
    if (value < 100) {
      frame = requestAnimationFrame(tick)
    }
  }

  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div v-if="isSplash" class="splash">
    <div class="splash-grid"></div>
    <ParticleField :density="72" class="splash-particles" />
    <span class="aurora aurora-a"></span>
    <span class="aurora aurora-b"></span>
    <span class="aurora aurora-c"></span>

    <div class="splash-inner">
      <div class="loader-orbit">
        <span class="ring ring-1"></span>
        <span class="ring ring-2"></span>
        <span class="ring ring-3"></span>
        <span class="ring-dot dot-1"></span>
        <span class="ring-dot dot-2"></span>
        <BeakerLoader :progress="percent" :size="108" :shake="percent >= 100" />
      </div>

      <div class="splash-copy">
        <h1>极光 · 实验室设备共享平台</h1>
        <p class="splash-label">
          {{ stageText }}
          <b>{{ percent }}%</b>
        </p>
        <span class="loading-dots"><i></i><i></i><i></i></span>
      </div>

      <div class="splash-progress">
        <i :style="{ width: `${percent}%` }"></i>
      </div>

      <div class="splash-foot">
        <span class="status-dot">{{ percent >= 100 ? '服务已就绪' : '正在准备实验资源' }}</span>
        <span class="version">v2.1 · AURORA</span>
      </div>
    </div>
  </div>

  <div v-else-if="isOverlay" class="overlay">
    <div class="overlay-card">
      <div class="loader-orbit small">
        <span class="ring ring-1"></span>
        <span class="ring ring-2"></span>
        <BrandMark :size="40" />
      </div>
      <p class="overlay-label">{{ label }}</p>
      <span v-if="hint" class="overlay-hint">{{ hint }}</span>
    </div>
  </div>

  <div v-else class="inline-loader" :class="`size-${size}`">
    <span class="spinner">
      <i></i>
    </span>
    <span class="inline-label">{{ label }}</span>
  </div>
</template>

<style scoped>
/* ---------- 启动页 ---------- */
.splash {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(900px 520px at 12% 0%, rgba(14, 124, 102, 0.34), transparent 60%),
    radial-gradient(760px 480px at 92% 100%, rgba(159, 191, 58, 0.26), transparent 62%),
    linear-gradient(150deg, #06110d 0%, #0b211a 55%, #07130f 100%);
}

.splash-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 54px 54px;
  mask-image: radial-gradient(circle at 50% 42%, #000 0%, transparent 74%);
}

.aurora {
  position: absolute;
  border-radius: 999px;
  filter: blur(80px);
  opacity: 0.55;
  animation: drift 14s var(--ease-in-out) infinite;
}

.aurora-a {
  width: 420px;
  height: 420px;
  left: 12%;
  top: 8%;
  background: radial-gradient(circle, rgba(14, 124, 102, 0.9), transparent 68%);
}

.aurora-b {
  width: 380px;
  height: 380px;
  right: 8%;
  bottom: 6%;
  background: radial-gradient(circle, rgba(159, 191, 58, 0.62), transparent 68%);
  animation-delay: -4s;
}

.aurora-c {
  width: 320px;
  height: 320px;
  left: 46%;
  top: 58%;
  background: radial-gradient(circle, rgba(184, 106, 69, 0.55), transparent 68%);
  animation-delay: -8s;
}

.splash-inner {
  position: relative;
  z-index: 1;
  width: min(420px, 82vw);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: #fff;
  animation: fade-in 0.6s ease both;
}

.loader-orbit {
  position: relative;
  width: 172px;
  height: 172px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.loader-orbit.small {
  width: 84px;
  height: 84px;
  margin-bottom: 14px;
}

.ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-top-color: rgba(127, 224, 195, 0.85);
  animation: spin 2.6s linear infinite;
}

.ring-2 {
  inset: 13px;
  border-top-color: rgba(194, 221, 99, 0.75);
  animation-duration: 4s;
  animation-direction: reverse;
}

.ring-3 {
  inset: 26px;
  border-top-color: rgba(240, 178, 122, 0.7);
  animation-duration: 6s;
}

.loader-orbit.small .ring-2 {
  inset: 9px;
}

.ring-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #7fe0c3;
  box-shadow: 0 0 14px 3px rgba(127, 224, 195, 0.65);
  animation: orbit-dot 3.4s linear infinite;
}

.dot-1 {
  top: -4px;
  transform-origin: 4px 78px;
}

.dot-2 {
  bottom: -4px;
  background: #c2dd63;
  box-shadow: 0 0 14px 3px rgba(194, 221, 99, 0.6);
  animation-delay: -1.7s;
  transform-origin: 4px -70px;
}

@keyframes orbit-dot {
  to {
    transform: rotate(360deg);
  }
}

.splash-logo {
  animation: logo-breathe 3s var(--ease-in-out) infinite;
}

@keyframes logo-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.06);
  }
}

.splash-copy h1 {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.splash-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.58);
  letter-spacing: 0.04em;
}

.splash-label b {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: #7fe0c3;
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  text-align: right;
}

.loading-dots {
  display: inline-flex;
  gap: 4px;
  margin-top: 8px;
}

.loading-dots i {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(142, 197, 255, 0.7);
  animation: loading-dot 1.2s var(--ease-in-out) infinite;
}

.loading-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.loading-dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes loading-dot {
  0%,
  100% {
    opacity: 0.25;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.splash-progress {
  position: relative;
  width: 100%;
  height: 3px;
  margin-top: 26px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.splash-progress i {
  display: block;
  height: 100%;
  width: 0;
  border-radius: inherit;
  background: linear-gradient(90deg, #7fe0c3, #c2dd63, #e29a72);
  box-shadow: 0 0 18px rgba(127, 224, 195, 0.7);
  transition: width 0.16s linear;
  position: relative;
  overflow: hidden;
}

.splash-progress i::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: translateX(-100%);
  animation: progress-shine 1.2s linear infinite;
}

@keyframes progress-shine {
  to {
    transform: translateX(100%);
  }
}

.splash-foot {
  width: 100%;
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.45);
}

.splash-foot .status-dot {
  color: rgba(255, 255, 255, 0.62);
}

.splash-foot .status-dot::before {
  background: #4ade80;
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.18);
}

.version {
  font-family: var(--font-mono);
  letter-spacing: 0.12em;
}

/* ---------- 遮罩 ---------- */
.overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  background: color-mix(in srgb, var(--bg-elevated) 62%, transparent);
  backdrop-filter: blur(8px);
  animation: fade-in 0.24s ease both;
}

.overlay-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 34px;
  border-radius: var(--radius-lg);
  background: var(--surface-solid);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
}

.overlay .ring {
  border-color: rgba(14, 124, 102, 0.18);
  border-top-color: var(--primary);
}

.overlay-label {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}

.overlay-hint {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--text-3);
}

/* ---------- 行内 ---------- */
.inline-loader {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  color: var(--text-3);
  font-size: 12.5px;
}

.spinner {
  position: relative;
  display: inline-flex;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: conic-gradient(from 90deg, transparent 0%, var(--primary) 78%, transparent 100%);
  animation: spin 0.85s linear infinite;
}

.spinner i {
  position: absolute;
  inset: 3px;
  border-radius: 999px;
  background: var(--bg-elevated);
}

.size-sm .spinner {
  width: 14px;
  height: 14px;
}

.size-sm {
  font-size: 11.5px;
}

.size-lg .spinner {
  width: 24px;
  height: 24px;
}
</style>
