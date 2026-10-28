<!-- 设备大厅：设备详情抽屉（信息 / 可用日历 / 用户评价） -->
<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, Close, StarFilled, Tools } from '@element-plus/icons-vue'
import { getDeviceAvailability, getDeviceReviews } from '@/api/device'
import { formatDateKey as formatDate } from '@/utils/date'
import {
  actionText,
  canApply,
  categoryInitial,
  devicePillStatus,
  isRepairing,
  stockPercent
} from '@/utils/device-presenter'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatusPill from '@/components/common/StatusPill.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  device: { type: Object, default: null },
  favorite: { type: Boolean, default: false },
  blacklisted: { type: Boolean, default: false },
  activeStatus: { type: Object, default: null },
  accent: { type: String, default: '#0e7c66' }
})

const emit = defineEmits(['update:modelValue', 'toggle-favorite', 'report', 'apply', 'apply-day'])

const detailTab = ref('info')
const calendarMonth = ref(monthKey())
const calendarDays = ref([])
const calendarLoading = ref(false)
const reviews = ref([])
const reviewsLoading = ref(false)
const reviewSummary = ref({ rating: null, reviewCount: 0 })

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const todayKey = formatDate(new Date())

const calendarMeta = computed(() => {
  const [year, month] = calendarMonth.value.split('-').map(Number)
  return {
    year,
    month,
    offset: new Date(year, month - 1, 1).getDay(),
    daysInMonth: new Date(year, month, 0).getDate()
  }
})

const calendarCells = computed(() => {
  const cells = []
  for (let i = 0; i < calendarMeta.value.offset; i += 1) {
    cells.push({ empty: true, key: `empty-${i}` })
  }
  calendarDays.value.forEach(item => cells.push({ ...item, key: item.date }))
  return cells
})

const calendarTitle = computed(
  () => `${calendarMeta.value.year} 年 ${calendarMeta.value.month} 月`
)

const ratingText = computed(() => {
  const rating = reviewSummary.value.rating
  return rating ? Number(rating).toFixed(1) : '暂无'
})

const percent = computed(() => stockPercent(props.device))
const applyEnabled = computed(() =>
  canApply(props.device, { blacklisted: props.blacklisted, activeStatus: props.activeStatus })
)
const action = computed(() =>
  actionText(props.device, { blacklisted: props.blacklisted, activeStatus: props.activeStatus })
)

function deviceStatusText(item) {
  if (isRepairing(item)) return '维护中'
  if (item?.maintenance_status === 'pending') return '待维修'
  if (Number(item?.available_qty)) return '在库可借'
  return '暂无库存'
}

function monthKey(date = new Date()) {
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function dayClass(day) {
  if (day.empty) return 'empty'
  const past = day.date < todayKey
  if (past) return 'past'
  const total = Number(props.device?.total_qty) || 1
  if (Number(day.remaining) <= 0) return 'full'
  if (Number(day.remaining) <= Math.max(1, Math.floor(total * 0.35))) return 'low'
  return 'ok'
}

async function loadCalendar() {
  if (!props.device) return
  calendarLoading.value = true
  try {
    const res = await getDeviceAvailability(props.device.id, calendarMonth.value)
    calendarDays.value = res.data?.days || []
  } catch {
    calendarDays.value = []
  } finally {
    calendarLoading.value = false
  }
}

async function loadReviews() {
  if (!props.device) return
  reviewsLoading.value = true
  try {
    const res = await getDeviceReviews(props.device.id)
    reviews.value = res.data?.list || []
    reviewSummary.value = res.data?.summary || { rating: null, reviewCount: 0 }
  } catch {
    reviews.value = []
    reviewSummary.value = { rating: null, reviewCount: 0 }
  } finally {
    reviewsLoading.value = false
  }
}

function changeMonth(delta) {
  const [year, month] = calendarMonth.value.split('-').map(Number)
  const next = new Date(year, month - 1 + delta, 1)
  calendarMonth.value = monthKey(next)
  loadCalendar()
}

function applyFromDay(day) {
  if (day.empty || day.date < todayKey || Number(day.remaining) <= 0) return
  emit('apply-day', day.date)
}

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  visible => {
    if (!visible || !props.device) return
    detailTab.value = 'info'
    calendarMonth.value = monthKey()
    calendarDays.value = []
    reviews.value = []
    reviewSummary.value = {
      rating: props.device.rating || null,
      reviewCount: props.device.reviewCount || 0
    }
  }
)

watch(detailTab, tab => {
  if (!props.device) return
  if (tab === 'calendar') loadCalendar()
  if (tab === 'reviews') loadReviews()
})
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    size="440px"
    :with-header="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="device">
      <div class="detail-hero">
        <button class="drawer-close" type="button" @click="close">
          <el-icon><Close /></el-icon>
        </button>
        <span
          class="detail-icon"
          :style="{
            color: accent,
            background: `color-mix(in srgb, ${accent} 14%, transparent)`
          }"
        >
          <img v-if="device.image" :src="device.image" alt="" class="device-thumb" />
          <template v-else>{{ categoryInitial(device.category) }}</template>
        </span>
        <div class="detail-title">
          <h3>{{ device.name }}</h3>
          <span>
            {{ device.category }}
            <template v-if="reviewSummary.rating"> · ★ {{ ratingText }}</template>
          </span>
        </div>
        <StatusPill :status="devicePillStatus(device)" />
      </div>

      <div class="detail-tabs">
        <button
          v-for="tab in [
            { key: 'info', label: '设备信息' },
            { key: 'calendar', label: '可用日历' },
            { key: 'reviews', label: '用户评价' }
          ]"
          :key="tab.key"
          type="button"
          :class="{ active: detailTab === tab.key }"
          @click="detailTab = tab.key"
        >
          {{ tab.label }}
          <span v-if="tab.key === 'reviews' && reviewSummary.reviewCount" class="tab-badge">
            {{ reviewSummary.reviewCount }}
          </span>
        </button>
      </div>

      <div v-if="detailTab === 'info'" class="tab-panel">
        <div class="detail-stock">
          <div class="stock-line">
            <div class="stock-bar">
              <i
                :style="{
                  width: `${percent}%`,
                  background: 'linear-gradient(90deg, #0e7c66, #9fbf3a)'
                }"
              ></i>
            </div>
            <span class="stock-text">
              <b>{{ device.available_qty }}</b> / {{ device.total_qty }} 台可借
            </span>
          </div>
        </div>

        <div class="detail-grid">
          <div class="detail-cell">
            <span>设备编号</span>
            <strong>#{{ device.id }}</strong>
          </div>
          <div class="detail-cell">
            <span>存放位置</span>
            <strong>{{ device.location || '实验室' }}</strong>
          </div>
          <div class="detail-cell">
            <span>设备分类</span>
            <strong>{{ device.category }}</strong>
          </div>
          <div class="detail-cell">
            <span>当前状态</span>
            <strong>{{ deviceStatusText(device) }}</strong>
          </div>
        </div>

        <div v-if="device.maintenance_status !== 'none'" class="detail-block maint-block">
          <span class="detail-label">维护信息</span>
          <p>
            {{ isRepairing(device) ? '设备正在维护，新的借用申请已暂停。' : '设备报修已提交，管理员正在安排处理。' }}
            {{ device.maintenance_reason ? `原因：${device.maintenance_reason}` : '' }}
          </p>
        </div>

        <div class="detail-block">
          <span class="detail-label">用途说明</span>
          <p>{{ device.description || '暂无描述' }}</p>
        </div>

        <div class="detail-block tip">
          <span class="detail-label">借用流程</span>
          <p>提交申请 → 管理员审核 → 凭取件码取件 → 使用/续借 → 提交归还 → 归还码核验 → 评价设备。</p>
        </div>
      </div>

      <div v-else-if="detailTab === 'calendar'" class="tab-panel">
        <div class="calendar-head">
          <button type="button" @click="changeMonth(-1)">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <strong>{{ calendarTitle }}</strong>
          <button type="button" @click="changeMonth(1)">
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>

        <div v-loading="calendarLoading" class="calendar-wrap">
          <div class="calendar-week">
            <span v-for="day in weekdays" :key="day">{{ day }}</span>
          </div>

          <div class="calendar-grid">
            <button
              v-for="day in calendarCells"
              :key="day.key"
              type="button"
              class="cal-day"
              :class="dayClass(day)"
              :disabled="day.empty || day.date < todayKey || Number(day.remaining) <= 0"
              @click="applyFromDay(day)"
            >
              <template v-if="!day.empty">
                <b>{{ Number(day.date.slice(-2)) }}</b>
                <span class="cal-stock">{{ Number(day.remaining) > 0 ? `余${day.remaining}` : '满' }}</span>
                <i v-if="day.pending" class="cal-pending" :title="`${day.pending} 条待审核`"></i>
              </template>
            </button>
          </div>

          <div class="calendar-legend">
            <span><i class="dot ok"></i>可借</span>
            <span><i class="dot low"></i>紧张</span>
            <span><i class="dot full"></i>约满</span>
            <span><i class="dot pending"></i>有待审核</span>
          </div>
          <p class="calendar-hint">点击有库存的日期，可直接带上该日期发起借用申请</p>
        </div>
      </div>

      <div v-else class="tab-panel">
        <div class="review-summary">
          <div class="summary-score">
            <strong>{{ ratingText }}</strong>
            <span class="summary-stars">
              <el-icon
                v-for="i in 5"
                :key="i"
                :class="{ on: i <= Math.round(Number(reviewSummary.rating) || 0) }"
              >
                <StarFilled />
              </el-icon>
            </span>
          </div>
          <span class="summary-count">
            {{ reviewSummary.reviewCount ? `${reviewSummary.reviewCount} 条用户评价` : '还没有用户评价' }}
          </span>
        </div>

        <AppSkeleton v-if="reviewsLoading" type="list" :rows="3" />

        <div v-else-if="reviews.length" class="review-list">
          <article v-for="item in reviews" :key="item.id" class="review-item">
            <div class="review-head">
              <span class="review-avatar">{{ (item.user_name || '?').slice(0, 1) }}</span>
              <strong>{{ item.user_name }}</strong>
              <span class="review-stars">
                <i v-for="i in 5" :key="i" :class="{ on: i <= item.rating }">★</i>
              </span>
              <time>{{ formatDate(item.reviewed_at) }}</time>
            </div>
            <p>{{ item.comment || '该用户没有填写评价内容' }}</p>
            <small v-if="item.purpose">用途：{{ item.purpose }}</small>
          </article>
        </div>

        <EmptyState
          v-else
          compact
          title="还没有用户评价"
          description="归还完成后，你可以在「我的申请」中评价这台设备"
        />
      </div>

      <div class="drawer-actions">
        <el-button @click="emit('toggle-favorite', device)">
          <el-icon><StarFilled v-if="favorite" /><Star v-else /></el-icon>
          {{ favorite ? '已收藏' : '收藏设备' }}
        </el-button>
        <el-button plain type="warning" @click="emit('report', device)">
          <el-icon><Tools /></el-icon>
          报修
        </el-button>
        <el-button type="primary" size="large" :disabled="!applyEnabled" @click="emit('apply', device)">
          {{ action }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped src="./DeviceDetailDrawer.css"></style>
