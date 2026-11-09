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
import { getCategoryStats, getOverview, getRecentBookings, getTrend, getUsageHeatmap } from '@/api/stats'
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
const loadError = ref(false)
const overview = ref({})
const trend = ref([])
const categories = ref([])
const recent = ref([])
const pendingList = ref([])
const approvingId = ref(null)
const heatmap = ref({ cells: [], max: 0, avg: 0, totalDevices: 0 })
const heatmapError = ref('')

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

function heatLevel(count) {
  const value = Number(count) || 0
  const peak = Number(heatmap.value?.max) || 0
  if (value <= 0) return 0
  if (peak <= 0) return 1
  // 以窗口内峰值为基准分四档，避免全部落到同一色阶
  return Math.min(4, Math.max(1, Math.ceil((value / peak) * 4)))
}

const peakDays = computed(() => {
  const peak = Number(heatmap.value?.max) || 1
  return [...(heatmap.value?.cells || [])]
    .filter(cell => Number(cell.borrowed) > 0)
    .sort((a, b) => b.borrowed - a.borrowed || (a.date < b.date ? 1 : -1))
    .slice(0, 3)
    .map(cell => ({
      date: cell.date,
      label: `${cell.date.slice(5)} 周${weekdayLabels[cell.weekday] || ''}`,
      borrowed: cell.borrowed,
      percent: Math.max(8, Math.round((cell.borrowed / peak) * 100))
    }))
})

const todayText = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

const sparkApplications = computed(() => trend.value.slice(-12).map(item => item.applications))
const sparkApprovals = computed(() => trend.value.slice(-12).map(item => item.approvals))

// 图表配色跟随主题，避免深色模式下坐标文字/轴线仍是浅色硬编码
const chartTheme = computed(() => ({
  text: ui.isDark ? '#9db3a4' : '#7e9487',
  axis: ui.isDark ? 'rgba(157,179,164,0.22)' : '#dfe8d8',
  split: ui.isDark ? 'rgba(157,179,164,0.1)' : 'rgba(126,148,135,0.14)',
  pieBorder: ui.isDark ? '#0d1a14' : '#ffffff',
  primary: ui.isDark ? '#5fd0b2' : '#0e7c66',
  accent: ui.isDark ? '#c2dd63' : '#9fbf3a'
}))

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
    textStyle: { color: chartTheme.value.text, fontSize: 11.5 }
  },
  grid: { left: 2, right: 8, top: 38, bottom: 2, containLabel: true },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: trend.value.map(item => item.date),
    axisLine: { lineStyle: { color: chartTheme.value.axis } },
    axisTick: { show: false },
    axisLabel: { color: chartTheme.value.text, fontSize: 10.5, interval: 4 }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: chartTheme.value.split } },
    axisLabel: { color: chartTheme.value.text, fontSize: 10.5 }
  },
  series: [
    {
      name: '申请量',
      type: 'line',
      smooth: 0.32,
      smoothMonotone: 'x',
      showSymbol: false,
      data: trend.value.map(item => item.applications),
      lineStyle: { width: 2.6, color: chartTheme.value.primary, shadowColor: 'rgba(14,124,102,0.3)', shadowBlur: 12, shadowOffsetY: 6 },
      itemStyle: { color: chartTheme.value.primary },
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
      lineStyle: { width: 2.2, color: chartTheme.value.accent },
      itemStyle: { color: chartTheme.value.accent }
    }
  ]
}))

const stockOption = computed(() => ({
  color: [chartTheme.value.primary, ui.isDark ? 'rgba(157,179,164,0.22)' : 'rgba(126,148,135,0.18)'],
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
    textStyle: { color: chartTheme.value.text, fontSize: 11.5 }
  },
  series: [
    {
      type: 'pie',
      radius: ['58%', '78%'],
      center: ['50%', '43%'],
      padAngle: 2,
      itemStyle: { borderRadius: 8, borderColor: chartTheme.value.pieBorder, borderWidth: 2 },
      label: {
        show: true,
        position: 'center',
        formatter: () => `${overview.value.utilizationRate || 0}%\n利用率`,
        fontSize: 15,
        fontWeight: 600,
        color: chartTheme.value.primary,
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
      splitLine: { lineStyle: { color: chartTheme.value.split } },
      axisLabel: { color: chartTheme.value.text, fontSize: 10.5, formatter: '{value}%' }
    },
    yAxis: {
      type: 'category',
      data: list.map(item => (item.name.length > 6 ? `${item.name.slice(0, 6)}…` : item.name)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: chartTheme.value.text, fontSize: 11.5 }
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
              { offset: 0, color: ui.isDark ? 'rgba(95,208,178,0.32)' : 'rgba(14,124,102,0.4)' },
              { offset: 1, color: chartTheme.value.primary }
            ]
          }
        },
        label: { show: true, position: 'right', color: chartTheme.value.text, fontSize: 10.5, formatter: '{c}%' }
      }
    ]
  }
})

async function loadHeatmap() {
  heatmapError.value = ''
  try {
    const res = await getUsageHeatmap(12)
    if (res.code === 200) {
      heatmap.value = res.data || { cells: [] }
    } else {
      heatmapError.value = res.message || '热力图加载失败'
    }
  } catch (error) {
    heatmapError.value = error?.response?.data?.message || '热力图加载失败'
  }
}

async function loadData() {
  loading.value = true
  loadError.value = false
  heatmapError.value = ''
  try {
    // 六个接口相互独立：单个失败不影响其余模块展示
    const [overviewRes, trendRes, categoryRes, recentRes, pendingRes, heatmapRes] =
      await Promise.allSettled([
        getOverview(),
        getTrend(30),
        getCategoryStats(),
        getRecentBookings(6),
        getPendingBookings({ page: 1, pageSize: 5 }),
        getUsageHeatmap(12)
      ])

    let success = 0
    if (overviewRes.status === 'fulfilled' && overviewRes.value.code === 200) {
      overview.value = overviewRes.value.data || {}
      success += 1
    }
    if (trendRes.status === 'fulfilled' && trendRes.value.code === 200) {
      trend.value = trendRes.value.data || []
      success += 1
    }
    if (categoryRes.status === 'fulfilled' && categoryRes.value.code === 200) {
      categories.value = categoryRes.value.data || []
      success += 1
    }
    if (recentRes.status === 'fulfilled' && recentRes.value.code === 200) {
      recent.value = recentRes.value.data || []
      success += 1
    }
    if (pendingRes.status === 'fulfilled' && pendingRes.value.code === 200) {
      pendingList.value = pendingRes.value.data?.list || []
      success += 1
    }
    if (heatmapRes.status === 'fulfilled' && heatmapRes.value.code === 200) {
      heatmap.value = heatmapRes.value.data || { cells: [] }
      success += 1
    } else {
      heatmapError.value = '热力图加载失败'
    }

    if (!success) {
      loadError.value = true
      ElMessage.error('数据加载失败，请确认本地后端已启动')
    } else if (success < 6) {
      ElMessage.warning('部分看板数据加载失败，已展示可用部分')
    }
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
        <button
          class="refresh-btn"
          type="button"
          :class="{ spinning: loading }"
          :disabled="loading"
          aria-label="刷新看板数据"
          @click="loadData"
        >
          <el-icon><Refresh /></el-icon>
          刷新数据
        </button>
      </div>
    </section>

    <div v-if="loadError" class="load-error-bar" role="alert">
      <el-icon><Warning /></el-icon>
      <span>看板数据加载失败，当前展示可能不是最新数据。</span>
      <button type="button" @click="loadData">重试</button>
    </div>

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
        <BaseChart v-else-if="trend.length" :option="trendOption" height="268px" />
        <EmptyState v-else compact title="暂无趋势数据" description="有借用申请后即可看到近 30 天走势" />
      </div>

      <div class="card card-pad">
        <div class="card-head">
          <h3>库存结构</h3>
          <span class="muted small">已借出 / 可借库存</span>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="268px" />
        <BaseChart
          v-else-if="(overview.borrowedQty || 0) + (overview.availableQty || 0) > 0"
          :option="stockOption"
          height="268px"
        />
        <EmptyState v-else compact title="暂无库存数据" description="录入设备后即可查看库存结构" />
      </div>
    </section>

    <section class="grid-2 fade-up fade-up-2">
      <div class="card card-pad">
        <div class="card-head">
          <h3>分类利用率</h3>
          <span class="muted small">当前借出占库存比例</span>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="260px" />
        <BaseChart
          v-else-if="categories.some(item => item.total > 0)"
          :option="categoryOption"
          height="260px"
        />
        <EmptyState v-else compact title="暂无分类数据" description="录入设备并产生借用后展示" />
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

    <section class="card card-pad fade-up fade-up-3 heatmap-card">
      <div class="card-head">
        <h3>设备使用率热力图<span class="sub">近 12 周</span></h3>
        <span class="muted small">每日借出设备数量，颜色按窗口峰值归一</span>
      </div>

      <AppSkeleton v-if="loading" type="chart" height="190px" />

      <EmptyState
        v-else-if="heatmapError"
        tone="error"
        compact
        title="热力图加载失败"
        :description="heatmapError"
        action-text="重新加载"
        @action="loadHeatmap"
      />

      <div v-else-if="heatmap.cells?.length" class="heatmap-wrap">
        <div class="heatmap-main">
          <div class="heatmap-body">
            <div class="heat-weekdays" aria-hidden="true">
              <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
            </div>
            <div class="heatmap-grid" role="img" :aria-label="`近 12 周设备使用热力图，峰值 ${heatmap.max} 台，均值 ${heatmap.avg} 台`">
              <button
                v-for="cell in heatmap.cells"
                :key="cell.date"
                type="button"
                class="heat-cell"
                :class="`level-${heatLevel(cell.borrowed)}`"
                :title="`${cell.date} · 借出 ${cell.borrowed} 台 · 占库存 ${cell.rate}%`"
                :aria-label="`${cell.date} 借出 ${cell.borrowed} 台设备，占库存 ${cell.rate}%`"
              ></button>
            </div>
          </div>

          <div class="heatmap-legend">
            <span>峰值 {{ heatmap.max }} 台/日 · 均值 {{ heatmap.avg }} 台/日 · 库存 {{ heatmap.totalDevices }} 台</span>
            <span class="legend-scale">
              低
              <i class="level-0"></i>
              <i class="level-1"></i>
              <i class="level-2"></i>
              <i class="level-3"></i>
              <i class="level-4"></i>
              高
            </span>
          </div>
        </div>

        <div v-if="peakDays.length" class="heatmap-top">
          <span class="top-title">借出高峰</span>
          <ul>
            <li v-for="item in peakDays" :key="item.date">
              <span class="top-date">{{ item.label }}</span>
              <span class="top-bar"><i :style="{ width: `${item.percent}%` }"></i></span>
              <span class="top-count">{{ item.borrowed }} 台</span>
            </li>
          </ul>
        </div>
      </div>

      <EmptyState
        v-else
        compact
        title="暂无可统计的使用数据"
        description="设备产生借用记录后，这里会按天展示使用率变化"
      />
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
