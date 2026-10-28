<!-- 管理端基础数据：平台公告 -->
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncementList,
  updateAnnouncement
} from '@/api/Admin/base'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const loading = ref(true)
const list = ref([])
const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref(null)

const form = reactive({
  title: '',
  content: '',
  level: 'info',
  is_active: true
})

const levelMap = {
  info: { text: '通知', tone: 'info' },
  warning: { text: '提醒', tone: 'warning' },
  important: { text: '重要', tone: 'danger' }
}

function formatTime(input) {
  if (!input) return '-'
  return new Date(input).toLocaleString('zh-CN', { hour12: false })
}

async function load() {
  loading.value = true
  try {
    const res = await getAnnouncementList()
    list.value = res.data?.list || []
  } catch {
    ElMessage.error('公告加载失败')
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { title: '', content: '', level: 'info', is_active: true })
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  Object.assign(form, {
    title: row.title,
    content: row.content,
    level: row.level || 'info',
    is_active: Boolean(Number(row.is_active))
  })
  dialogVisible.value = true
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写公告标题')
    return
  }
  if (!form.content.trim()) {
    ElMessage.warning('请填写公告内容')
    return
  }

  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      level: form.level,
      is_active: form.is_active ? 1 : 0
    }
    const res = editingId.value
      ? await updateAnnouncement(editingId.value, payload)
      : await createAnnouncement(payload)

    if (res.code !== 200) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success(editingId.value ? '公告已更新' : '公告已发布')
    dialogVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggleActive(row) {
  const next = Number(row.is_active) ? 0 : 1
  try {
    const res = await updateAnnouncement(row.id, { is_active: next })
    if (res.code !== 200) {
      ElMessage.error(res.message || '状态更新失败')
      return
    }
    row.is_active = next
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '状态更新失败')
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`确定删除公告「${row.title}」吗？`, '删除公告', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    const res = await deleteAnnouncement(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '删除失败')
      return
    }
    ElMessage.success('公告已删除')
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
        <h3>平台公告<span>共 {{ list.length }} 条</span></h3>
        <p>公告会显示在学生端数据看板，停用后不再对外展示。</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        发布公告
      </el-button>
    </div>

    <AppSkeleton v-if="loading" type="table" :rows="5" />

    <el-table v-else-if="list.length" :data="list">
      <el-table-column prop="title" label="标题" min-width="180" />
      <el-table-column label="级别" width="90">
        <template #default="{ row }">
          <el-tag :type="levelMap[row.level]?.tone || 'info'" size="small" effect="plain">
            {{ levelMap[row.level]?.text || '通知' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="260" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch
            :model-value="Boolean(Number(row.is_active))"
            @change="toggleActive(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="发布时间" width="170">
        <template #default="{ row }">{{ formatTime(row.published_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" plain @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EmptyState v-else title="还没有公告" description="点击右上角发布第一条平台公告" />

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑公告' : '发布公告'"
      width="560px"
    >
      <el-form label-position="top">
        <el-form-item label="公告标题" required>
          <el-input v-model="form.title" maxlength="60" show-word-limit placeholder="例如：实验室安全检查通知" />
        </el-form-item>
        <el-form-item label="公告级别">
          <el-select v-model="form.level" style="width: 100%">
            <el-option label="通知" value="info" />
            <el-option label="提醒" value="warning" />
            <el-option label="重要" value="important" />
          </el-select>
        </el-form-item>
        <el-form-item label="公告内容" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="4"
            maxlength="300"
            show-word-limit
            placeholder="填写公告正文"
          />
        </el-form-item>
        <el-form-item label="展示状态">
          <el-switch v-model="form.is_active" active-text="对外展示" inactive-text="暂不展示" />
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

:deep(.el-table__row) {
  cursor: default;
}
</style>
