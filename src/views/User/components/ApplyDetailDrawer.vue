<!-- 我的申请：借用详情抽屉 -->
<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Clock, Close, CopyDocument, StarFilled, Warning } from '@element-plus/icons-vue'
import { formatDateTime } from '@/utils/date'
import StatusPill from '@/components/common/StatusPill.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  record: { type: Object, default: null },
  returning: { type: Boolean, default: false },
  pickupLoadingId: { type: [Number, String], default: null }
})

const emit = defineEmits(['update:modelValue', 'cancel', 'pickup', 'extend', 'return', 'review'])

function todayKey() {
  const now = new Date()
  const pad = num => String(num).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// 跨天后再打开抽屉要按新的“今天”判断，不能沿用组件初始化时的日期
const today = ref(todayKey())
watch(
  () => props.modelValue,
  open => {
    if (open) today.value = todayKey()
  }
)

const timeline = computed(() => {
  const record = props.record
  if (!record) return []

  const approved = ['approved', 'returning', 'returned'].includes(record.status)
  const rejected = record.status === 'rejected'
  const cancelled = record.status === 'cancelled'
  const pickedUp = Boolean(record.picked_up_at)
  const reviewed = Number(record.review_rating) > 0

  const extensionText =
    record.extension_status === 'pending'
      ? ` · 续借至 ${record.requested_end} 审核中`
      : record.extension_status === 'approved'
        ? ` · 已续借至 ${record.borrow_end}`
        : ''

  return [
    {
      title: '提交借用申请',
      desc: record.created_at ? formatDateTime(record.created_at) : '已提交',
      state: 'done'
    },
    {
      title: cancelled ? '申请已取消' : rejected ? '审核未通过' : '管理员审核',
      desc: cancelled
        ? record.cancelled_at
          ? formatDateTime(record.cancelled_at)
          : '已取消'
        : rejected
          ? record.reason || '申请被拒绝'
          : approved
            ? record.approved_at
              ? formatDateTime(record.approved_at)
              : '审核通过'
            : '等待管理员处理中',
      state: cancelled ? 'idle' : rejected ? 'error' : approved ? 'done' : 'current'
    },
    {
      title: '凭码取件',
      desc: cancelled
        ? '申请已取消'
        : pickedUp
          ? `已取件 · ${formatDateTime(record.picked_up_at)}`
          : record.pickup_code
            ? `取件码 ${record.pickup_code}`
            : '审核通过后生成取件码',
      state: pickedUp ? 'done' : approved && !cancelled ? 'current' : 'idle'
    },
    {
      title: '使用与归还',
      desc: cancelled ? '—' : `${record.borrow_start} → ${record.borrow_end}${extensionText}`,
      state:
        record.status === 'returned'
          ? 'done'
          : record.status === 'returning'
            ? 'current'
            : approved
              ? 'done'
              : 'idle'
    },
    {
      title: '归还完成',
      desc:
        record.status === 'returned'
          ? record.returned_at
            ? formatDateTime(record.returned_at)
            : '已完成归还'
          : record.status === 'returning'
            ? '等待管理员确认归还'
            : '归还后可在此查看',
      state: record.status === 'returned' ? 'done' : record.status === 'returning' ? 'current' : 'idle'
    },
    {
      title: '评价设备',
      desc: reviewed
        ? `已评价 ${record.review_rating} 星`
        : record.status === 'returned'
          ? '可以评价本次借用体验'
          : '归还完成后可评价',
      state: reviewed ? 'done' : record.status === 'returned' ? 'current' : 'idle'
    }
  ]
})

const overdue = computed(
  () =>
    props.record?.status === 'approved' &&
    props.record?.borrow_end &&
    props.record.borrow_end < today.value
)

function isReviewed(row) {
  return Number(row?.review_rating) > 0
}

function canCancel(row) {
  return row?.status === 'pending'
}

function canPickup(row) {
  return row?.status === 'approved' && !row.picked_up_at
}

function canExtend(row) {
  return (
    row?.status === 'approved' &&
    row.extension_status !== 'pending' &&
    row.borrow_end >= today.value
  )
}

function canReview(row) {
  return row?.status === 'returned' && !Number(row.review_rating)
}

function copyCode(code) {
  if (!code) return
  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(String(code))
      .then(() => ElMessage.success(`已复制 ${code}`))
      .catch(() => ElMessage.info(`取件/归还码：${code}`))
  } else {
    ElMessage.info(`取件/归还码：${code}`)
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    size="460px"
    :with-header="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="record">
      <div class="detail-hero">
        <button class="drawer-close" type="button" aria-label="关闭借用详情" @click="close">
          <el-icon><Close /></el-icon>
        </button>
        <span class="detail-initial">{{ (record.category || '设').slice(0, 1) }}</span>
        <div class="detail-title">
          <h3>{{ record.device_name }}</h3>
          <span>{{ record.category }} · #{{ record.id }}</span>
        </div>
        <StatusPill
          :status="record.status === 'approved' && record.borrow_end < today ? 'overdue' : record.status"
        />
      </div>

      <div v-if="overdue" class="overdue-tip">
        <el-icon><Warning /></el-icon>
        该设备已超过归还日期，请尽快提交归还申请
      </div>

      <div class="detail-meta-grid">
        <div class="meta-box">
          <span>借用时间</span>
          <strong>{{ record.borrow_start }} → {{ record.borrow_end }}</strong>
        </div>
        <div class="meta-box">
          <span>申请时间</span>
          <strong>{{ formatDateTime(record.created_at) }}</strong>
        </div>
      </div>

      <div
        v-if="record.pickup_code && ['approved', 'returning', 'returned'].includes(record.status)"
        class="code-grid"
      >
        <button type="button" class="code-card" @click="copyCode(record.pickup_code)">
          <span>取件码</span>
          <strong>{{ record.pickup_code }}</strong>
          <small><el-icon><CopyDocument /></el-icon> 点击复制</small>
        </button>
        <button
          v-if="record.return_code"
          type="button"
          class="code-card return"
          @click="copyCode(record.return_code)"
        >
          <span>归还码</span>
          <strong>{{ record.return_code }}</strong>
          <small><el-icon><CopyDocument /></el-icon> 点击复制</small>
        </button>
      </div>

      <div v-if="record.extension_status" class="ext-tip" :class="record.extension_status">
        <el-icon><Clock /></el-icon>
        <span v-if="record.extension_status === 'pending'">
          续借申请审核中：新归还日期 {{ record.requested_end }}
        </span>
        <span v-else-if="record.extension_status === 'approved'">
          已续借至 {{ record.borrow_end }}
        </span>
        <span v-else>
          续借被拒{{ record.extension_reject_reason ? `：${record.extension_reject_reason}` : '' }}
        </span>
      </div>

      <div class="detail-block">
        <span class="detail-label">借用用途</span>
        <p>{{ record.purpose || '未填写' }}</p>
      </div>

      <div v-if="record.reason" class="detail-block reason">
        <span class="detail-label">审核意见</span>
        <p>{{ record.reason }}</p>
      </div>

      <div v-if="record.return_reject_reason" class="detail-block reason red">
        <span class="detail-label">归还被拒原因</span>
        <p>{{ record.return_reject_reason }}</p>
      </div>

      <div v-if="isReviewed(record)" class="review-block">
        <span class="detail-label">我的评价</span>
        <div class="review-stars">
          <el-icon v-for="i in 5" :key="i" :class="{ on: i <= record.review_rating }">
            <StarFilled />
          </el-icon>
          <span>{{ record.review_rating }}.0</span>
        </div>
        <p>{{ record.review_comment || '没有填写评价内容' }}</p>
      </div>

      <div class="timeline">
        <span class="timeline-title">流程进度</span>
        <div
          v-for="(step, index) in timeline"
          :key="index"
          class="timeline-item"
          :class="`state-${step.state}`"
        >
          <span class="timeline-dot">
            <el-icon v-if="step.state === 'done'"><Check /></el-icon>
          </span>
          <div class="timeline-copy">
            <strong>{{ step.title }}</strong>
            <small>{{ step.desc }}</small>
          </div>
        </div>
      </div>

      <div class="drawer-actions">
        <el-button v-if="canCancel(record)" type="danger" plain @click="emit('cancel', record)">
          取消申请
        </el-button>

        <el-button
          v-if="canPickup(record)"
          type="primary"
          plain
          :loading="pickupLoadingId === record.id"
          @click="emit('pickup', record)"
        >
          确认取件
        </el-button>

        <el-button v-if="canExtend(record)" @click="emit('extend', record)">
          申请续借
        </el-button>

        <el-button
          v-if="record.status === 'approved'"
          type="primary"
          size="large"
          :loading="returning"
          @click="emit('return', record)"
        >
          申请归还
        </el-button>

        <el-button
          v-if="canReview(record)"
          type="primary"
          size="large"
          @click="emit('review', record)"
        >
          评价设备
        </el-button>

        <span v-if="isReviewed(record)" class="muted small">已完成评价</span>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped src="./ApplyDetailDrawer.css"></style>
