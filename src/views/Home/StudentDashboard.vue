<!-- 学生端数据看板：极光工作台 -->
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseChart from '@/components/charts/BaseChart.vue'
import StatCard from '@/components/common/StatCard.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useUserStore } from '@/stores/useUserStore'
import { useUiStore } from '@/stores/Ui'
import { getCategoryStats, getOverview, getTrend, getUtilization } from '@/api/stats'
import { getMyBookings } from '@/api/student/bookings'
import { getDeviceList } from '@/api/device'
import { formatShortDate as formatDate } from '@/utils/date'
import { ArrowRight, Bell, Box, Clock, Document, TrendCharts } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const ui = useUiStore()

const loading = ref(true)
const overview = ref({})
const trend = ref([])
const categories = ref([])
const utilization = ref([])
const myBookings = ref([])
const recommended = ref([])

const displayName = computed(
  () => userStore.userInfo?.name || userStore.userInfo?.account || '同学'
)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '凌晨好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const todayText = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

const mine = computed(() => overview.value.mine || {})
const rate = computed(() => Number(overview.value.utilizationRate || 0))
const ringDeg = computed(() => Math.min(360, (rate.value / 100) * 360))

const sparkApplications = computed(() => trend.value.slice(-10).map(item => item.applications))
const sparkApprovals = computed(() => trend.value.slice(-10).map(item => item.approvals))

const notices = [
  {
    id: 1,
    day: '23',
    month: '10月',
    tag: '规则',
    title: '设备借用周期调整',
    text: '单次借用最长 14 天，逾期将影响个人信用分。'
  },
  {
    id: 2,
    day: '21',
    month: '10月',
    tag: '通知',
    title: 'A 栋实验室周末开放时间',
    text: '周末开放时间调整为 09:00 - 17:30，请合理安排实验。'
  },
  {
    id: 3,
    day: '18',
    month: '10月',
    tag: '上新',
    title: '新增 6 台国产示波器',
    text: '电子测量分类新增设备，现已开放预约。'
  }
]

const trendOption = computed(() => ({
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(6,18,14,0.94)',
    borderWidth: 0,
    padding: [10, 14],
    textStyle: { color: '#fff', fontSize: 12 },
    axisPointer: { type: 'line', lineStyle: { color: 'rgba(14,124,102,0.3)' } }
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
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,
      data: trend.value.map(item => item.applications),
      lineStyle: { width: 2.6, color: '#0e7c66', shadowColor: 'rgba(14,124,102,0.35)', shadowBlur: 12, shadowOffsetY: 6 },
      itemStyle: { color: '#0e7c66' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(14,124,102,0.24)' },
            { offset: 1, color: 'rgba(14,124,102,0.01)' }
          ]
        }
      }
    },
    {
      name: '审批通过',
      type: 'line',
      smooth: 0.32,
      smoothMonotone: 'x',
      showSymbol: false,
      data: trend.value.map(item => item.approvals),
      lineStyle: { width: 2.2, color: '#9fbf3a' },
      itemStyle: { color: '#9fbf3a' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(159,191,58,0.18)' },
            { offset: 1, color: 'rgba(159,191,58,0.01)' }
          ]
        }
      }
    }
  ]
}))

const categoryOption = computed(() => {
  const sorted = [...categories.value].sort((a, b) => b.total - a.total)
  const top = sorted.slice(0, 6)
  const rest = sorted.slice(6)
  const data = top.map(item => ({ name: item.name, value: item.total }))
  if (rest.length) {
    data.push({ name: '其他', value: rest.reduce((sum, item) => sum + item.total, 0) })
  }

  return {
    color: ['#0e7c66', '#9fbf3a', '#c98a26', '#b86a45', '#2f9e8f', '#7e9487', '#c2dd63'],
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>{c} 台（{d}%）',
      backgroundColor: 'rgba(6,18,14,0.94)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 }
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 11,
      textStyle: { color: '#7e9487', fontSize: 11.5 }
    },
    series: [
      {
        type: 'pie',
        radius: ['54%', '76%'],
        center: ['34%', '52%'],
        avoidLabelOverlap: true,
        padAngle: 2,
        itemStyle: { borderRadius: 6, borderColor: ui.isDark ? '#0d1a14' : '#ffffff', borderWidth: 2 },
        label: { show: false },
        emphasis: {
          scaleSize: 6,
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 600,
            color: '#0e7c66',
            formatter: '{b}\n{c} 台'
          }
        },
        data
      }
    ]
  }
})

const utilizationOption = computed(() => {
  const list = [...utilization.value].slice(0, 6).reverse()

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: params => {
        const item = list[params[0].dataIndex]
        return `${item.name}<br/>当前借出 ${item.borrowed}/${item.total} 台<br/>累计借用 ${item.borrowCount} 次`
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
      data: list.map(item => (item.name.length > 8 ? `${item.name.slice(0, 8)}…` : item.name)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#7e9487', fontSize: 11.5 }
    },
    series: [
      {
        type: 'bar',
        data: list.map(item => item.rate),
        barWidth: 11,
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

function openDevice(keyword) {
  router.push({ path: '/devices', query: { keyword } })
}

async function loadData() {
  loading.value = true
  try {
    const [overviewRes, trendRes, categoryRes, utilizationRes, myRes, recommendRes] =
      await Promise.all([
        getOverview(),
        getTrend(30),
        getCategoryStats(),
        getUtilization(),
        getMyBookings({ page: 1, pageSize: 5 }),
        getDeviceList({ available: 1, is_active: 1, page: 1, pageSize: 3 })
      ])

    overview.value = overviewRes.data || {}
    trend.value = trendRes.data || []
    categories.value = categoryRes.data || []
    utilization.value = utilizationRes.data || []
    myBookings.value = myRes.data?.list || []
    recommended.value = recommendRes.data?.list || []
  } catch (error) {
    console.error('看板数据加载失败', error)
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-shell">
    <!-- 欢迎区 -->
    <section class="hero fade-up">
      <span class="hero-orbit"></span>
      <span class="hero-glow"></span>

      <div class="hero-left">
        <span class="eyebrow">
          <i class="live-dot"></i>
          LAB DASHBOARD · {{ todayText }}
        </span>
        <h1>{{ greeting }}，<span class="text-gradient">{{ displayName }}</span></h1>
        <p>
          当前共有 <b>{{ overview.deviceCount || 0 }}</b> 台在册设备、<b>{{ overview.availableQty || 0 }}</b> 台可借，
          实验室运行状态良好。
        </p>
        <div class="hero-actions">
          <el-button type="primary" @click="router.push('/devices')">
            <el-icon><Box /></el-icon>
            去借设备
          </el-button>
          <el-button @click="router.push('/applyRecord')">
            <el-icon><Document /></el-icon>
            我的申请
          </el-button>
          <button class="ghost-link" type="button" @click="ui.openNotifications()">
            <el-icon><Bell /></el-icon>
            消息中心
          </button>
        </div>
      </div>

      <div class="hero-right">
        <div class="rate-ring" :style="{ '--deg': `${ringDeg}deg` }">
          <div class="ring-inner">
            <strong>{{ rate }}<small>%</small></strong>
            <span>设备利用率</span>
          </div>
        </div>

        <div class="hero-metrics">
          <div class="hero-metric">
            <span>全馆今日申请</span>
            <strong>{{ overview.todayBookings || 0 }}<small>条</small></strong>
          </div>
          <div class="hero-metric">
            <span>我的在借</span>
            <strong>{{ mine.active || 0 }}<small>台</small></strong>
          </div>
          <div class="hero-metric">
            <span>我的逾期</span>
            <strong :class="{ warn: Number(mine.overdue) > 0 }">{{ mine.overdue || 0 }}<small>条</small></strong>
          </div>
        </div>
      </div>
    </section>

    <!-- 指标卡 -->
    <section class="stat-grid stagger">
      <template v-if="loading">
        <div v-for="i in 4" :key="i" class="card card-pad">
          <AppSkeleton type="stat" />
        </div>
      </template>
      <template v-else>
        <StatCard
          label="可借设备"
          :value="overview.availableQty || 0"
          unit="台"
          tone="primary"
          :hint="`设备总量 ${overview.totalQty || 0} 台`"
          :spark="sparkApplications"
        >
          <template #icon><el-icon><Box /></el-icon></template>
        </StatCard>

        <StatCard
          label="我的在借"
          :value="mine.active || 0"
          unit="台"
          tone="cyan"
          hint="含归还审核中的设备"
          :spark="sparkApprovals"
        >
          <template #icon><el-icon><Clock /></el-icon></template>
        </StatCard>

        <StatCard
          label="待审核申请"
          :value="mine.pending || 0"
          unit="条"
          tone="amber"
          hint="等待管理员处理"
        >
          <template #icon><el-icon><Document /></el-icon></template>
        </StatCard>

        <StatCard
          label="本月申请"
          :value="mine.month || 0"
          unit="次"
          tone="violet"
          :hint="`累计申请 ${mine.total || 0} 次`"
        >
          <template #icon><el-icon><TrendCharts /></el-icon></template>
        </StatCard>
      </template>
    </section>

    <!-- 图表 -->
    <section class="grid-2 fade-up fade-up-1">
      <div class="card card-pad">
        <div class="card-head">
          <h3>借用趋势<span class="sub">近 30 天</span></h3>
          <span class="muted small">申请量与审批量</span>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="270px" />
        <BaseChart v-else :option="trendOption" height="270px" />
      </div>

      <div class="card card-pad">
        <div class="card-head">
          <h3>设备分类分布<span class="sub">按库存台数</span></h3>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="270px" />
        <BaseChart v-else :option="categoryOption" height="270px" />
      </div>
    </section>

    <section class="grid-2 fade-up fade-up-2">
      <div class="card card-pad">
        <div class="card-head">
          <h3>热门设备利用率<span class="sub">当前借出占比</span></h3>
          <span class="muted small">Top 6</span>
        </div>
        <AppSkeleton v-if="loading" type="chart" height="260px" />
        <BaseChart v-else :option="utilizationOption" height="260px" />
      </div>

      <div class="card card-pad">
        <div class="card-head">
          <h3>我的最近申请</h3>
          <router-link to="/applyRecord" class="more-link">
            全部记录
            <el-icon><ArrowRight /></el-icon>
          </router-link>
        </div>

        <div v-if="loading" class="list-skeleton">
          <AppSkeleton type="list" :rows="4" />
        </div>

        <TransitionGroup v-else-if="myBookings.length" name="list" tag="div" class="recent-list">
          <div
            v-for="item in myBookings"
            :key="item.id"
            class="recent-item"
            @click="router.push('/applyRecord')"
          >
            <span class="recent-mark"></span>
            <div class="recent-main">
              <strong>{{ item.device_name }}</strong>
              <span class="recent-meta">
                {{ formatDate(item.created_at) }} 提交 · {{ item.borrow_start }} 至 {{ item.borrow_end }}
              </span>
            </div>
            <StatusPill :status="item.status" size="sm" />
          </div>
        </TransitionGroup>

        <EmptyState
          v-else
          compact
          title="还没有借用记录"
          description="去设备大厅挑一台设备，开启你的第一次实验"
          action-text="浏览设备"
          @action="router.push('/devices')"
        />
      </div>
    </section>

    <!-- 公告 + 推荐 -->
    <section class="grid-2 fade-up fade-up-3">
      <div class="card card-pad">
        <div class="card-head">
          <h3>实验室公告<span class="sub">平台动态</span></h3>
          <button class="more-link as-button" type="button" @click="ui.openNotifications()">
            通知中心
            <el-icon><ArrowRight /></el-icon>
          </button>
        </div>

        <div class="notice-list">
          <article v-for="item in notices" :key="item.id" class="notice-item">
            <div class="notice-date">
              <b>{{ item.day }}</b>
              <span>{{ item.month }}</span>
            </div>
            <div class="notice-copy">
              <div class="notice-title">
                <span class="notice-tag">{{ item.tag }}</span>
                <strong>{{ item.title }}</strong>
              </div>
              <p>{{ item.text }}</p>
            </div>
          </article>
        </div>
      </div>

      <div class="card card-pad">
        <div class="card-head">
          <h3>为你推荐<span class="sub">当前可借</span></h3>
          <router-link to="/devices" class="more-link">
            更多设备
            <el-icon><ArrowRight /></el-icon>
          </router-link>
        </div>

        <div v-if="loading" class="list-skeleton">
          <AppSkeleton type="list" :rows="3" />
        </div>

        <div v-else-if="recommended.length" class="recommend-list">
          <button
            v-for="device in recommended"
            :key="device.id"
            type="button"
            class="recommend-item"
            @click="openDevice(device.name)"
          >
            <span class="recommend-icon">
              {{ (device.category || '设').slice(0, 1) }}
            </span>
            <span class="recommend-copy">
              <strong>{{ device.name }}</strong>
              <small>{{ device.category }} · {{ device.location || '实验室' }}</small>
            </span>
            <span class="recommend-stock">
              <b>{{ device.available_qty }}</b>/{{ device.total_qty }}
            </span>
            <el-icon class="recommend-arrow"><ArrowRight /></el-icon>
          </button>
        </div>

        <EmptyState
          v-else
          compact
          title="暂无推荐设备"
          description="所有设备都已被借出，稍后再来看看"
        />
      </div>
    </section>
  </div>
</template>

<style scoped src="./StudentDashboard.css"></style>
