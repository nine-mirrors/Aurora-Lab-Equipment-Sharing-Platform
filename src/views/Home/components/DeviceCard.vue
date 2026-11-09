<!-- 设备大厅：设备卡片 -->
<script setup>
import { computed } from 'vue'
import { ArrowRight, Box, Location, Star, StarFilled, Tools } from '@element-plus/icons-vue'
import StatusPill from '@/components/common/StatusPill.vue'
import {
  actionText,
  canApply,
  categoryInitial,
  devicePillStatus,
  isRepairing,
  stockPercent
} from '@/utils/device-presenter'

const props = defineProps({
  device: { type: Object, required: true },
  favorite: { type: Boolean, default: false },
  activeStatus: { type: Object, default: null },
  blacklisted: { type: Boolean, default: false },
  accent: { type: String, default: '#0e7c66' },
  index: { type: Number, default: 0 },
  listMode: { type: Boolean, default: false }
})

const emit = defineEmits(['open', 'toggle-favorite', 'apply'])

const percent = computed(() => stockPercent(props.device))
const repairing = computed(() => isRepairing(props.device))
const pillStatus = computed(() => props.activeStatus?.status || devicePillStatus(props.device))
const applyEnabled = computed(() =>
  canApply(props.device, { blacklisted: props.blacklisted, activeStatus: props.activeStatus })
)
const action = computed(() =>
  actionText(props.device, { blacklisted: props.blacklisted, activeStatus: props.activeStatus })
)

const stockStyle = computed(() => ({ transform: `scaleX(${percent.value / 100})` }))
const stockTone = computed(() => {
  if (percent.value <= 0) return 'is-empty'
  if (percent.value <= 40) return 'is-low'
  return 'is-ok'
})
</script>

<template>
  <article
    v-spotlight
    v-tilt
    class="device-card card card-hover"
    :class="{ 'is-list': listMode }"
    :style="{ animationDelay: `${Math.min(index, 8) * 45}ms` }"
    data-cursor-label="查看设备"
    @click="emit('open', device)"
  >
    <div class="device-top">
      <span
        class="device-icon"
        :style="{
          color: accent,
          background: `color-mix(in srgb, ${accent} 12%, transparent)`
        }"
      >
        <img
          v-if="device.image"
          :src="device.image"
          alt=""
          class="device-thumb"
          width="38"
          height="38"
          loading="lazy"
          decoding="async"
        />
        <template v-else>{{ categoryInitial(device.category) }}</template>
      </span>
      <span class="device-category">{{ device.category }}</span>
      <button
        type="button"
        class="fav-btn"
        :class="{ on: favorite }"
        :aria-label="favorite ? `取消收藏 ${device.name}` : `收藏 ${device.name}`"
        :aria-pressed="favorite"
        @click.stop="emit('toggle-favorite', device)"
      >
        <el-icon><StarFilled v-if="favorite" /><Star v-else /></el-icon>
      </button>
      <StatusPill :status="pillStatus" size="sm" />
    </div>

    <div class="device-body">
      <h3>{{ device.name }}</h3>
      <p class="device-desc">{{ device.description || '暂无设备描述' }}</p>

      <div v-if="device.maintenance_status !== 'none'" class="maint-note">
        <el-icon><Tools /></el-icon>
        <span v-if="repairing">
          维护中：{{ device.maintenance_reason || '设备检修' }}，暂时停止借用
        </span>
        <span v-else>已提交报修：{{ device.maintenance_reason || '待管理员处理' }}</span>
      </div>

      <div v-if="device.rating" class="rating-line">
        <el-icon class="rating-star"><StarFilled /></el-icon>
        <b>{{ Number(device.rating).toFixed(1) }}</b>
        <span>{{ device.reviewCount }} 条评价</span>
      </div>

      <div class="stock-line">
        <div class="stock-bar" :class="stockTone">
          <i :style="stockStyle"></i>
        </div>
        <span class="stock-text">
          可借 <b>{{ device.available_qty }}</b> / {{ device.total_qty }}
        </span>
      </div>

      <div class="device-meta">
        <span class="meta-item">
          <el-icon><Box /></el-icon>
          编号 #{{ device.id }}
        </span>
        <span class="meta-item">
          <el-icon><Location /></el-icon>
          {{ device.location || '实验室' }}
        </span>
      </div>
    </div>

    <div class="device-foot" @click.stop>
      <el-button text size="small" @click="emit('open', device)">查看详情</el-button>
      <el-button type="primary" size="small" :disabled="!applyEnabled" @click="emit('apply', device)">
        {{ action }}
        <el-icon v-if="applyEnabled" class="btn-arrow"><ArrowRight /></el-icon>
      </el-button>
    </div>
  </article>
</template>

<style scoped>
.device-card {
  display: flex;
  flex-direction: column;
  padding: 18px 20px 14px;
  cursor: pointer;
  animation: lab-fade-up var(--dur-enter) var(--ease-out) both;
}

.device-card.is-list {
  flex-direction: row;
  align-items: center;
  gap: 18px;
  padding: 14px 18px;
}

.device-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.device-card.is-list .device-top {
  margin-bottom: 0;
  flex: none;
}

.device-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  flex: none;
  overflow: hidden;
}

.device-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.device-category {
  font-size: 11.5px;
  color: var(--text-3);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-card.is-list .device-category {
  display: none;
}

.fav-btn {
  width: 32px;
  height: 32px;
  min-width: 38px;
  min-height: 38px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: color var(--dur-fast) ease, background-color var(--dur-fast) ease,
    transform var(--dur-fast) var(--ease-out);
}

.fav-btn:hover {
  background: var(--amber-soft);
  color: var(--amber);
  transform: scale(1.06);
}

.fav-btn:active {
  transform: scale(0.94);
}

.fav-btn.on {
  color: var(--amber);
}

.device-body {
  flex: 1;
  min-width: 0;
}

.device-card h3 {
  margin: 0 0 5px;
  font-size: 15.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-3);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 41px;
}

.device-card.is-list .device-desc {
  -webkit-line-clamp: 1;
  min-height: 0;
  margin-bottom: 6px;
}

.maint-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0 0 10px;
  padding: 7px 9px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.55;
  color: var(--amber);
  background: var(--amber-soft);
  border: 1px solid color-mix(in srgb, var(--amber) 20%, transparent);
}

.maint-note .el-icon {
  margin-top: 2px;
  flex: none;
}

.rating-line {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: -4px 0 8px;
  font-size: 10.5px;
  color: var(--text-3);
}

.rating-star {
  color: var(--amber);
  font-size: 12px;
}

.rating-line b {
  font-size: 12px;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}

.stock-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.stock-bar {
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-3) 14%, transparent);
  overflow: hidden;
}

.stock-bar i {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  transform-origin: left center;
  transition: transform var(--dur-slow) var(--ease-out);
}

.stock-bar.is-ok i {
  background: linear-gradient(90deg, var(--primary), var(--lime));
}

.stock-bar.is-low i {
  background: linear-gradient(90deg, var(--amber), var(--red));
}

.stock-bar.is-empty i {
  background: var(--border-strong);
}

.stock-text {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.stock-text b {
  color: var(--primary);
  font-size: 12.5px;
}

.device-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding-top: 9px;
  border-top: 1px dashed var(--border);
  font-size: 11.5px;
  color: var(--text-3);
}

.device-card.is-list .device-meta {
  display: none;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.device-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
}

.device-card.is-list .device-foot {
  margin-top: 0;
  padding-top: 0;
  flex: none;
  gap: 8px;
}

.device-foot :deep(.el-button) {
  margin-left: 0;
}

.btn-arrow {
  margin-left: 3px;
  transition: transform var(--dur) var(--ease-out);
}

.device-foot :deep(.el-button:hover) .btn-arrow {
  transform: translateX(2px);
}

@media (max-width: 700px) {
  .device-card.is-list {
    flex-direction: column;
    align-items: stretch;
  }

  .device-card.is-list .device-top {
    margin-bottom: 12px;
  }

  .device-card.is-list .device-category {
    display: block;
  }

  .device-card.is-list .device-meta {
    display: flex;
  }

  .device-card.is-list .device-foot {
    justify-content: space-between;
    padding-top: 8px;
  }

  .fav-btn {
    min-width: 40px;
    min-height: 40px;
  }
}
</style>
