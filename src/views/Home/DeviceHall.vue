<!-- 设备大厅：收藏、排序、视图切换与借用申请 -->
<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Grid, List, MagicStick, Search, Star, StarFilled } from '@element-plus/icons-vue'
import { getDeviceList } from '@/api/device'
import { getEnabledCategoryList } from '@/api/category'
import { getMyBookings } from '@/api/student/bookings'
import { useFavoriteStore } from '@/stores/Favorite'
import { useAiStore } from '@/stores/useAiStore'
import { useUserStore } from '@/stores/useUserStore'
import { useDebounce } from '@/composables/useDebounce'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import DeviceCard from './components/DeviceCard.vue'
import DeviceDetailDrawer from './components/DeviceDetailDrawer.vue'
import DeviceApplyDialog from './components/DeviceApplyDialog.vue'
import DeviceReportDialog from './components/DeviceReportDialog.vue'
import { canApply, isRepairing } from '@/utils/device-presenter'

const route = useRoute()
const router = useRouter()
const favoriteStore = useFavoriteStore()
const ai = useAiStore()
const userStore = useUserStore()

const isBlacklisted = computed(() => Boolean(userStore.userInfo?.blacklisted))

const loading = ref(false)
const firstLoading = ref(true)
const loadError = ref(false)
const devices = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 9

const keyword = ref('')
const category = ref('')
const onlyAvailable = ref(true)
const sortBy = ref('default')
const viewMode = ref('grid')
const onlyFavorite = ref(false)

const categoryList = ref([])
const myStatusMap = ref(new Map())

const detailVisible = ref(false)
const currentDevice = ref(null)
const applyVisible = ref(false)
const applyDevice = ref(null)
const applyStartDate = ref('')
const reportVisible = ref(false)
const reportTarget = ref(null)

const palette = ['#0e7c66', '#9fbf3a', '#c98a26', '#b86a45', '#2f9e8f', '#7e9487', '#c94f45', '#c2dd63']

const activeStatusRank = { pending: 3, approved: 4, returning: 5 }

// 排序与收藏筛选都在服务端/全量数据上完成，避免只对当前页排序
const displayDevices = computed(() => devices.value)

const favoriteCount = computed(() => favoriteStore.count)

function categoryColor(name) {
  const index = categoryList.value.findIndex(item => item.name === name)
  return palette[(index < 0 ? 0 : index) % palette.length]
}

function myStatus(deviceId) {
  return myStatusMap.value.get(String(deviceId)) || null
}

function myActiveStatus(deviceId) {
  const status = myStatus(deviceId)
  if (!status) return null
  return ['pending', 'approved', 'returning'].includes(status.status) ? status : null
}

async function loadCategories() {
  try {
    const res = await getEnabledCategoryList()
    categoryList.value = res.data?.list || res.data || []
  } catch {
    categoryList.value = []
  }
}

async function loadMine() {
  try {
    const res = await getMyBookings({ page: 1, pageSize: 1000 })
    const map = new Map()

    ;(res.data?.list || []).forEach(item => {
      const key = String(item.device_id)
      const current = map.get(key)
      const nextRank = activeStatusRank[item.status] || 1
      const currentRank = current ? activeStatusRank[current.status] || 1 : 0
      if (!current || nextRank >= currentRank) {
        map.set(key, { status: item.status, id: item.id })
      }
    })

    myStatusMap.value = map
  } catch {
    myStatusMap.value = new Map()
  }
}

async function loadDevices() {
  loading.value = true
  loadError.value = false
  try {
    const params = {
      name: keyword.value.trim() || undefined,
      category: category.value || undefined,
      is_active: 1,
      available: onlyAvailable.value ? 1 : undefined,
      sort: sortBy.value === 'default' ? undefined : sortBy.value
    }

    if (onlyFavorite.value) {
      // 收藏是本地状态，取全量后本地筛选并分页，避免只筛当前页
      const res = await getDeviceList({ ...params, page: 1, pageSize: 500 })
      const list = (res.data?.list || []).filter(item => favoriteStore.has(item.id))
      total.value = list.length
      const lastPage = Math.max(1, Math.ceil(list.length / pageSize))
      if (page.value > lastPage) page.value = lastPage
      const start = (page.value - 1) * pageSize
      devices.value = list.slice(start, start + pageSize)
    } else {
      const res = await getDeviceList({ ...params, page: page.value, pageSize })
      if (res.code !== 200) throw new Error(res.message || '加载失败')
      const list = res.data?.list || []
      const totalCount = Number(res.data?.total || 0)
      const lastPage = Math.max(1, Math.ceil(totalCount / pageSize))
      if (!list.length && totalCount > 0 && page.value > lastPage) {
        page.value = lastPage
        return loadDevices()
      }
      devices.value = list
      total.value = totalCount
    }

    syncQuery()
  } catch {
    loadError.value = true
    devices.value = []
    total.value = 0
  } finally {
    loading.value = false
    firstLoading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadDevices()
}

function showAllDevices() {
  onlyFavorite.value = false
  handleSearch()
}

const debouncedSearch = useDebounce(() => {
  page.value = 1
  loadDevices()
}, 300)

function selectCategory(name) {
  category.value = category.value === name ? '' : name
  handleSearch()
}

// 筛选条件写入 URL，刷新/分享/前进后退都能还原同一视图
let syncingQuery = false

function syncQuery() {
  const query = {}
  if (keyword.value.trim()) query.keyword = keyword.value.trim()
  if (category.value) query.category = category.value
  if (sortBy.value !== 'default') query.sort = sortBy.value
  if (!onlyAvailable.value) query.available = '0'
  if (onlyFavorite.value) query.fav = '1'
  if (viewMode.value === 'list') query.view = 'list'
  if (page.value > 1) query.page = String(page.value)

  syncingQuery = true
  router.replace({ query }).finally(() => {
    syncingQuery = false
  })
}

function readQueryState() {
  const query = route.query
  return {
    keyword: typeof query.keyword === 'string' ? query.keyword : '',
    category: typeof query.category === 'string' ? query.category : '',
    sortBy: ['stock', 'name', 'category'].includes(query.sort) ? query.sort : 'default',
    onlyAvailable: query.available !== '0',
    onlyFavorite: query.fav === '1',
    viewMode: query.view === 'list' ? 'list' : 'grid',
    page: Math.max(1, Number(query.page) || 1)
  }
}

function applyQueryState() {
  const next = readQueryState()
  const filtersChanged =
    next.keyword !== keyword.value ||
    next.category !== category.value ||
    next.sortBy !== sortBy.value ||
    next.onlyAvailable !== onlyAvailable.value ||
    next.onlyFavorite !== onlyFavorite.value

  keyword.value = next.keyword
  category.value = next.category
  sortBy.value = next.sortBy
  onlyAvailable.value = next.onlyAvailable
  onlyFavorite.value = next.onlyFavorite
  viewMode.value = next.viewMode
  page.value = next.page

  if (filtersChanged) loadDevices()
}

watch(
  () => route.fullPath,
  () => {
    if (syncingQuery) return
    applyQueryState()
  }
)

function handleReset() {
  keyword.value = ''
  category.value = ''
  onlyAvailable.value = true
  sortBy.value = 'default'
  onlyFavorite.value = false
  page.value = 1
  loadDevices()
}

function openDetail(device) {
  currentDevice.value = device
  detailVisible.value = true
}

function openApply(device, startDate = '') {
  if (isBlacklisted.value) {
    ElMessage.error(
      `账号已被限制借用：${userStore.userInfo?.blacklist_reason || '请联系实验室管理员'}`
    )
    return
  }

  if (isRepairing(device)) {
    ElMessage.warning('该设备正在维护中，暂时无法借用')
    return
  }

  if (!canApply(device, { blacklisted: isBlacklisted.value, activeStatus: myActiveStatus(device.id) })) {
    if (!Number(device.available_qty)) {
      ElMessage.warning('该设备当前没有可借库存')
    } else {
      ElMessage.warning('你已有该设备的进行中申请')
    }
    return
  }

  applyDevice.value = device
  applyStartDate.value = startDate
  applyVisible.value = true
}

function handleApplySuccess() {
  applyVisible.value = false
  detailVisible.value = false
  return Promise.all([loadDevices(), loadMine()])
}

function openReport(device) {
  if (!device) return
  if (isRepairing(device)) {
    ElMessage.info('该设备已在维修中，管理员正在处理')
    return
  }
  reportTarget.value = device
  reportVisible.value = true
}

function handleReportSuccess() {
  reportVisible.value = false
  detailVisible.value = false
  return loadDevices()
}

function toggleFavorite(device) {
  const added = favoriteStore.toggle(device.id)
  ElMessage({
    message: added ? `已收藏「${device.name}」` : `已取消收藏「${device.name}」`,
    type: added ? 'success' : 'info',
    duration: 1600
  })
}

function askAi() {
  ai.openWith('我最近准备做实验，帮我推荐几台当前可借、适合我的设备')
}

function handlePageChange(value) {
  page.value = value
  loadDevices()
}

onMounted(async () => {
  const queryState = readQueryState()
  keyword.value = queryState.keyword
  category.value = queryState.category
  sortBy.value = queryState.sortBy
  onlyAvailable.value = queryState.onlyAvailable
  onlyFavorite.value = queryState.onlyFavorite
  viewMode.value = queryState.viewMode
  page.value = queryState.page

  await Promise.all([loadCategories(), loadMine()])
  await loadDevices()
})
</script>

<template>
  <div class="page-shell">
    <div class="hall-head">
      <div class="head-left">
        <span class="eyebrow">DEVICE HALL</span>
        <h1>设备大厅</h1>
        <p>浏览实验室在册设备，收藏常用设备并提交借用申请</p>
      </div>

      <div class="head-right">
        <button type="button" class="ai-pick" @click="askAi">
          <el-icon><MagicStick /></el-icon>
          AI 帮我挑
        </button>
        <div class="head-metric">
          <span>可借设备</span>
          <strong>{{ total }}</strong>
        </div>
        <div class="head-metric">
          <span>我的收藏</span>
          <strong>{{ favoriteCount }}</strong>
        </div>
        <div class="view-switch" role="group" aria-label="切换设备展示方式">
          <button
            type="button"
            :class="{ active: viewMode === 'grid' }"
            :aria-pressed="viewMode === 'grid'"
            aria-label="卡片视图"
            title="卡片视图"
            @click="viewMode = 'grid'; syncQuery()"
          >
            <el-icon><Grid /></el-icon>
          </button>
          <button
            type="button"
            :class="{ active: viewMode === 'list' }"
            :aria-pressed="viewMode === 'list'"
            aria-label="列表视图"
            title="列表视图"
            @click="viewMode = 'list'; syncQuery()"
          >
            <el-icon><List /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        class="search-input"
        placeholder="搜索设备名称或用途"
        clearable
        :prefix-icon="Search"
        aria-label="搜索设备"
        @input="debouncedSearch"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />

      <el-select v-model="category" placeholder="全部分类" clearable class="category-select" @change="handleSearch">
        <el-option v-for="item in categoryList" :key="item.id" :label="item.name" :value="item.name" />
      </el-select>

      <el-select v-model="sortBy" class="sort-select" aria-label="排序方式" @change="handleSearch">
        <el-option label="默认排序" value="default" />
        <el-option label="库存优先" value="stock" />
        <el-option label="按名称" value="name" />
        <el-option label="按分类" value="category" />
      </el-select>

      <el-switch
        v-model="onlyAvailable"
        active-text="仅看可借"
        aria-label="仅看可借设备"
        @change="handleSearch"
      />

      <button
        type="button"
        class="fav-filter"
        :class="{ active: onlyFavorite }"
        :aria-pressed="onlyFavorite"
        @click="onlyFavorite = !onlyFavorite; handleSearch()"
      >
        <el-icon><StarFilled v-if="onlyFavorite" /><Star v-else /></el-icon>
        仅看收藏
      </button>

      <div class="filter-actions">
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>
    </div>

    <div class="category-chips">
      <button
        type="button"
        class="chip"
        :class="{ active: !category }"
        :aria-pressed="!category"
        @click="selectCategory('')"
      >
        全部
      </button>
      <button
        v-for="item in categoryList"
        :key="item.id"
        type="button"
        class="chip"
        :class="{ active: category === item.name }"
        :aria-pressed="category === item.name"
        @click="selectCategory(item.name)"
      >
        {{ item.name }}
      </button>
    </div>

    <div v-if="firstLoading" class="device-grid">
      <div v-for="i in 6" :key="i" class="skeleton-cell">
        <AppSkeleton type="card" />
      </div>
    </div>

    <div v-else v-loading="loading" class="device-area">
      <TransitionGroup
        v-if="displayDevices.length"
        name="device"
        tag="div"
        :class="viewMode === 'grid' ? 'device-grid' : 'device-list'"
      >
        <DeviceCard
          v-for="(device, index) in displayDevices"
          :key="device.id"
          :device="device"
          :favorite="favoriteStore.has(device.id)"
          :active-status="myActiveStatus(device.id)"
          :blacklisted="isBlacklisted"
          :accent="categoryColor(device.category)"
          :index="index"
          :list-mode="viewMode === 'list'"
          @open="openDetail"
          @toggle-favorite="toggleFavorite"
          @apply="openApply"
        />
      </TransitionGroup>

      <EmptyState
        v-else-if="loadError"
        class="card"
        tone="error"
        title="设备列表加载失败"
        description="网络或服务暂不可用，请稍后重试"
        action-text="重新加载"
        @action="loadDevices"
      />

      <EmptyState
        v-else-if="!loading"
        class="card"
        :title="onlyFavorite ? '还没有收藏设备' : '没有找到符合条件的设备'"
        :description="onlyFavorite ? '点击设备卡片右上角的星标即可收藏，方便下次快速找到' : '试试更换关键词、分类，或关闭「仅看可借」'"
        :action-text="onlyFavorite ? '查看全部设备' : '重置筛选'"
        @action="onlyFavorite ? showAllDevices() : handleReset()"
      />
    </div>

    <el-pagination
      v-if="total > pageSize"
      v-model:current-page="page"
      background
      layout="prev, pager, next"
      :pager-count="5"
      :page-size="pageSize"
      :total="total"
      @current-change="handlePageChange"
    />

    <DeviceDetailDrawer
      v-model="detailVisible"
      :device="currentDevice"
      :favorite="currentDevice ? favoriteStore.has(currentDevice.id) : false"
      :blacklisted="isBlacklisted"
      :active-status="currentDevice ? myActiveStatus(currentDevice.id) : null"
      :accent="currentDevice ? categoryColor(currentDevice.category) : '#0e7c66'"
      @toggle-favorite="toggleFavorite"
      @report="openReport"
      @apply="openApply"
      @apply-day="date => openApply(currentDevice, date)"
    />

    <DeviceApplyDialog
      v-model="applyVisible"
      :device="applyDevice"
      :start-date="applyStartDate"
      @success="handleApplySuccess"
    />

    <DeviceReportDialog
      v-model="reportVisible"
      :device="reportTarget"
      @success="handleReportSuccess"
    />
  </div>
</template>

<style scoped src="./DeviceHall.css"></style>
