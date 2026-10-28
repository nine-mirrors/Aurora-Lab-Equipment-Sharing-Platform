<!-- 我的申请：设备评价弹窗 -->
<script setup>
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { reviewBooking } from '@/api/student/bookings'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  record: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue', 'success'])

const reviewRating = ref(5)
const reviewComment = ref('')
const reviewing = ref(false)

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    reviewRating.value = 5
    reviewComment.value = ''
  }
)

function close() {
  emit('update:modelValue', false)
}

async function submit() {
  if (!reviewRating.value) {
    ElMessage.warning('请选择评分')
    return
  }

  reviewing.value = true
  try {
    const res = await reviewBooking(props.record.id, {
      rating: reviewRating.value,
      comment: reviewComment.value
    })
    if (res.code !== 200) {
      ElMessage.error(res.message || '评价提交失败')
      return
    }
    ElMessage.success('感谢你的评价')
    close()
    emit('success')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '评价提交失败')
  } finally {
    reviewing.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="评价设备"
    width="440px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dialog-device">
      <span class="dialog-initial">{{ (record?.category || '设').slice(0, 1) }}</span>
      <div>
        <strong>{{ record?.device_name }}</strong>
        <span>{{ record?.borrow_start }} → {{ record?.borrow_end }}</span>
      </div>
    </div>

    <div class="rate-row">
      <span>使用评分</span>
      <el-rate v-model="reviewRating" show-text :texts="['很差', '一般', '还行', '满意', '超赞']" />
    </div>

    <el-input
      v-model="reviewComment"
      type="textarea"
      :rows="4"
      maxlength="200"
      show-word-limit
      placeholder="分享一下设备状态、使用体验或注意事项…"
    />

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="reviewing" @click="submit">提交评价</el-button>
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

.rate-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  font-size: 12.5px;
  color: var(--text-2);
}
</style>
