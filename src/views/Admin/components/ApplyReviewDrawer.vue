<!-- 管理端申请管理：申请详情与 AI 审批建议抽屉 -->
<script setup>
import { Close, MagicStick, RefreshRight } from '@element-plus/icons-vue'
import StatusPill from '@/components/common/StatusPill.vue'

defineProps({
  modelValue: { type: Boolean, default: false },
  row: { type: Object, default: null },
  status: { type: String, default: 'pending' },
  reviewLoading: { type: Boolean, default: false },
  reviewResult: { type: Object, default: null },
  reviewBookingId: { type: [Number, String], default: null }
})

const emit = defineEmits([
  'update:modelValue',
  'approve',
  'reject',
  'approve-extension',
  'reject-extension',
  'confirm-return',
  'return-reject',
  'generate-review'
])

function reviewLabel(value) {
  return (
    {
      approve: '建议通过',
      reject: '建议拒绝',
      manual: '建议人工复核'
    }[value] || '待判断'
  )
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    size="440px"
    :with-header="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="row">
      <div class="detail-hero">
        <button class="drawer-close" type="button" aria-label="关闭申请详情" @click="close">
          <el-icon><Close /></el-icon>
        </button>
        <span class="detail-initial">{{ (row.category || '设').slice(0, 1) }}</span>
        <div class="detail-title">
          <h3>{{ row.device_name }}</h3>
          <span>{{ row.category }} · 申请人 {{ row.user_name }}</span>
        </div>
        <StatusPill :status="status" />
      </div>

      <div class="detail-meta">
        <div class="meta-box">
          <span>借用时间</span>
          <strong>{{ row.borrow_start }} → {{ row.borrow_end }}</strong>
        </div>
        <div class="meta-box">
          <span>申请时间</span>
          <strong>{{ new Date(row.created_at).toLocaleString('zh-CN') }}</strong>
        </div>
      </div>

      <div v-if="row.pickup_code || row.return_code" class="code-grid">
        <div v-if="row.pickup_code" class="code-card">
          <span>取件码</span>
          <strong>{{ row.pickup_code }}</strong>
          <small>{{ row.picked_up_at ? '已取件' : '待取件' }}</small>
        </div>
        <div v-if="row.return_code" class="code-card return">
          <span>归还码</span>
          <strong>{{ row.return_code }}</strong>
          <small>归还核验用</small>
        </div>
      </div>

      <div v-if="row.requested_end" class="extension-box">
        <span>续借申请</span>
        <strong>{{ row.borrow_end }} → {{ row.requested_end }}</strong>
        <small v-if="row.extension_reason">原因：{{ row.extension_reason }}</small>
        <em v-if="row.extension_status === 'pending'">等待审核</em>
        <em v-else-if="row.extension_status === 'approved'" class="ok">已通过</em>
        <em v-else class="red">已拒绝</em>
      </div>

      <div class="detail-block">
        <span class="detail-label">借用用途</span>
        <p>{{ row.purpose || '未填写' }}</p>
      </div>

      <div v-if="row.reason" class="detail-block">
        <span class="detail-label">审核意见</span>
        <p class="reason">{{ row.reason }}</p>
      </div>

      <div v-if="row.return_reject_reason" class="detail-block">
        <span class="detail-label">归还被拒原因</span>
        <p class="reason red">{{ row.return_reject_reason }}</p>
      </div>

      <div v-if="status === 'pending'" class="ai-review-card">
        <div class="ai-review-head">
          <span class="ai-review-title">
            <el-icon><MagicStick /></el-icon>
            AI 审批建议
          </span>
          <button
            type="button"
            class="ai-review-btn"
            :disabled="reviewLoading"
            @click="emit('generate-review', row)"
          >
            <el-icon>
              <RefreshRight v-if="reviewResult" />
              <MagicStick v-else />
            </el-icon>
            {{ reviewLoading ? '分析中…' : reviewResult ? '重新分析' : '生成建议' }}
          </button>
        </div>

        <div v-if="reviewLoading" class="ai-review-loading">
          <i></i><i></i><i></i>
          <span>正在核对申请人历史、库存、维护状态与时间冲突…</span>
        </div>

        <template v-else-if="reviewResult && reviewBookingId === row.id">
          <div class="ai-rec" :class="`rec-${reviewResult.recommendation}`">
            <strong>{{ reviewLabel(reviewResult.recommendation) }}</strong>
            <span>参考分 {{ reviewResult.score }}</span>
          </div>

          <p class="ai-summary">{{ reviewResult.summary }}</p>

          <div v-if="reviewResult.reasons?.length" class="ai-list">
            <span>支持依据</span>
            <ul>
              <li v-for="item in reviewResult.reasons" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div v-if="reviewResult.risks?.length" class="ai-list risk">
            <span>风险提示</span>
            <ul>
              <li v-for="item in reviewResult.risks" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="ai-note">
            <span>建议意见</span>
            <p>{{ reviewResult.suggested_note }}</p>
          </div>

          <small class="ai-meta">
            {{ reviewResult.providerLabel }} · {{ reviewResult.model }} ·
            {{ reviewResult.notice }}
          </small>
        </template>

        <p v-else class="ai-review-empty">
          让 AI 结合申请人历史信用、设备库存、维护状态和时间冲突给出参考建议，不会自动修改审批结果。
        </p>
      </div>

      <div class="drawer-actions">
        <template v-if="status === 'extension-pending'">
          <el-button type="danger" plain @click="emit('reject-extension', row)">拒绝续借</el-button>
          <el-button type="success" @click="emit('approve-extension', row)">通过续借</el-button>
        </template>

        <template v-else-if="status === 'pending'">
          <el-button type="danger" plain @click="emit('reject', row)">拒绝</el-button>
          <el-button type="primary" @click="emit('approve', row)">通过申请</el-button>
        </template>

        <template v-else-if="status === 'returning'">
          <el-button type="danger" plain @click="emit('return-reject', row)">拒绝归还</el-button>
          <el-button type="success" @click="emit('confirm-return', row)">确认归还</el-button>
        </template>

        <template v-else>
          <span class="drawer-hint">该申请当前无需处理</span>
          <el-button @click="close">关闭</el-button>
        </template>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped src="./ApplyReviewDrawer.css"></style>
