<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [Number, String], default: 0 },
  unit: { type: String, default: '' },
  hint: { type: String, default: '' },
  tone: { type: String, default: 'primary' },
  precision: { type: Number, default: 0 },
  trend: { type: Number, default: null },
  spark: { type: Array, default: () => [] }
})

const display = ref(0)
let frame = null

function animate(target) {
  const to = Number(target) || 0
  const from = Number(display.value) || 0
  const duration = 720
  const start = performance.now()

  cancelAnimationFrame(frame)

  const step = now => {
    const progress = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    display.value = Number((from + (to - from) * eased).toFixed(props.precision))
    if (progress < 1) frame = requestAnimationFrame(step)
  }

  frame = requestAnimationFrame(step)
}

watch(() => props.value, animate, { immediate: true })

onBeforeUnmount(() => cancelAnimationFrame(frame))

const formatted = computed(() => {
  const value = Number(display.value) || 0
  if (Math.abs(value) >= 10000) return value.toLocaleString('zh-CN')
  return display.value
})

const trendInfo = computed(() => {
  if (props.trend === null || props.trend === undefined) return null
  const up = Number(props.trend) >= 0
  return {
    up,
    text: `${up ? '+' : ''}${props.trend}%`
  }
})

const sparkPoints = computed(() => {
  if (!props.spark?.length) return []
  const values = props.spark.map(Number)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  return values.map((value, index) => ({
    x: (index / Math.max(1, values.length - 1)) * 100,
    y: 30 - ((value - min) / range) * 24
  }))
})

const sparkLine = computed(() => sparkPoints.value.map(p => `${p.x},${p.y}`).join(' '))

const sparkArea = computed(() => {
  if (!sparkPoints.value.length) return ''
  return `0,34 ${sparkLine.value} 100,34`
})
</script>

<template>
  <div v-spotlight v-tilt class="stat-card card" :class="[`tone-${tone}`, { 'has-spark': sparkPoints.length }]">
    <div class="stat-icon">
      <slot name="icon">
        <el-icon><DataLine /></el-icon>
      </slot>
    </div>

    <div class="stat-body">
      <div class="stat-top">
        <span class="stat-label">{{ label }}</span>
        <span v-if="trendInfo" class="stat-trend" :class="{ down: !trendInfo.up }">
          <svg viewBox="0 0 12 12" width="10" height="10">
            <path
              :d="trendInfo.up ? 'M6 1.5 10.5 8H1.5L6 1.5Z' : 'M6 10.5 1.5 4h9L6 10.5Z'"
              fill="currentColor"
            />
          </svg>
          {{ trendInfo.text }}
        </span>
      </div>

      <div class="stat-value">
        {{ formatted }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
      </div>

      <span v-if="hint" class="stat-hint">{{ hint }}</span>
    </div>

    <svg v-if="sparkPoints.length" class="spark" viewBox="0 0 100 34" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`spark-${tone}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--tone)" stop-opacity="0.28" />
          <stop offset="100%" stop-color="var(--tone)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon :points="sparkArea" :fill="`url(#spark-${tone})`" />
      <polyline
        :points="sparkLine"
        fill="none"
        stroke="var(--tone)"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  </div>
</template>

<style scoped>
.stat-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
  overflow: hidden;
  --tone: var(--primary);
  --tone-soft: var(--primary-soft);
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: color-mix(in srgb, var(--tone) 30%, var(--border));
}

.stat-card::after {
  content: "";
  position: absolute;
  right: -34px;
  top: -38px;
  width: 116px;
  height: 116px;
  border-radius: 999px;
  opacity: 0.55;
  background: radial-gradient(circle, var(--tone-soft) 0%, transparent 70%);
  pointer-events: none;
}

.stat-icon {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--tone);
  background: var(--tone-soft);
  border: 1px solid color-mix(in srgb, var(--tone) 14%, transparent);
  transition: transform var(--dur) var(--ease-spring);
}

.stat-card:hover .stat-icon {
  transform: scale(1.06) rotate(-3deg);
}

.stat-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  position: relative;
  z-index: 1;
}

.has-spark .stat-body {
  padding-right: 62px;
}

.stat-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.stat-label {
  font-size: 12.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--green);
  background: var(--green-soft);
  flex: none;
}

.stat-trend.down {
  color: var(--red);
  background: var(--red-soft);
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.22;
  letter-spacing: -0.03em;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.stat-unit {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.stat-hint {
  font-size: 11.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.spark {
  position: absolute;
  right: 10px;
  bottom: 8px;
  width: 72px;
  height: 30px;
  opacity: 0.55;
  z-index: 0;
  pointer-events: none;
}

.tone-primary { --tone: var(--primary); --tone-soft: var(--primary-soft); }
.tone-cyan { --tone: var(--cyan); --tone-soft: var(--cyan-soft); }
.tone-amber { --tone: var(--amber); --tone-soft: var(--amber-soft); }
.tone-green { --tone: var(--green); --tone-soft: var(--green-soft); }
.tone-red { --tone: var(--red); --tone-soft: var(--red-soft); }
.tone-violet { --tone: var(--violet); --tone-soft: var(--violet-soft); }

@media (max-width: 768px) {
  .stat-card {
    padding: 13px 14px;
    gap: 10px;
    border-radius: var(--radius-md);
  }

  .stat-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    font-size: 16px;
  }

  .has-spark .stat-body {
    padding-right: 0;
  }

  .spark {
    display: none;
  }

  .stat-label {
    font-size: 11.5px;
  }

  .stat-value {
    font-size: 22px;
  }

  .stat-unit {
    font-size: 11px;
  }

  .stat-hint {
    font-size: 10px;
  }
}
</style>
