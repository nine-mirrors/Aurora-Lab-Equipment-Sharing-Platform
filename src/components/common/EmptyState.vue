<script setup>
defineProps({
  title: { type: String, default: '暂无数据' },
  description: { type: String, default: '' },
  actionText: { type: String, default: '' },
  compact: { type: Boolean, default: false }
})

defineEmits(['action'])
</script>

<template>
  <div class="empty-state" :class="{ compact }">
    <div class="empty-visual">
      <span class="orbit"></span>
      <span class="orbit orbit-2"></span>
      <svg viewBox="0 0 120 100" fill="none" class="empty-svg">
        <defs>
          <linearGradient id="empty-box" x1="24" y1="30" x2="96" y2="86" gradientUnits="userSpaceOnUse">
            <stop stop-color="var(--primary)" stop-opacity="0.9" />
            <stop offset="1" stop-color="var(--violet)" stop-opacity="0.55" />
          </linearGradient>
        </defs>
        <path d="M60 24 96 42 60 60 24 42 60 24Z" fill="url(#empty-box)" fill-opacity="0.18" stroke="url(#empty-box)" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M24 42v26l36 18V60L24 42Z" fill="var(--primary)" fill-opacity="0.1" stroke="url(#empty-box)" stroke-width="1.6" stroke-linejoin="round" />
        <path d="M96 42v26L60 86V60l36-18Z" fill="var(--violet)" fill-opacity="0.08" stroke="url(#empty-box)" stroke-width="1.6" stroke-linejoin="round" />
        <circle cx="60" cy="42" r="4.5" fill="var(--primary)" />
        <circle cx="94" cy="22" r="2.4" fill="var(--primary)" fill-opacity="0.6" />
        <circle cx="26" cy="74" r="2" fill="var(--violet)" fill-opacity="0.6" />
      </svg>
    </div>

    <strong>{{ title }}</strong>
    <p v-if="description">{{ description }}</p>
    <slot name="action">
      <el-button v-if="actionText" type="primary" plain size="small" @click="$emit('action')">
        {{ actionText }}
      </el-button>
    </slot>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 52px 24px;
  color: var(--text-3);
}

.empty-state.compact {
  padding: 26px 16px;
}

.empty-visual {
  position: relative;
  width: 132px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.orbit {
  position: absolute;
  width: 118px;
  height: 118px;
  border-radius: 999px;
  border: 1px dashed color-mix(in srgb, var(--primary) 26%, transparent);
  animation: spin 22s linear infinite;
}

.orbit-2 {
  width: 88px;
  height: 88px;
  border-style: solid;
  opacity: 0.5;
  animation-direction: reverse;
  animation-duration: 16s;
}

.empty-svg {
  width: 108px;
  height: 92px;
  animation: float-y 4.5s var(--ease-in-out) infinite;
}

.empty-state strong {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 4px;
}

.empty-state.compact strong {
  font-size: 13.5px;
}

.empty-state p {
  margin: 0 0 16px;
  max-width: 340px;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-3);
}

.empty-state :deep(.el-button) {
  margin-top: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .orbit,
  .empty-svg {
    animation: none;
  }
}
</style>
