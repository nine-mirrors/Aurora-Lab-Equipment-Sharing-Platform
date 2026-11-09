<!-- 管理端基础数据：院系 -->
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  createDepartment,
  deleteDepartment,
  getDepartmentList,
  updateDepartment
} from '@/api/Admin/base'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const loading = ref(true)
const loadError = ref(false)
const list = ref([])
const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref(null)

const form = reactive({
  name: '',
  code: '',
  description: ''
})

async function load() {
  loading.value = true
  loadError.value = false
  try {
    const res = await getDepartmentList()
    if (res.code !== 200) throw new Error(res.message || '加载失败')
    list.value = res.data?.list || []
  } catch {
    loadError.value = true
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', code: '', description: '' })
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    code: row.code,
    description: row.description || ''
  })
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写院系名称')
    return
  }
  if (!form.code.trim()) {
    ElMessage.warning('请填写院系编码')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      description: form.description.trim()
    }
    const res = editingId.value
      ? await updateDepartment(editingId.value, payload)
      : await createDepartment(payload)

    if (res.code !== 200) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success(editingId.value ? '院系已更新' : '院系已新增')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除院系「${row.name}」吗？院系下仍有实验室时无法删除。`,
      '删除院系',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    const res = await deleteDepartment(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '删除失败')
      return
    }
    ElMessage.success('院系已删除')
    await load()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '删除失败')
  }
}

onMounted(load)
</script>

<template>
  <div class="manager">
    <div class="manager-head">
      <div>
        <h3>院系设置<span>共 {{ list.length }} 个</span></h3>
        <p>院系用于实验室归属，编码在同一平台内不可重复。</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新增院系
      </el-button>
    </div>

    <AppSkeleton v-if="loading" type="table" :rows="5" />

    <EmptyState
      v-else-if="loadError"
      tone="error"
      title="院系列表加载失败"
      description="网络或服务暂不可用，请重试"
      action-text="重新加载"
      @action="load"
    />

    <el-table v-else-if="list.length" :data="list">
      <el-table-column prop="name" label="院系名称" min-width="160" />
      <el-table-column prop="code" label="编码" width="120" />
      <el-table-column prop="description" label="说明" min-width="240" show-overflow-tooltip />
      <el-table-column label="操作" width="140" align="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" plain @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EmptyState v-else title="还没有院系" description="点击右上角新增院系" />

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑院系' : '新增院系'"
      width="480px"
    >
      <el-form label-position="top">
        <el-form-item label="院系名称" required>
          <el-input v-model="form.name" placeholder="例如：电子信息学院" />
        </el-form-item>
        <el-form-item label="院系编码" required>
          <el-input v-model="form.code" placeholder="例如：EIE" />
        </el-form-item>
        <el-form-item label="院系说明">
          <el-input v-model="form.description" type="textarea" :rows="3" maxlength="120" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.manager-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.manager-head h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-1);
}

.manager-head h3 span {
  margin-left: 8px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--text-3);
}

.manager-head p {
  margin: 5px 0 0;
  font-size: 12px;
  color: var(--text-3);
}
</style>
