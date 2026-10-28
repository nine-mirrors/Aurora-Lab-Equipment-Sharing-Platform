<!-- 我的申请：续借申请弹窗 -->
<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { extendBooking } from '@/api/student/bookings'
import { getPublicSettings } from '@/api/settings'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  record: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'success'])

const extendDate = ref('')
const extendReason = ref('')
const extending = ref(false)
const maxRenewDays = ref(30)

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00`)
  date.setDate(date.getDate() + days)
  const pad = num => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

watch(
  () => props.modelValue,
  visible => {
    if (!visible || !props.record) return
    extendDate.value = addDays(props.record.borrow_end, 3)
    extendReason.value = ''
    loadRules()
  }
)

async function loadRules() {
  try {
    const res = await getPublicSettings()
    if (res.code === 200 && res.data) {
      maxRenewDays.value = Number(res.data.max_renew_days) || 30
    }
  } catch {
    // 读取失败时沿用默认值，后端仍会兜底校验
  }
}

function disabledDate(day) {
  if (!props.record) return true
  const end = new Date(`${props.record.borrow_end}T23:59:59`).getTime()
  const max = new Date(`${props.record.borrow_end}T00:00:00`)
  max.setDate(max.getDate() + maxRenewDays.value)
  return day.getTime() <= end || day.getTime() > max.getTime()
}

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!extendDate.value) {
    ElMessage.warning('请选择新的归还日期')
    return
  }
  if (extendDate.value <= props.record.borrow_end) {
    ElMessage.warning('新的归还日期必须晚于当前归还日期')
    return
  }

  const days = Math.round(
    (new Date(`${extendDate.value}T00:00:00`) -
      new Date(`${props.record.borrow_end}T00:00:00`)) /
      86400000
  )
  if (days > maxRenewDays.value) {
    ElMessage.warning(`单次续借不能超过 ${maxRenewDays.value} 天`)
    return
  }

  extending.value = true
  try {
    const res = await extendBooking(props.record.id, {
      new_end: extendDate.value,
      reason: extendReason.value
    })
    if (res.code !== 200) {
      ElMessage.error(res.message || '续借申请提交失败')
      return
    }
    ElMessage.success('续借申请已提交，等待管理员审核')
    close()
    emit('success')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '续借申请提交失败')
  } finally {
    extending.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="申请续借"
    width="460px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dialog-device">
      <span class="dialog-initial">{{ (record?.category || '设').slice(0, 1) }}</span>
      <div>
        <strong>{{ record?.device_name }}</strong>
        <span>当前归还日期 {{ record?.borrow_end }}</span>
      </div>
    </div>

    <el-form label-position="top">
      <el-form-item label="新的归还日期" required>
        <el-date-picker
          v-model="extendDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY.MM.DD"
          :disabled-date="disabledDate"
          style="width: 100%"
        />
        <p class="rule-hint">单次续借最长 {{ maxRenewDays }} 天</p>
      </el-form-item>
      <el-form-item label="续借原因">
        <el-input
          v-model="extendReason"
          type="textarea"
          :rows="3"
          maxlength="120"
          show-word-limit
          placeholder="例如：实验数据尚未采集完成，需要延长使用时间"
        />
      </el-form-item>
    </el-form>

    <div class="dialog-tip">续借需要管理员审核，审核通过后借用结束时间会自动延长。</div>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="extending" @click="submit">提交续借</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-device {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-soft);
}

.dialog-initial {
  width: 36px;
  height: 36px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
}

.dialog-device div {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.dialog-device strong {
  font-size: 13px;
  color: var(--text-1);
}

.dialog-device span {
  font-size: 10.5px;
  color: var(--text-3);
}

.dialog-tip {
  padding: 9px 11px;
  border-radius: 10px;
  background: var(--primary-soft);
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.6;
}

.rule-hint {
  margin: 6px 0 0;
  font-size: 10.5px;
  color: var(--text-3);
}
</style>
