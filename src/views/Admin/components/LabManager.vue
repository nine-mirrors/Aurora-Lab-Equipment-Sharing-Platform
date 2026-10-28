<!-- 管理端基础数据：实验室场地 -->
<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  createLab,
  deleteLab,
  getDepartmentList,
  getLabList,
  updateLab
} from '@/api/Admin/base'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'

const loading = ref(true)
const list = ref([])
const departments = ref([])
const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref(null)

const form = reactive({
  name: '',
  building: '',
  room: '',
  department_id: null,
  manager: '',
  phone: '',
  capacity: 30,
  status: 'open',
  open_hours: '08:30 - 17:30'
})

const statusMap = {
  open: { text: '开放', tone: 'success' },
  maintenance: { text: '维护中', tone: 'warning' },
  closed: { text: '关闭', tone: 'info' }
}

async function load() {
  loading.value = true
  try {
    const [labRes, deptRes] = await Promise.all([getLabList(), getDepartmentList()])
    list.value = labRes.data?.list || []
    departments.value = deptRes.data?.list || []
  } catch {
    ElMessage.error('实验室列表加载失败')
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    name: '',
    building: '',
    room: '',
    department_id: departments.value[0]?.id || null,
    manager: '',
    phone: '',
    capacity: 30,
    status: 'open',
    open_hours: '08:30 - 17:30'
  })
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    building: row.building,
    room: row.room,
    department_id: row.department_id || null,
    manager: row.manager || '',
    phone: row.phone || '',
    capacity: Number(row.capacity) || 0,
    status: row.status || 'open',
    open_hours: row.open_hours || '08:30 - 17:30'
  })
  dialogVisible.value = true
}

async function save() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写实验室名称')
    return
  }
  if (!form.building.trim()) {
    ElMessage.warning('请填写楼栋')
    return
  }
  if (!form.room.trim()) {
    ElMessage.warning('请填写房间号')
    return
  }

  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      building: form.building.trim(),
      room: form.room.trim(),
      department_id: form.department_id,
      manager: form.manager.trim(),
      phone: form.phone.trim(),
      capacity: Number(form.capacity) || 0,
      status: form.status,
      open_hours: form.open_hours.trim()
    }
    const res = editingId.value ? await updateLab(editingId.value, payload) : await createLab(payload)

    if (res.code !== 200) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success(editingId.value ? '实验室已更新' : '实验室已新增')
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
    await ElMessageBox.confirm(`确定删除实验室「${row.name}」吗？`, '删除实验室', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }

  try {
    const res = await deleteLab(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '删除失败')
      return
    }
    ElMessage.success('实验室已删除')
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
        <h3>实验室场地<span>共 {{ list.length }} 间</span></h3>
        <p>维护实验室位置、开放时间与负责人信息。</p>
      </div>
      <el-button type="primary" @click="openCreate">
        <el-icon><Plus /></el-icon>
        新增实验室
      </el-button>
    </div>

    <AppSkeleton v-if="loading" type="table" :rows="5" />

    <el-table v-else-if="list.length" :data="list">
      <el-table-column prop="name" label="实验室" min-width="170" />
      <el-table-column label="位置" width="150">
        <template #default="{ row }">{{ row.building }} {{ row.room }}</template>
      </el-table-column>
      <el-table-column prop="department_name" label="院系" width="140" />
      <el-table-column prop="manager" label="负责人" width="110" />
      <el-table-column prop="capacity" label="容量" width="80" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusMap[row.status]?.tone || 'info'" size="small" effect="plain">
            {{ statusMap[row.status]?.text || '开放' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="open_hours" label="开放时间" width="140" />
      <el-table-column label="操作" width="140" align="right">
        <template #default="{ row }">
          <el-button size="small" type="primary" plain @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" plain @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <EmptyState v-else title="还没有实验室" description="点击右上角新增实验室" />

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑实验室' : '新增实验室'"
      width="580px"
    >
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item label="实验室名称" required>
            <el-input v-model="form.name" placeholder="例如：嵌入式实验室" />
          </el-form-item>
          <el-form-item label="所属院系">
            <el-select v-model="form.department_id" clearable style="width: 100%">
              <el-option
                v-for="item in departments"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="楼栋" required>
            <el-input v-model="form.building" placeholder="例如：B 栋" />
          </el-form-item>
          <el-form-item label="房间号" required>
            <el-input v-model="form.room" placeholder="例如：B202" />
          </el-form-item>
          <el-form-item label="负责人">
            <el-input v-model="form.manager" placeholder="例如：王老师" />
          </el-form-item>
          <el-form-item label="联系电话">
            <el-input v-model="form.phone" placeholder="例如：13800000000" />
          </el-form-item>
          <el-form-item label="容纳人数">
            <el-input-number v-model="form.capacity" :min="0" :max="500" style="width: 100%" />
          </el-form-item>
          <el-form-item label="开放状态">
            <el-select v-model="form.status" style="width: 100%">
              <el-option label="开放" value="open" />
              <el-option label="维护中" value="maintenance" />
              <el-option label="关闭" value="closed" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="开放时间">
          <el-input v-model="form.open_hours" placeholder="例如：08:30 - 17:30" />
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
