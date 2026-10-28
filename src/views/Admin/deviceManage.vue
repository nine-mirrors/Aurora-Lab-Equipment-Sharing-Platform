<!-- 管理端设备管理：库存预警、批量操作与导出 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Plus, Search } from '@element-plus/icons-vue'
import { getDeviceList } from '@/api/device'
import { offDevice } from '@/api/Admin/add'
import { setDeviceMaintenance } from '@/api/Admin/admin'
import { getEnabledCategoryList } from '@/api/category'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import DeviceFormDialog from './components/DeviceFormDialog.vue'
import { useDebounce } from '@/composables/useDebounce'

const loading = ref(true)
const devices = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 10

const keyword = ref('')
const category = ref('')
const status = ref('')
const categoryList = ref([])

const dialogVisible = ref(false)
const editingDevice = ref(null)
const selection = ref([])
const exporting = ref(false)
const maintenanceBusy = ref(null)

const allDevices = ref([])

const stats = computed(() => {
  const list = allDevices.value
  return {
    total: list.length,
    active: list.filter(item => Number(item.is_active)).length,
    inactive: list.filter(item => !Number(item.is_active)).length,
    low: list.filter(item => Number(item.is_active) && Number(item.available_qty) <= 2).length
  }
})

const selectedActive = computed(() =>
  selection.value.filter(item => Number(item.is_active))
)

function maintenanceTone(row) {
  if (row.maintenance_status === 'repairing') return 'repair'
  if (row.maintenance_status === 'pending') return 'wait'
  return 'ok'
}

function maintenanceText(row) {
  if (row.maintenance_status === 'repairing') return '维护中'
  if (row.maintenance_status === 'pending') return '待维修'
  return '正常'
}

async function loadCategories() {
  try {
    const res = await getEnabledCategoryList()
    categoryList.value = res.data?.list || []
  } catch {
    categoryList.value = []
  }
}

async function loadStats() {
  try {
    const res = await getDeviceList({ page: 1, pageSize: 2000 })
    allDevices.value = res.data?.list || []
  } catch {
    allDevices.value = []
  }
}

async function loadDevices() {
  loading.value = true
  try {
    const res = await getDeviceList({
      name: keyword.value.trim() || undefined,
      category: category.value || undefined,
      is_active: status.value === '' ? undefined : status.value,
      page: page.value,
      pageSize
    })

    devices.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch {
    ElMessage.error('设备列表加载失败')
    devices.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadDevices()
}

const debouncedSearch = useDebounce(handleSearch, 300)

function handleReset() {
  keyword.value = ''
  category.value = ''
  status.value = ''
  page.value = 1
  loadDevices()
}

function openCreate() {
  editingDevice.value = null
  dialogVisible.value = true
}

function openEdit(row) {
  editingDevice.value = row
  dialogVisible.value = true
}

function handleSaved() {
  dialogVisible.value = false
  return Promise.all([loadDevices(), loadStats()])
}

async function handleOff(row) {
  try {
    await ElMessageBox.confirm(
      `确认下架「${row.name}」吗？下架后学生端将不可申请。`,
      '下架确认',
      { confirmButtonText: '确认下架', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    const res = await offDevice(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '下架失败')
      return
    }
    ElMessage.success('设备已下架')
    await Promise.all([loadDevices(), loadStats()])
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '下架失败')
  }
}

async function handleBatchOff() {
  const list = selectedActive.value
  if (!list.length) return

  try {
    await ElMessageBox.confirm(
      `确认批量下架选中的 ${list.length} 台设备吗？下架后学生端将不可申请。`,
      '批量下架',
      { confirmButtonText: '确认下架', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await Promise.all(list.map(item => offDevice(item.id)))
    ElMessage.success(`已下架 ${list.length} 台设备`)
    selection.value = []
    await Promise.all([loadDevices(), loadStats()])
  } catch {
    ElMessage.error('部分设备下架失败，请刷新后重试')
  }
}

function toCsv(rows) {
  const header = ['设备编号', '设备名称', '分类', '可借库存', '总库存', '存放位置', '状态', '用途说明']
  const lines = rows.map(item => [
    item.id,
    item.name,
    item.category,
    item.available_qty,
    item.total_qty,
    item.location || '',
    Number(item.is_active) ? '在库' : '已下架',
    item.description || ''
  ])

  return [header, ...lines]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

async function handleExport() {
  exporting.value = true
  try {
    const res = await getDeviceList({
      name: keyword.value.trim() || undefined,
      category: category.value || undefined,
      is_active: status.value === '' ? undefined : status.value,
      page: 1,
      pageSize: 2000
    })
    const rows = res.data?.list || []

    if (!rows.length) {
      ElMessage.warning('当前筛选条件下没有可导出的数据')
      return
    }

    const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `设备清单_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success(`已导出 ${rows.length} 条设备数据`)
  } catch {
    ElMessage.error('导出失败，请稍后重试')
  } finally {
    exporting.value = false
  }
}

function handleSelectionChange(rows) {
  selection.value = rows
}

function handlePageChange(value) {
  page.value = value
  loadDevices()
}

async function toggleMaintenance(row) {
  const repairing = row.maintenance_status === 'repairing'
  try {
    if (repairing) {
      await ElMessageBox.confirm(
        `确认「${row.name}」维护完成并恢复可借吗？`,
        '结束维护',
        { confirmButtonText: '恢复可借', cancelButtonText: '取消', type: 'warning' }
      )
    } else {
      await ElMessageBox.confirm(
        `将「${row.name}」标记为维护中后，学生端将暂停新的借用申请。`,
        '开始维护',
        { confirmButtonText: '开始维护', cancelButtonText: '取消', type: 'warning' }
      )
    }
  } catch {
    return
  }

  maintenanceBusy.value = row.id
  try {
    const res = await setDeviceMaintenance(row.id, {
      action: repairing ? 'finish' : 'start',
      reason: repairing ? '' : '管理员手动标记维护'
    })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success(repairing ? '设备已恢复可借' : '设备已进入维护状态')
    await Promise.all([loadDevices(), loadStats()])
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败，请稍后重试')
  } finally {
    maintenanceBusy.value = null
  }
}

onMounted(async () => {
  await Promise.all([loadCategories(), loadStats()])
  await loadDevices()
})
</script>

<template>
  <div class="page-shell">
    <section class="device-stats stagger">
      <div class="d-stat card">
        <span>设备总数</span>
        <strong>{{ stats.total }}</strong>
        <small>在册设备档案</small>
      </div>
      <div class="d-stat card tone-green">
        <span>在库设备</span>
        <strong>{{ stats.active }}</strong>
        <small>学生端可浏览</small>
      </div>
      <div class="d-stat card tone-amber">
        <span>低库存预警</span>
        <strong>{{ stats.low }}</strong>
        <small>可借 ≤ 2 台</small>
      </div>
      <div class="d-stat card tone-gray">
        <span>已下架</span>
        <strong>{{ stats.inactive }}</strong>
        <small>暂不对外申请</small>
      </div>
    </section>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索设备名称"
        clearable
        :prefix-icon="Search"
        @input="debouncedSearch"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />

      <el-select v-model="category" placeholder="全部分类" clearable class="select" @change="handleSearch">
        <el-option v-for="item in categoryList" :key="item.id" :label="item.name" :value="item.name" />
      </el-select>

      <el-select v-model="status" placeholder="全部状态" clearable class="select" @change="handleSearch">
        <el-option label="在库" :value="1" />
        <el-option label="已下架" :value="0" />
      </el-select>

      <div class="filter-actions">
        <el-button :loading="exporting" @click="handleExport">
          <el-icon><Download /></el-icon>
          导出
        </el-button>
        <el-button @click="handleReset">重置</el-button>
        <el-button type="primary" @click="openCreate">
          <el-icon><Plus /></el-icon>
          上架设备
        </el-button>
      </div>
    </div>

    <div class="card card-pad">
      <div class="toolbar">
        <div class="card-head">
          <h3>设备清单<span class="sub">共 {{ total }} 条</span></h3>
        </div>

        <Transition name="pop">
          <div v-if="selection.length" class="batch-bar">
            <span>已选择 <b>{{ selection.length }}</b> 项</span>
            <el-button size="small" type="danger" plain :disabled="!selectedActive.length" @click="handleBatchOff">
              批量下架
            </el-button>
          </div>
        </Transition>
      </div>

      <AppSkeleton v-if="loading" type="table" :rows="7" />

      <template v-else-if="devices.length">
        <el-table :data="devices" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="44" />
          <el-table-column label="设备名称" min-width="190">
            <template #default="{ row }">
              <div class="device-cell">
                <span class="device-initial">{{ (row.category || '设').slice(0, 1) }}</span>
                <div>
                  <strong>{{ row.name }}</strong>
                  <span>{{ row.location || '未设置存放位置' }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="category" label="分类" width="140" />

          <el-table-column label="库存" width="170">
            <template #default="{ row }">
              <div class="stock-cell">
                <span class="stock-text"><b>{{ row.available_qty }}</b> / {{ row.total_qty }} 台</span>
                <span v-if="Number(row.available_qty) <= 2" class="low-tag">低库存</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <span class="state-tag" :class="Number(row.is_active) ? 'on' : 'off'">
                {{ Number(row.is_active) ? '在库' : '已下架' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="维护" width="100">
            <template #default="{ row }">
              <span class="state-tag" :class="maintenanceTone(row)">
                {{ maintenanceText(row) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="用途说明" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="muted">{{ row.description || '暂无描述' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="230" align="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" plain @click="openEdit(row)">编辑</el-button>
              <el-button
                v-if="Number(row.is_active)"
                size="small"
                :type="row.maintenance_status === 'repairing' ? 'success' : 'warning'"
                plain
                :loading="maintenanceBusy === row.id"
                @click="toggleMaintenance(row)"
              >
                {{ row.maintenance_status === 'repairing' ? '结束维护' : '维护' }}
              </el-button>
              <el-button
                v-if="Number(row.is_active)"
                size="small"
                type="danger"
                plain
                @click="handleOff(row)"
              >
                下架
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-if="total > pageSize"
          v-model:current-page="page"
          background
          layout="prev, pager, next"
          :page-size="pageSize"
          :total="total"
          @current-change="handlePageChange"
        />
      </template>

      <EmptyState
        v-else
        title="暂无设备"
        description="调整筛选条件，或点击右上角上架设备"
        action-text="上架设备"
        @action="openCreate"
      />
    </div>

    <DeviceFormDialog
      v-model="dialogVisible"
      :device="editingDevice"
      :categories="categoryList"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped src="./deviceManage.css"></style>
