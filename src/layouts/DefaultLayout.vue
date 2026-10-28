<script setup>
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import BrandMark from '@/components/common/BrandMark.vue'
import ParticleField from '@/components/common/ParticleField.vue'
import { useUserStore } from '@/stores/useUserStore'

const route = useRoute()
const userStore = useUserStore()

const isBlacklisted = computed(() => Boolean(userStore.userInfo?.blacklisted))
const blacklistReason = computed(
  () => userStore.userInfo?.blacklist_reason || '请联系实验室管理员了解详情'
)
</script>

<template>
  <div class="student-layout">
    <div class="layout-aurora" aria-hidden="true">
      <span class="glow glow-a"></span>
      <span class="glow glow-b"></span>
      <span class="grid-mask"></span>
      <ParticleField :density="30" class="layout-particles" />
    </div>

    <AppHeader />

    <main class="layout-main">
      <div v-if="isBlacklisted" class="blacklist-banner">
        <span class="banner-icon"><el-icon><WarningFilled /></el-icon></span>
        <div class="banner-copy">
          <strong>账号借用权限已受限</strong>
          <span>{{ blacklistReason }}。你仍可查看设备与历史记录，但无法提交新的借用或续借申请。</span>
        </div>
        <router-link to="/student/profile" class="banner-link">查看详情</router-link>
      </div>

      <RouterView v-slot="{ Component }">
        <Transition name="route" mode="out-in">
          <component :is="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </main>

    <footer class="app-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <BrandMark :size="28" :glow="false" />
          <span>极光 · 实验室设备共享平台</span>
        </div>
        <div class="footer-links">
          <a href="#help">使用帮助</a>
          <a href="#rules">借用规则</a>
          <router-link to="/design">设计系统</router-link>
          <a href="#privacy">隐私政策</a>
        </div>
        <div class="footer-meta">
          <span class="status-dot">平台运行正常</span>
          <span class="copyright">© {{ new Date().getFullYear() }} AURORA LAB</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.student-layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  isolation: isolate;
}

.layout-aurora {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(120px);
  opacity: 0.34;
  animation: drift 22s var(--ease-in-out) infinite;
}

.glow-a {
  width: 520px;
  height: 520px;
  left: -140px;
  top: 8%;
  background: radial-gradient(circle, rgba(14, 124, 102, 0.5), transparent 68%);
}

.glow-b {
  width: 460px;
  height: 460px;
  right: -120px;
  top: 46%;
  background: radial-gradient(circle, rgba(159, 191, 58, 0.4), transparent 68%);
  animation-delay: -8s;
}

:root.dark .glow {
  opacity: 0.24;
}

.grid-mask {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(color-mix(in srgb, var(--border) 46%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--border) 46%, transparent) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, #000 0%, transparent 76%);
  opacity: 0.5;
}

.layout-main {
  flex: 1;
  min-height: calc(100vh - var(--header-h));
}

.blacklist-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 18px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--red) 24%, transparent);
  background:
    radial-gradient(300px 100px at 0% 0%, color-mix(in srgb, var(--red) 10%, transparent), transparent 70%),
    var(--red-soft);
  box-shadow: var(--shadow-xs);
  animation: fade-up 0.4s var(--ease-out) both;
}

.banner-icon {
  width: 34px;
  height: 34px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: var(--red);
  background: color-mix(in srgb, var(--red) 12%, transparent);
  font-size: 16px;
}

.banner-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.banner-copy strong {
  font-size: 12.5px;
  color: var(--red);
}

.banner-copy span {
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-2);
}

.banner-link {
  flex: none;
  font-size: 11.5px;
  color: var(--red);
  text-decoration: none;
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--red) 22%, transparent);
  background: color-mix(in srgb, var(--red) 6%, transparent);
}

.banner-link:hover {
  background: color-mix(in srgb, var(--red) 12%, transparent);
}

.app-footer {
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--bg-elevated) 54%, transparent);
  backdrop-filter: blur(12px);
}

.footer-inner {
  max-width: 1480px;
  margin: 0 auto;
  padding: 20px 34px 24px;
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-2);
  font-weight: 500;
}

.footer-links {
  display: flex;
  gap: 18px;
  font-size: 12px;
}

.footer-links a {
  color: var(--text-3);
}

.footer-links a:hover {
  color: var(--primary);
}

.footer-meta {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 18px;
  font-size: 11.5px;
  color: var(--text-3);
}

.copyright {
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
  font-size: 10.5px;
}

@media (max-width: 900px) {
  .footer-inner {
    padding: 18px 16px 22px;
    gap: 14px;
  }

  .footer-links {
    order: 3;
    width: 100%;
  }

  .footer-meta {
    margin-left: auto;
  }

  .copyright {
    display: none;
  }
}
</style>
