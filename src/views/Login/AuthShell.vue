<script setup>
import BrandMark from '@/components/common/BrandMark.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import ParticleField from '@/components/common/ParticleField.vue'

defineProps({
  eyebrow: { type: String, default: 'AURORA LAB' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  backText: { type: String, default: '返回登录' },
  backTo: { type: String, default: '/login' },
  width: { type: String, default: '540px' }
})
</script>

<template>
  <div class="auth-shell">
    <div class="auth-aurora" aria-hidden="true">
      <span class="blob b1"></span>
      <span class="blob b2"></span>
      <span class="blob b3"></span>
    </div>
    <div class="auth-grid" aria-hidden="true"></div>
    <div class="auth-noise" aria-hidden="true"></div>
    <ParticleField :density="48" />

    <header class="auth-top">
      <router-link to="/login" class="auth-brand">
        <BrandMark :size="34" :mono="true" />
        <span>极光 · 实验室设备共享平台</span>
      </router-link>
      <ThemeToggle />
    </header>

    <main class="auth-main">
      <div class="auth-card" :style="{ maxWidth: width }">
        <router-link :to="backTo" class="back-link">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
            <path d="M10 3 5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ backText }}
        </router-link>

        <div class="auth-head">
          <span class="auth-eyebrow">{{ eyebrow }}</span>
          <h1>{{ title }}</h1>
          <p>{{ subtitle }}</p>
        </div>

        <slot />

        <div v-if="$slots.footer" class="auth-footer">
          <slot name="footer" />
        </div>
      </div>
    </main>

    <footer class="auth-bottom">
      <span>© {{ new Date().getFullYear() }} AURORA LAB · 极光实验室</span>
      <span class="auth-badge"><i></i>数据加密传输</span>
    </footer>
  </div>
</template>

<style scoped>
.auth-shell {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(900px 520px at 8% 0%, rgba(14, 124, 102, 0.4), transparent 64%),
    radial-gradient(760px 520px at 96% 100%, rgba(159, 191, 58, 0.24), transparent 64%),
    radial-gradient(680px 480px at 60% 40%, rgba(184, 106, 69, 0.2), transparent 66%),
    linear-gradient(155deg, #06110d 0%, #0b211a 52%, #07130f 100%);
}

.auth-aurora {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 999px;
  filter: blur(100px);
  opacity: 0.5;
  animation: drift 20s var(--ease-in-out) infinite;
}

.b1 {
  width: 460px;
  height: 460px;
  left: -8%;
  top: 4%;
  background: radial-gradient(circle, rgba(14, 124, 102, 0.85), transparent 68%);
}

.b2 {
  width: 380px;
  height: 380px;
  right: -6%;
  bottom: 8%;
  background: radial-gradient(circle, rgba(159, 191, 58, 0.55), transparent 68%);
  animation-delay: -7s;
}

.b3 {
  width: 320px;
  height: 320px;
  left: 52%;
  top: 4%;
  background: radial-gradient(circle, rgba(184, 106, 69, 0.5), transparent 68%);
  animation-delay: -12s;
}

.auth-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 58px 58px;
  mask-image: radial-gradient(circle at 50% 42%, #000 0%, transparent 76%);
  pointer-events: none;
}

.auth-noise {
  position: absolute;
  inset: 0;
  opacity: 0.03;
  pointer-events: none;
  background-image: radial-gradient(rgba(255, 255, 255, 0.9) 0.5px, transparent 0.5px);
  background-size: 3px 3px;
}

.auth-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 34px;
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 12.5px;
  letter-spacing: 0.01em;
}

.auth-main {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 20px 32px;
}

.auth-card {
  position: relative;
  width: 100%;
  padding: 30px 36px 28px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--surface-solid) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
  box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  backdrop-filter: blur(22px) saturate(150%);
  animation: auth-in 0.6s var(--ease-out) both;
}

@keyframes auth-in {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 14px;
  transition: gap var(--dur-fast) ease, color var(--dur-fast) ease;
}

.back-link:hover {
  color: var(--primary);
  gap: 7px;
}

.auth-head {
  margin-bottom: 22px;
}

.auth-eyebrow {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.2em;
  color: var(--primary);
  margin-bottom: 8px;
}

.auth-head h1 {
  margin: 0 0 5px;
  font-size: 26px;
  letter-spacing: -0.028em;
  color: var(--text-1);
}

.auth-head p {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}

.auth-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-soft);
  text-align: center;
  font-size: 12.5px;
  color: var(--text-3);
}

.auth-bottom {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 34px 20px;
  font-size: 10.5px;
  color: rgba(255, 255, 255, 0.34);
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  letter-spacing: 0;
}

.auth-badge i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.7);
}

:deep(.el-form-item) {
  margin-bottom: 16px;
}

:deep(.el-form-item__label) {
  font-size: 12.5px;
  padding-bottom: 4px;
}

:deep(.el-input__wrapper) {
  height: 44px;
  border-radius: 11px;
}

@media (max-width: 640px) {
  .auth-top {
    padding: 18px;
  }

  .auth-brand span {
    display: none;
  }

  .auth-card {
    padding: 24px 20px 22px;
    border-radius: 20px;
  }

  .auth-head h1 {
    font-size: 23px;
  }

  .auth-bottom {
    padding: 12px 18px 18px;
  }
}
</style>
