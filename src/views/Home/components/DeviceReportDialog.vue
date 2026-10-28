<!-- 设备大厅：设备报修弹窗 -->
<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { InfoFilled } from '@element-plus/icons-vue'
import { reportDevice } from '@/api/device'
import { useNotificationStore } from '@/stores/Notification'
import StatusPill from '@/components/common/StatusPill.vue'
import { devicePillStatus } from '@/utils/device-presenter'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  device: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'success'])

const notificationStore = useNotificationStore()

const reportReasons = [
  '设备无法开机 / 无响应',
  '运行异常或报错',
  '精度 / 数据异常',
  '配件缺失或损坏',
  '外观破损 / 漏液',
  '其他问题'
]

const reportReason = ref('')
const reportDetail = ref('')
const submitting = ref(false)

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    reportReason.value = ''
    reportDetail.value = ''
  }
)

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!reportReason.value) {
    ElMessage.warning('请选择故障类型')
    return
  }

  submitting.value = true
  try {
    const res = await reportDevice(props.device.id, {
      reason: reportReason.value,
      detail: reportDetail.value.trim()
    })

    if (res.code !== 200) {
      ElMessage.error(res.message || '报修提交失败')
      return
    }

    ElMessage.success('报修已提交，管理员会尽快处理')
    notificationStore.push({
      type: 'info',
      title: '设备报修已提交',
      content: `「${props.device.name}」的报修已提交，管理员会尽快处理。`
    })
    close()
    emit('success')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '报修提交失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="设备报修"
    width="500px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="apply-device">
      <span class="apply-icon">{{ (device?.category || '设').slice(0, 1) }}</span>
      <div>
        <span class="muted">报修设备</span>
        <strong>{{ device?.name }}</strong>
      </div>
      <StatusPill :status="devicePillStatus(device)" size="sm" />
    </div>

    <el-form label-position="top">
      <el-form-item label="故障类型" required>
        <el-select v-model="reportReason" placeholder="请选择最接近的故障类型" style="width: 100%">
          <el-option v-for="item in reportReasons" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>

      <el-form-item label="问题描述">
        <el-input
          v-model="reportDetail"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          placeholder="补充故障现象、发生时间或错误提示，帮助管理员更快定位问题"
        />
      </el-form-item>
    </el-form>

    <div class="apply-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>报修提交后管理员会尽快核查；确认维修后，该设备将暂停新的借用申请。</span>
    </div>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="warning" :loading="submitting" @click="submit">提交报修</el-button>
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
</style>
