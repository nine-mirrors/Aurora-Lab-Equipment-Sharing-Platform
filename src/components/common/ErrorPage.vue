<script setup>
import ParticleField from './ParticleField.vue'

defineProps({
  code: { type: String, default: '404' },
  title: { type: String, default: '页面走丢了' },
  description: { type: String, default: '' },
  accent: { type: String, default: 'primary' }
})
</script>

<template>
  <div class="error-page">
    <div class="error-aurora a"></div>
    <div class="error-aurora b"></div>
    <div class="error-grid"></div>
    <ParticleField :density="40" />

    <div class="error-inner">
      <div class="error-visual">
        <span class="ring ring-1"></span>
        <span class="ring ring-2"></span>
        <span class="ring ring-3"></span>
        <span class="code">{{ code }}</span>
        <span class="floating f1"></span>
        <span class="floating f2"></span>
        <span class="floating f3"></span>
      </div>

      <h1>{{ title }}</h1>
      <p>{{ description }}</p>

      <div class="error-actions">
        <slot name="actions" />
      </div>

      <span class="error-foot">AURORA LAB · 运行状态实时监控</span>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 40px 20px;
  background:
    radial-gradient(900px 520px at 50% -10%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 62%),
    var(--bg-canvas);
}

.error-aurora {
  position: absolute;
  width: 460px;
  height: 460px;
  border-radius: 999px;
  filter: blur(90px);
  opacity: 0.4;
  pointer-events: none;
}

.error-aurora.a {
  left: 4%;
  top: 8%;
  background: radial-gradient(circle, var(--primary), transparent 68%);
  animation: drift 16s var(--ease-in-out) infinite;
}

.error-aurora.b {
  right: 4%;
  bottom: 2%;
  background: radial-gradient(circle, var(--violet), transparent 68%);
  animation: drift 20s var(--ease-in-out) infinite reverse;
}

.error-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--border-soft) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-soft) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(circle at 50% 40%, #000 0%, transparent 72%);
  opacity: 0.7;
  pointer-events: none;
}

.error-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 520px;
  animation: fade-in 0.5s var(--ease-out) both;
}

.error-visual {
  position: relative;
  width: 240px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.code {
  font-family: var(--font-mono);
  font-size: 92px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.06em;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 12px 34px var(--primary-glow));
  animation: float-y 5s var(--ease-in-out) infinite;
}

.ring {
  position: absolute;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
  animation: spin 26s linear infinite;
}

.ring-1 {
  width: 230px;
  height: 230px;
  border-style: dashed;
}

.ring-2 {
  width: 280px;
  height: 280px;
  opacity: 0.5;
  animation-direction: reverse;
  animation-duration: 34s;
}

.ring-3 {
  width: 180px;
  height: 180px;
  border-color: color-mix(in srgb, var(--violet) 26%, transparent);
  animation-duration: 18s;
}

.floating {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 3px;
  background: var(--gradient-aurora);
  opacity: 0.75;
  animation: float-y 4s var(--ease-in-out) infinite;
}

.f1 {
  left: 16px;
  top: 34px;
}

.f2 {
  right: 26px;
  top: 24px;
  animation-delay: -1.2s;
}

.f3 {
  right: 48px;
  bottom: 26px;
  animation-delay: -2.4s;
}

h1 {
  margin: 0 0 8px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1);
}

p {
  margin: 0 0 26px;
  max-width: 420px;
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--text-3);
}

.error-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.error-foot {
  margin-top: 34px;
  font-size: 10.5px;
  letter-spacing: 0.18em;
  font-family: var(--font-mono);
  color: var(--text-3);
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .code,
  .ring,
  .floating,
  .error-aurora {
    animation: none;
  }
}
</style>
