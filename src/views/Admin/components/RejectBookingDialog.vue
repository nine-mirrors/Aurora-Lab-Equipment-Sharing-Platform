<!-- 管理端申请管理：拒绝借用申请弹窗 -->
<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { auditBooking } from '@/api/Admin/admin'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  row: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'rejected'])

const reasonOptions = ['借用目的不合理', '设备暂不可用', '库存不足', '时间冲突', '其他原因']
const rejectReason = ref('')
const rejectOther = ref('')
const submitting = ref(false)

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    rejectReason.value = ''
    rejectOther.value = ''
  }
)

function close() {
  emit('update:modelValue', false)
}

async function confirm() {
  const reason = rejectReason.value === '其他原因' ? rejectOther.value.trim() : rejectReason.value
  if (!reason) {
    ElMessage.warning('请选择或填写拒绝原因')
    return
  }

  submitting.value = true
  try {
    const res = await auditBooking(props.row.id, { action: 'reject', reason })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success('已拒绝该申请')
    close()
    emit('rejected')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="拒绝借用申请"
    width="440px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <p class="dialog-label">请选择拒绝原因</p>
    <el-select v-model="rejectReason" placeholder="请选择" style="width: 100%">
      <el-option v-for="item in reasonOptions" :key="item" :label="item" :value="item" />
    </el-select>

    <el-input
      v-if="rejectReason === '其他原因'"
      v-model="rejectOther"
      type="textarea"
      :rows="3"
      placeholder="请填写具体原因"
      style="margin-top: 12px"
    />

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="confirm">确认拒绝</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-label {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: var(--text-2);
}
</style>
