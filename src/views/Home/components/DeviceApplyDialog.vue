<!-- 设备大厅：提交借用申请弹窗 -->
<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { InfoFilled, MagicStick } from '@element-plus/icons-vue'
import { applyBooking, checkBookingConflict } from '@/api/student/applyDevice'
import { sendAiMessage } from '@/api/ai'
import { getPublicSettings } from '@/api/settings'
import { formatDateKey as formatDate } from '@/utils/date'
import { useAiStore } from '@/stores/useAiStore'
import { useNotificationStore } from '@/stores/Notification'
import StatusPill from '@/components/common/StatusPill.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  device: { type: Object, default: null },
  startDate: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'success'])

const ai = useAiStore()
const notificationStore = useNotificationStore()

const submitting = ref(false)
const purposeLoading = ref(false)
const dateRange = ref([])
const purpose = ref('')
const agreement = ref(false)
const rules = ref({ maxBorrowDays: 90, advanceDays: 30 })
const conflict = ref(null)
const checking = ref(false)
let checkTimer = null
let checkSeq = 0

function todayKey() {
  return formatDate(new Date())
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function disabledDate(date) {
  const today = todayKey()
  const outer = addDays(today, rules.value.advanceDays + rules.value.maxBorrowDays)
  const key = formatDate(date)
  return key < today || key > outer
}

async function loadRules() {
  try {
    const res = await getPublicSettings()
    if (res.code === 200 && res.data) {
      rules.value = {
        maxBorrowDays: Number(res.data.max_borrow_days) || 90,
        advanceDays: Number(res.data.booking_advance_days) || 30
      }
    }
  } catch {
    // 读取失败时沿用默认规则，后端仍会兜底校验
  }
}

async function runConflictCheck() {
  if (!props.device?.id || !dateRange.value || dateRange.value.length !== 2) {
    conflict.value = null
    return
  }
  const seq = ++checkSeq
  checking.value = true
  try {
    const res = await checkBookingConflict({
      device_id: props.device.id,
      borrow_start: dateRange.value[0],
      borrow_end: dateRange.value[1]
    })
    if (seq !== checkSeq) return
    conflict.value = res.code === 200 ? res.data : null
  } catch {
    if (seq !== checkSeq) return
    // 预检失败不阻断提交，后端创建时仍会做最终校验
    conflict.value = null
  } finally {
    if (seq === checkSeq) checking.value = false
  }
}

function scheduleConflictCheck() {
  if (checkTimer) clearTimeout(checkTimer)
  if (!dateRange.value || dateRange.value.length !== 2) {
    conflict.value = null
    checking.value = false
    return
  }
  checking.value = true
  checkTimer = setTimeout(runConflictCheck, 280)
}

function applySuggestion(item) {
  dateRange.value = [item.start, item.end]
}

onBeforeUnmount(() => {
  if (checkTimer) clearTimeout(checkTimer)
})

watch(dateRange, scheduleConflictCheck, { deep: true })

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    const today = todayKey()
    const start = props.startDate && props.startDate >= today ? props.startDate : today
    dateRange.value = [start, addDays(start, 3)]
    purpose.value = ''
    agreement.value = false
    conflict.value = null
    checkSeq += 1
    loadRules()
    scheduleConflictCheck()
  }
)

async function generatePurpose() {
  const device = props.device
  if (!device || purposeLoading.value) return

  purposeLoading.value = true
  const fallback = `课程实验：使用${device.name}完成${device.category}相关实验的数据采集与结果验证。`

  try {
    await ai.loadStatus()

    if (!ai.configuredCount) {
      purpose.value = fallback
      return
    }

    const res = await sendAiMessage({
      messages: [
        {
          role: 'user',
          content: `请为借用「${device.name}」（分类：${device.category}，说明：${device.description || '无'}）写一句 30-40 字的实验室借用用途。直接输出用途文本，不要解释、不要引号。`
        }
      ],
      provider: ai.provider
    })

    const text = String(res.data?.reply || '')
      .trim()
      .split('\n')[0]
      .replace(/^["“]|["”]$/g, '')
      .slice(0, 60)

    purpose.value = text || fallback
  } catch {
    purpose.value = fallback
  } finally {
    purposeLoading.value = false
  }
}

function showAgreement() {
  ElMessageBox.alert(
    [
      '1. 借用前请确认设备状态与配件齐全，按约定时间取件与归还。',
      '2. 单次借用最长 90 天，可申请续借，续借需管理员审核。',
      '3. 逾期未还会影响个人信用分，并暂停新的借用申请。',
      '4. 设备损坏或丢失需按实验室规定进行赔偿。',
      '5. 归还时请凭归还码交给管理员核验，完成闭环。'
    ]
      .map(line => `<p style="margin:0 0 6px;line-height:1.7">${line}</p>`)
      .join(''),
    '实验室设备借用协议',
    { confirmButtonText: '我知道了', dangerouslyUseHTMLString: true }
  )
}

async function submit() {
  if (submitting.value) return
  if (!dateRange.value || dateRange.value.length !== 2) {
    ElMessage.warning('请选择借用起止日期')
    return
  }
  if (checking.value) {
    ElMessage.info('正在检查时段库存，请稍候')
    return
  }
  if (conflict.value?.conflict) {
    ElMessage.warning('所选时段已被约满，请参考下方推荐时段')
    return
  }

  const [start, end] = dateRange.value
  if (start > addDays(todayKey(), rules.value.advanceDays)) {
    ElMessage.warning(`最多只能提前 ${rules.value.advanceDays} 天预约`)
    return
  }

  const days = Math.round(
    (new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000
  )
  if (days > rules.value.maxBorrowDays) {
    ElMessage.warning(`单次借用不能超过 ${rules.value.maxBorrowDays} 天`)
    return
  }

  if (!agreement.value) {
    ElMessage.warning('请先阅读并同意实验室设备借用协议')
    return
  }

  submitting.value = true
  try {
    const res = await applyBooking({
      device_id: props.device.id,
      borrow_start: dateRange.value[0],
      borrow_end: dateRange.value[1],
      purpose: purpose.value,
      agreement: true
    })

    if (res.code !== 200) {
      ElMessage.error(res.message || '申请提交失败')
      return
    }

    ElMessage.success('借用申请已提交，等待管理员审核')
    notificationStore.push({
      type: 'info',
      title: '借用申请已提交',
      content: `「${props.device.name}」的借用申请已提交，等待管理员审核。`
    })
    close()
    emit('success')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '申请提交失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="提交借用申请"
    width="520px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="apply-device">
      <span class="apply-icon">{{ (device?.category || '设').slice(0, 1) }}</span>
      <div>
        <span class="muted">申请设备</span>
        <strong>{{ device?.name }}</strong>
      </div>
      <StatusPill status="available" size="sm" />
    </div>

    <el-form label-position="top">
      <el-form-item label="借用起止日期" required>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          format="YYYY.MM.DD"
          :disabled-date="disabledDate"
          start-placeholder="开始日期"
          end-placeholder="归还日期"
          style="width: 100%"
        />
        <p class="rule-hint">
          最长借用 {{ rules.maxBorrowDays }} 天，最多提前 {{ rules.advanceDays }} 天预约
        </p>

        <p v-if="checking" class="conflict-line is-checking" role="status">
          正在检查所选时段的库存…
        </p>
        <div v-else-if="conflict?.conflict" class="conflict-box" role="alert">
          <strong>所选时段已约满</strong>
          <p>
            {{ conflict.days.filter(item => item.remaining <= 0).slice(0, 3).map(item => item.date).join('、') }}
            已无可用库存
          </p>
          <div v-if="conflict.suggestions.length" class="suggest-list">
            <span>推荐改期</span>
            <button
              v-for="item in conflict.suggestions"
              :key="item.start"
              type="button"
              @click="applySuggestion(item)"
            >
              {{ item.start.slice(5).replace('-', '.') }} → {{ item.end.slice(5).replace('-', '.') }}
            </button>
          </div>
        </div>
        <p v-else-if="conflict && conflict.minRemaining > 0" class="conflict-line is-ok" role="status">
          时段可用，所选日期内最少剩余 {{ conflict.minRemaining }} 台
        </p>
      </el-form-item>

      <el-form-item>
        <template #label>
          <div class="purpose-label">
            <span>借用用途</span>
            <button type="button" class="ai-mini" :disabled="purposeLoading" @click="generatePurpose">
              <el-icon><MagicStick /></el-icon>
              {{ purposeLoading ? '生成中…' : 'AI 生成' }}
            </button>
          </div>
        </template>
        <el-input
          v-model="purpose"
          type="textarea"
          :rows="3"
          maxlength="120"
          show-word-limit
          placeholder="例如：课程实验、毕业设计、学科竞赛等"
        />
      </el-form-item>
    </el-form>

    <div class="agreement-row">
      <el-checkbox v-model="agreement">我已阅读并同意</el-checkbox>
      <button type="button" class="agreement-link" @click="showAgreement">
        《实验室设备借用协议》
      </button>
    </div>

    <div class="apply-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>提交后需等待管理员审核。审核通过后会生成 6 位取件码，请凭码到实验室取件。</span>
    </div>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="checking || Boolean(conflict?.conflict)"
        @click="submit"
      >
        确认提交
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.apply-device {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 13px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
  margin-bottom: 18px;
}

.apply-icon {
  width: 38px;
  height: 38px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
}

.apply-device div {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.apply-device .muted {
  font-size: 10.5px;
}

.apply-device strong {
  font-size: 14px;
  color: var(--text-1);
}

.apply-tip {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--primary-soft);
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--text-2);
}

.apply-tip .el-icon {
  margin-top: 2px;
  flex: none;
  color: var(--primary);
}

.purpose-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 10px;
}

.ai-mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--violet) 30%, var(--border));
  background: var(--violet-soft);
  color: var(--violet);
  font-size: 10px;
  cursor: pointer;
  transition: background-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease,
    opacity var(--dur-fast) ease, transform var(--dur-fast) ease;
}

@media (hover: hover) and (pointer: fine) {
  .ai-mini:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 14px -8px rgba(184, 106, 69, 0.65);
  }
}

.ai-mini:active:not(:disabled) {
  transform: scale(0.96);
}

.ai-mini:disabled {
  opacity: 0.6;
  cursor: progress;
}

.agreement-row {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0 0 12px;
  font-size: 12px;
}

.agreement-link {
  border: none;
  background: transparent;
  padding: 0;
  color: var(--primary);
  font-size: 12px;
  cursor: pointer;
}

.agreement-link:hover {
  text-decoration: underline;
}

.rule-hint {
  margin: 6px 0 0;
  font-size: 10.5px;
  color: var(--text-3);
}

.conflict-line {
  margin: 8px 0 0;
  font-size: 11.5px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.conflict-line::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.conflict-line.is-checking {
  color: var(--text-3);
}

.conflict-line.is-checking::before {
  animation: conflict-pulse 1s ease-in-out infinite;
}

.conflict-line.is-ok {
  color: var(--green);
}

.conflict-box {
  margin-top: 9px;
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--red-soft);
  border: 1px solid color-mix(in srgb, var(--red) 24%, transparent);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-2);
}

.conflict-box strong {
  display: block;
  color: var(--red);
  font-size: 12px;
  margin-bottom: 2px;
}

.conflict-box p {
  margin: 0;
}

.suggest-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.suggest-list span {
  color: var(--text-3);
  font-size: 10.5px;
}

.suggest-list button {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-1);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: border-color var(--dur-fast) ease, color var(--dur-fast) ease;
}

.suggest-list button:hover {
  border-color: var(--primary);
  color: var(--primary);
}

@keyframes conflict-pulse {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
</style>
