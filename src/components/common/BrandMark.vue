<script setup>
defineProps({
  size: { type: Number, default: 36 },
  glow: { type: Boolean, default: true },
  mono: { type: Boolean, default: false }
})
</script>

<template>
  <span class="brand-mark" :class="{ 'is-mono': mono, 'has-glow': glow }" :style="{ width: `${size}px`, height: `${size}px`, borderRadius: `${size * 0.3}px` }">
    <svg viewBox="0 0 24 24" fill="none" :style="{ width: `${size * 0.56}px`, height: `${size * 0.56}px` }">
      <path
        d="M9 3h6M10 3v5.6l-4.8 8.2A2 2 0 0 0 6.9 20h10.2a2 2 0 0 0 1.7-3.2L14 8.6V3"
        stroke="currentColor"
        stroke-width="1.9"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M7.6 14.4h8.8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style scoped>
.brand-mark {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: #fff;
  background: var(--gradient-aurora);
  box-shadow: 0 8px 20px -8px rgba(14, 124, 102, 0.65);
}

.brand-mark::after {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: inherit;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.32), transparent 52%);
  pointer-events: none;
}

.brand-mark.has-glow {
  box-shadow: 0 10px 26px -8px rgba(14, 124, 102, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.12) inset;
}

.brand-mark.is-mono {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16) inset;
}
</style>
