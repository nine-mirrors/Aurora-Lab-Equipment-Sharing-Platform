<!-- 烧杯加载动画：溶液注满 + 气泡 + 完成时轻摇 -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: { type: Number, default: 0 },
  size: { type: Number, default: 96 },
  shake: { type: Boolean, default: false }
})

const uid = `bk-${Math.random().toString(36).slice(2, 8)}`
const value = computed(() => Math.max(0, Math.min(100, Number(props.progress) || 0)))
const liquidY = computed(() => 110 - value.value * 0.8)
const active = computed(() => value.value >= 100 || props.shake)
</script>

<template>
  <div
    class="beaker-loader"
    :class="{ shaking: active }"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <span class="beaker-glow"></span>

    <svg viewBox="0 0 120 120" fill="none" class="beaker-svg">
      <defs>
        <linearGradient :id="`stroke-${uid}`" x1="26" y1="18" x2="94" y2="106" gradientUnits="userSpaceOnUse">
          <stop stop-color="#7fe0c3" />
          <stop offset="0.5" stop-color="#c2dd63" />
          <stop offset="1" stop-color="#5fd0b0" />
        </linearGradient>

        <linearGradient :id="`liquid-${uid}`" x1="60" y1="30" x2="60" y2="108" gradientUnits="userSpaceOnUse">
          <stop stop-color="#7fe0c3" />
          <stop offset="0.45" stop-color="#4fae8a" />
          <stop offset="1" stop-color="#9fbf3a" />
        </linearGradient>

        <clipPath :id="`clip-${uid}`">
          <path d="M52 24 v20 L30 94 a7 7 0 0 0 6 11 h48 a7 7 0 0 0 6-11 L68 44 V24 Z" />
        </clipPath>

        <filter :id="`blur-${uid}`" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>

      <!-- 杯身 -->
      <g class="beaker-flask">
        <path
          d="M49 18h22M52 18v20L30 94a7 7 0 0 0 6 11h48a7 7 0 0 0 6-11L68 44V18"
          :stroke="`url(#stroke-${uid})`"
          stroke-width="2.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M44 18h32" :stroke="`url(#stroke-${uid})`" stroke-width="2.6" stroke-linecap="round" />

        <!-- 刻度 -->
        <g stroke="rgba(255,255,255,0.28)" stroke-width="1.2" stroke-linecap="round">
          <path d="M38 78h7" />
          <path d="M34 88h7" />
          <path d="M31 98h6" />
        </g>

        <!-- 液体 -->
        <g :clip-path="`url(#clip-${uid})`">
          <rect
            x="20"
            :y="liquidY"
            width="80"
            height="120"
            :fill="`url(#liquid-${uid})`"
            opacity="0.82"
          />

          <g :style="{ transform: `translateY(${liquidY - 6}px)` }">
            <g class="wave">
              <path
                d="M-60 8 Q-50 1 -40 8 T-20 8 T0 8 T20 8 T40 8 T60 8 T80 8 T100 8 T120 8 V26 H-60 Z"
                fill="#7fe0c3"
                opacity="0.55"
              />
            </g>
          </g>

          <g :filter="`url(#blur-${uid})`" opacity="0.7">
            <circle class="bubble b1" cx="50" cy="96" r="2.6" fill="#eafff7" />
            <circle class="bubble b2" cx="64" cy="100" r="1.9" fill="#eafff7" />
            <circle class="bubble b3" cx="57" cy="98" r="1.5" fill="#eafff7" />
            <circle class="bubble b4" cx="72" cy="94" r="2.1" fill="#eafff7" />
          </g>

          <path d="M43 60 L33 90" stroke="rgba(255,255,255,0.5)" stroke-width="2.4" stroke-linecap="round" opacity="0.55" />
        </g>

        <!-- 杯口高光 -->
        <ellipse cx="60" cy="18" rx="9" ry="2.4" fill="rgba(255,255,255,0.35)" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.beaker-loader {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

.beaker-glow {
  position: absolute;
  inset: 8%;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(127, 224, 195, 0.42), rgba(159, 191, 58, 0.15) 58%, transparent 72%);
  filter: blur(12px);
  animation: beaker-pulse 2.8s var(--ease-in-out) infinite;
  pointer-events: none;
}

.beaker-svg {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.beaker-flask {
  transform-origin: 60px 70px;
}

.beaker-loader.shaking .beaker-svg {
  animation: beaker-shake 0.9s var(--ease-in-out) 1;
}

@keyframes beaker-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes beaker-shake {
  0%,
  100% {
    transform: rotate(0deg);
  }
  18% {
    transform: rotate(-5deg);
  }
  38% {
    transform: rotate(4deg);
  }
  58% {
    transform: rotate(-3deg);
  }
  78% {
    transform: rotate(2deg);
  }
}

.wave {
  animation: wave-slide 3.2s linear infinite;
}

@keyframes wave-slide {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(40px);
  }
}

.bubble {
  transform-box: fill-box;
  transform-origin: center;
  animation: bubble-up 2.4s ease-in infinite;
}

.b2 {
  animation-delay: 0.5s;
  animation-duration: 3s;
}

.b3 {
  animation-delay: 1.1s;
  animation-duration: 2.1s;
}

.b4 {
  animation-delay: 1.7s;
  animation-duration: 3.4s;
}

@keyframes bubble-up {
  0% {
    opacity: 0;
    transform: translateY(4px) scale(0.6);
  }
  25% {
    opacity: 0.9;
  }
  80% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
    transform: translateY(-42px) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .beaker-glow,
  .wave,
  .bubble,
  .beaker-loader.shaking .beaker-svg {
    animation: none;
  }
}
</style>
