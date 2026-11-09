<!-- 设备上架 / 编辑弹窗 -->
<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createDevice, updateDevice } from '@/api/Admin/add'
import { uploadImage } from '@/api/upload'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  device: { type: Object, default: null },
  categories: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:modelValue', 'saved'])

const saving = ref(false)
const imageUploading = ref(false)
const uploadPercent = ref(0)
const editingId = computed(() => props.device?.id || null)

const form = reactive({
  name: '',
  category: '',
  total_qty: 1,
  location: '',
  description: '',
  image: '',
  is_active: true
})

watch(
  () => props.modelValue,
  visible => {
    if (!visible) return
    const row = props.device
    Object.assign(form, {
      name: row?.name || '',
      category: row?.category || '',
      total_qty: row?.total_qty ?? 1,
      location: row?.location || '',
      description: row?.description || '',
      image: row?.image || '',
      is_active: row ? Boolean(Number(row.is_active)) : true
    })
  }
)

function close() {
  emit('update:modelValue', false)
}

async function handleImageUpload(options) {
  if (imageUploading.value) return
  const file = options.file
  if (!file.type?.startsWith('image/')) {
    ElMessage.warning('请选择 JPG / PNG / WebP 图片')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 5MB，请压缩后再上传')
    return
  }

  imageUploading.value = true
  uploadPercent.value = 0
  try {
    const res = await uploadImage(file, percent => {
      uploadPercent.value = percent
    })
    if (res.code !== 200) {
      ElMessage.error(res.message || '图片上传失败')
      return
    }
    form.image = res.data.url
    ElMessage.success(res.data.storage === 'oss' ? '图片已上传到 OSS' : '图片已保存到本地')
    options.onSuccess?.(res)
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '图片上传失败，请重试')
    options.onError?.(error)
  } finally {
    imageUploading.value = false
    uploadPercent.value = 0
  }
}

async function handleSave() {
  if (saving.value || imageUploading.value) return
  if (!form.name.trim()) {
    ElMessage.warning('请填写设备名称')
    return
  }
  if (!form.category) {
    ElMessage.warning('请选择或输入设备分类')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      category: form.category,
      total_qty: Number(form.total_qty) || 1,
      location: form.location,
      description: form.description,
      image: form.image,
      is_active: form.is_active ? 1 : 0
    }

    const res = editingId.value
      ? await updateDevice(editingId.value, payload)
      : await createDevice(payload)

    if (res.code !== 200) {
      ElMessage.error(res.message || '保存失败')
      return
    }

    ElMessage.success(editingId.value ? '设备信息已更新' : '设备上架成功')
    close()
    emit('saved')
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="editingId ? '编辑设备' : '上架设备'"
    width="560px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <div class="form-grid">
        <el-form-item label="设备名称" required>
          <el-input v-model="form.name" placeholder="例如 数字示波器" />
        </el-form-item>

        <el-form-item label="设备分类" required>
          <el-select
            v-model="form.category"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入分类"
            style="width: 100%"
          >
            <el-option v-for="item in categories" :key="item.id" :label="item.name" :value="item.name" />
          </el-select>
        </el-form-item>

        <el-form-item label="库存数量">
          <el-input-number v-model="form.total_qty" :min="1" :max="999" style="width: 100%" />
        </el-form-item>

        <el-form-item label="存放位置">
          <el-input v-model="form.location" placeholder="例如 A302 电子实验室" />
        </el-form-item>
      </div>

      <el-form-item label="设备图片">
        <div class="image-uploader">
          <div class="image-preview" :class="{ empty: !form.image }">
            <img v-if="form.image" :src="form.image" alt="设备图片" />
            <span v-else>暂无图片</span>
          </div>
          <div class="image-actions">
            <el-upload :show-file-list="false" accept="image/*" :http-request="handleImageUpload">
              <el-button :loading="imageUploading">
                {{ form.image ? '更换图片' : '上传图片' }}
              </el-button>
            </el-upload>
            <el-button v-if="form.image" text type="danger" @click="form.image = ''">
              移除
            </el-button>
            <el-progress
              v-if="imageUploading"
              class="upload-progress"
              :percentage="uploadPercent"
              :stroke-width="4"
              :show-text="false"
            />
            <small>{{ imageUploading ? `上传中 ${uploadPercent}%` : '支持 JPG / PNG / WebP，最大 5MB，自动上传至 OSS' }}</small>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="用途说明">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="120"
          show-word-limit
          placeholder="简要描述设备用途与注意事项"
        />
      </el-form-item>

      <el-form-item label="上架状态">
        <el-switch v-model="form.is_active" active-text="在库可借" inactive-text="暂不上架" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="close">取消</el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="imageUploading"
        @click="handleSave"
      >
        {{ imageUploading ? '图片上传中…' : '保存' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

:deep(.el-form-item__label) {
  font-size: 12.5px;
  padding-bottom: 4px;
}

.image-uploader {
  display: flex;
  align-items: center;
  gap: 14px;
}

.image-preview {
  width: 96px;
  height: 96px;
  flex: none;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-preview.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: var(--text-3);
  border-style: dashed;
}

.image-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.upload-progress {
  flex-basis: 100%;
  width: 100%;
}

.image-actions small {
  flex-basis: 100%;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--text-3);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
