<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useUiStore } from '@/stores/Ui'

const ui = useUiStore()
const visible = ref(false)
const progress = ref(0)
let hideTimer = null
let creepTimer = null

function start() {
  clearTimeout(hideTimer)
  clearInterval(creepTimer)
  progress.value = 12
  visible.value = true

  creepTimer = setInterval(() => {
    if (progress.value < 82) {
      progress.value += Math.random() * 8 + 2
    }
  }, 260)
}

function finish() {
  clearInterval(creepTimer)
  progress.value = 100
  hideTimer = setTimeout(() => {
    visible.value = false
    setTimeout(() => {
      progress.value = 0
    }, 260)
  }, 260)
}

watch(
  () => ui.routeLoading,
  value => {
    if (value) start()
    else finish()
  }
)

onBeforeUnmount(() => {
  clearTimeout(hideTimer)
  clearInterval(creepTimer)
})
</script>

<template>
  <transition name="progress-fade">
    <div v-if="visible" class="route-progress">
      <span class="bar" :style="{ width: `${progress}%` }"></span>
    </div>
  </transition>
</template>

<style scoped>
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2.5px;
  z-index: 4000;
  pointer-events: none;
  background: transparent;
}

.bar {
  display: block;
  height: 100%;
  border-radius: 0 999px 999px 0;
  background: linear-gradient(90deg, #16967b, #c2dd63 55%, #e29a72);
  box-shadow: 0 0 14px rgba(14, 124, 102, 0.55);
  transition: width var(--dur) var(--ease-out);
}

.progress-fade-leave-active {
  transition: opacity var(--dur-fast) ease;
}

.progress-fade-leave-to {
  opacity: 0;
}
</style>
