<!-- 管理端数据总览 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import BaseChart from '@/components/charts/BaseChart.vue'
import StatCard from '@/components/common/StatCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { getCategoryStats, getOverview, getRecentBookings, getTrend } from '@/api/stats'
import { auditBooking, getPendingBookings } from '@/api/Admin/admin'
import { useUiStore } from '@/stores/Ui'
import { formatDate } from '@/utils/date'
import {
  Box,
  Clock,
  Refresh,
  RefreshLeft,
  Tickets,
  User,
  Warning
} from '@element-plus/icons-vue'

const router = useRouter()
const ui = useUiStore()

const loading = ref(true)
const overview = ref({})
const trend = ref([])
const categories = ref([])
const recent = ref([])
const pendingList = ref([])
const approvingId = ref(null)

const todayText = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

const sparkApplications = computed(() => trend.value.slice(-12).map(item => item.applications))
const sparkApprovals = computed(() => trend.value.slice(-12).map(item => item.approvals))

const trendOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(6,18,14,0.94)',
    borderWidth: 0,
    textStyle: { color: '#fff', fontSize: 12 }
  },
  legend: {
    right: 0,
    top: 0,
    icon: 'roundRect',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 16,
    textStyle: { color: '#7e9487', fontSize: 11.5 }
  },
  grid: { left: 2, right: 8, top: 38, bottom: 2, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trend.value.map(item => item.date),
    axisLine: { lineStyle: { color: '#dfe8d8' } },
    axisTick: { show: false },
    axisLabel: { color: '#7e9487', fontSize: 10.5, interval: 4 }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(126,148,135,0.14)' } },
    axisLabel: { color: '#7e9487', fontSize: 10.5 }
  },
  series: [
    {
      name: '申请量',
      type: 'line',
      smooth: 0.32,
      smoothMonotone: 'x',
      showSymbol: false,
      data: trend.value.map(item => item.applications),
      lineStyle: { width: 2.6, color: '#0e7c66', shadowColor: 'rgba(14,124,102,0.3)', shadowBlur: 12, shadowOffsetY: 6 },
      itemStyle: { color: '#0e7c66' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(14,124,102,0.22)' },
            { offset: 1, color: 'rgba(14,124,102,0.01)' }
          ]
        }
      }
    },
    {
      name: '通过量',
      type: 'line',
      smooth: 0.32,
      smoothMonotone: 'x',
      showSymbol: false,
      data: trend.value.map(item => item.approvals),
      lineStyle: { width: 2.2, color: '#9fbf3a' },
      itemStyle: { color: '#9fbf3a' }
    }
  ]
}))

const stockOption = computed(() => ({
  color: ['#0e7c66', 'rgba(126,148,135,0.18)'],
  tooltip: {
    trigger: 'item',
    formatter: '{b}：{c} 台（{d}%）',
    backgroundColor: 'rgba(6,18,14,0.94)',
    borderWidth: 0,
    textStyle: { color: '#fff', fontSize: 12 }
  },
  legend: {
    bottom: 0,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 11,
    textStyle: { color: '#7e9487', fontSize: 11.5 }
  },
  series: [
    {
      type: 'pie',
      radius: ['58%', '78%'],
      center: ['50%', '43%'],
      padAngle: 2,
      itemStyle: { borderRadius: 8, borderColor: ui.isDark ? '#0d1a14' : '#ffffff', borderWidth: 2 },
      label: {
        show: true,
        position: 'center',
        formatter: () => `${overview.value.utilizationRate || 0}%\n利用率`,
        fontSize: 15,
        fontWeight: 600,
        color: '#0e7c66',
        lineHeight: 22
      },
      emphasis: { label: { show: true } },
      data: [
        { name: '已借出', value: overview.value.borrowedQty || 0 },
        { name: '可借库存', value: overview.value.availableQty || 0 }
      ]
    }
  ]
}))

const categoryOption = computed(() => {
  const list = categories.value
    .filter(item => item.total > 0)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 7)
    .reverse()

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const item = list[params[0].dataIndex]
        return `${item.name}<br/>借出 ${item.borrowed}/${item.total} 台<br/>利用率 ${item.rate}%`
      },
      backgroundColor: 'rgba(6,18,14,0.94)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 }
    },
    grid: { left: 2, right: 38, top: 8, bottom: 2, containLabel: true },
    xAxis: {
      type: 'value',
      max: 100,
      splitLine: { lineStyle: { color: 'rgba(126,148,135,0.14)' } },
      axisLabel: { color: '#7e9487', fontSize: 10.5, formatter: '{value}%' }
    },
    yAxis: {
      type: 'category',
      data: list.map(item => (item.name.length > 6 ? `${item.name.slice(0, 6)}…` : item.name)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#7e9487', fontSize: 11.5 }
    },
    series: [
      {
        type: 'bar',
        data: list.map(item => item.rate),
        barWidth: 12,
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: 'rgba(14,124,102,0.4)' },
              { offset: 1, color: '#0e7c66' }
            ]
          }
        },
        label: { show: true, position: 'right', color: '#7e9487', fontSize: 10.5, formatter: '{c}%' }
      }
    ]
  }
})

async function loadData() {
  loading.value = true
  try {
    const [overviewRes, trendRes, categoryRes, recentRes, pendingRes] = await Promise.all([
      getOverview(),
      getTrend(30),
      getCategoryStats(),
      getRecentBookings(6),
      getPendingBookings({ page: 1, pageSize: 5 })
    ])

    overview.value = overviewRes.data || {}
    trend.value = trendRes.data || []
    categories.value = categoryRes.data || []
    recent.value = recentRes.data || []
    pendingList.value = pendingRes.data?.list || []
  } catch {
    ElMessage.error('数据加载失败，请确认本地后端已启动')
  } finally {
    loading.value = false
  }
}

async function quickApprove(row) {
  try {
    await ElMessageBox.confirm(
      `确认通过「${row.user_name}」对「${row.device_name}」的借用申请？`,
      '审批确认',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  approvingId.value = row.id
  try {
    const res = await auditBooking(row.id, { action: 'approve' })
    if (res.code !== 200) {
      ElMessage.error(res.message || '审批失败')
      return
    }
    ElMessage.success('已通过该申请')
    await loadData()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '审批失败')
  } finally {
    approvingId.value = null
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-shell">
    <!-- 今日运营 -->
    <section class="ops-banner fade-up">
      <div class="ops-copy">
        <span class="eyebrow">
          <i class="live-dot"></i>
          OPERATIONS · {{ todayText }}
        </span>
        <h1>今日运营概览</h1>
        <p>
          待审核 <b>{{ overview.pending || 0 }}</b> 条 · 逾期未还 <b :class="{ warn: Number(overview.overdue) > 0 }">{{ overview.overdue || 0 }}</b> 条 ·
          当前设备利用率 <b>{{ overview.utilizationRate || 0 }}%</b>
        </p>
      </div>

      <div class="ops-actions">
        <el-button type="primary" @click="router.push('/admin/apply')">
          <el-icon><Tickets /></el-icon>
          处理待审核
        </el-button>
        <el-button @click="router.push('/admin/device')">
          <el-icon><Box /></el-icon>
          设备管理
        </el-button>
        <button class="refresh-btn" type="button" :class="{ spinning: loading }" @click="loadData">
          <el-icon><Refresh /></el-icon>
          刷新数据
        </button>
      </div>
    </section>

    <section class="stat-grid cols-6 stagger">
      <template v-if="loading">
        <div v-for="i in 6" :key="i" class="card card-pad">
          <AppSkeleton type="stat" />
        </div>
      </template>
      <template v-else>
        <StatCard label="在册设备" :value="overview.deviceCount || 0" unit="台" tone="primary" :hint="`库存 ${overview.totalQty || 0} 台`">
          <template #icon><el-icon><Box /></el-icon></template>
        </StatCard>

        <StatCard label="当前借出" :value="overview.borrowedQty || 0" unit="台" tone="cyan" :hint="`利用率 ${overview.utilizationRate || 0}%`" :spark="sparkApprovals">
          <template #icon><el-icon><RefreshLeft /></el-icon></template>
        </StatCard>

        <StatCard label="待审核" :value="overview.pending || 0" unit="条" tone="amber" hint="需要尽快处理">
          <template #icon><el-icon><Tickets /></el-icon></template>
        </StatCard>

        <StatCard label="逾期未还" :value="overview.overdue || 0" unit="条" tone="red" hint="已超过归还日期">
          <template #icon><el-icon><Warning /></el-icon></template>
        </StatCard>

        <StatCard label="本月申请" :value="overview.monthBookings || 0" unit="条" tone="violet" :hint="`今日 ${overview.todayBookings || 0} 条`" :spark="sparkApplications">
          <template #icon><el-icon><Clock /></el-icon></template>
        </StatCard>

        <StatCard label="注册学生" :value="overview.studentCount || 0" unit="人" tone="green" hint="含演示账号">
          <template #icon><el-icon><User /></el-icon></template>
        </StatCard>
      </template>
    </section>

    <section class="grid-2 fade-up fade-up-1">
      <div class="card card-pad">
        <div class="card-head">
          <h3>借用趋势<span class="sub">近 30 天</span></h3>
          <span class="muted small">申请量与审批量</span>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="268px" />
        <BaseChart v-else :option="trendOption" height="268px" />
      </div>

      <div class="card card-pad">
        <div class="card-head">
          <h3>库存结构</h3>
          <span class="muted small">已借出 / 可借库存</span>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="268px" />
        <BaseChart v-else :option="stockOption" height="268px" />
      </div>
    </section>

    <section class="grid-2 fade-up fade-up-2">
      <div class="card card-pad">
        <div class="card-head">
          <h3>分类利用率</h3>
          <span class="muted small">当前借出占库存比例</span>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="260px" />
        <BaseChart v-else :option="categoryOption" height="260px" />
      </div>

      <div class="card card-pad">
        <div class="card-head">
          <h3>最近申请</h3>
          <router-link to="/admin/apply" class="more-link">申请管理 →</router-link>
        </div>

        <AppSkeleton v-if="loading" type="list" :rows="5" />

        <div v-else-if="recent.length" class="recent-list">
          <div v-for="item in recent" :key="item.id" class="recent-item">
            <span class="recent-avatar">{{ (item.user_name || '?').slice(0, 1) }}</span>
            <div class="recent-main">
              <strong>{{ item.device_name }}</strong>
              <span>{{ item.user_name }} · {{ formatDate(item.created_at) }}</span>
            </div>
            <StatusPill :status="item.status" size="sm" />
          </div>
        </div>

        <EmptyState v-else compact title="暂无申请记录" description="学生提交申请后会在这里展示" />
      </div>
    </section>

    <section class="card card-pad fade-up fade-up-3">
      <div class="card-head">
        <h3>待审核申请<span class="sub">最多显示 5 条</span></h3>
        <router-link to="/admin/apply" class="more-link">查看全部 →</router-link>
      </div>

      <AppSkeleton v-if="loading" type="table" :rows="4" />

      <el-table v-else-if="pendingList.length" :data="pendingList">
        <el-table-column label="设备" min-width="180">
          <template #default="{ row }">
            <div class="device-cell">
              <strong>{{ row.device_name }}</strong>
              <span>{{ row.category }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="申请人" width="130">
          <template #default="{ row }">
            <div class="user-cell">
              <span class="mini-avatar">{{ (row.user_name || '?').slice(0, 1) }}</span>
              {{ row.user_name }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="借用时间" min-width="200">
          <template #default="{ row }">
            {{ row.borrow_start }} → {{ row.borrow_end }}
          </template>
        </el-table-column>
        <el-table-column label="提交时间" width="120">
          <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :loading="approvingId === row.id"
              @click="quickApprove(row)"
            >
              通过
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <EmptyState
        v-else
        compact
        title="没有待处理的申请"
        description="所有借用申请都已处理完毕，保持高效运转"
      />
    </section>
  </div>
</template>

<style scoped src="./AdminDashboard.css"></style>
