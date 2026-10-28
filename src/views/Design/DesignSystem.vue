<!-- VERDANT LAB · 项目专属组件与设计规范 -->
<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/stores/useUserStore'
import BrandMark from '@/components/common/BrandMark.vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import ParticleField from '@/components/common/ParticleField.vue'
import StatusPill from '@/components/common/StatusPill.vue'
import BeakerLoader from '@/components/common/BeakerLoader.vue'
import AppLoading from '@/components/common/AppLoading.vue'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StatCard from '@/components/common/StatCard.vue'

const userStore = useUserStore()
const homePath = computed(() =>
  (userStore.role || 'student') === 'admin' ? '/admin/dashboard' : '/homePage'
)

const colors = [
  { name: '森野绿', token: '--primary', hex: '#0E7C66', note: '主色 / 操作与品牌' },
  { name: '青柠', token: '--lime', hex: '#9FBF3A', note: '强调 / 生长与活性' },
  { name: '陶土', token: '--copper', hex: '#B86A45', note: 'AI / 温暖提示' },
  { name: '琥珀', token: '--amber', hex: '#C98A26', note: '警告 / 待处理' },
  { name: '深夜森林', token: '--bg-inverse', hex: '#06110D', note: '深色界面 / 侧栏' },
  { name: '象牙纸', token: '--bg-canvas', hex: '#F3F6EF', note: '浅色画布' }
]

const cursorStates = [
  { key: 'default', label: '默认', desc: '小圆点 + 追随描边环' },
  { key: 'hover', label: '悬停', desc: '可点击元素放大并填充' },
  { key: 'text', label: '文本', desc: '输入框内变为 I 型光标' },
  { key: 'loading', label: '加载', desc: '路由或 AI 请求时旋转' },
  { key: 'left', label: '左键', desc: '按下收缩并显示“左键”' },
  { key: 'right', label: '右键', desc: '陶土色提示“右键”' },
  { key: 'middle', label: '中键', desc: '青柠色十字提示“中键”' }
]

const statuses = ['pending', 'approved', 'returning', 'returned', 'rejected', 'cancelled', 'overdue']
const spark = [2, 4, 3, 5, 4, 6, 5, 7, 6, 8]
</script>

<template>
  <div class="ds-page">
    <div class="ds-bg" aria-hidden="true">
      <span class="ds-glow a"></span>
      <span class="ds-glow b"></span>
      <ParticleField :density="34" />
    </div>

    <header class="ds-top">
      <router-link :to="homePath" class="ds-brand">
        <BrandMark :size="32" />
        <div>
          <strong>VERDANT LAB</strong>
          <span>Design System v3</span>
        </div>
      </router-link>

      <div class="ds-actions">
        <ThemeToggle />
        <router-link :to="homePath" class="ds-back">返回工作台</router-link>
      </div>
    </header>

    <main class="ds-main">
      <section class="ds-hero">
        <span class="ds-eyebrow">PROJECT-EXCLUSIVE UI KIT</span>
        <h1>森野实验室 · 组件与规范</h1>
        <p>
          从高校实验室的真实氛围出发，用森野绿、青柠与陶土暖色建立专属识别；
          配合烧杯加载、粒子光效与项目内自定义光标，形成一套只属于极光平台的界面语言。
        </p>
        <div class="ds-chips">
          <span>森野绿主色</span>
          <span>烧杯加载</span>
          <span>粒子光效</span>
          <span>自定义光标</span>
          <span>抽屉式交互</span>
        </div>
      </section>

      <section class="ds-section">
        <div class="ds-head">
          <h2>色彩系统</h2>
          <span>Palette</span>
        </div>

        <div class="swatch-grid">
          <article v-for="color in colors" :key="color.token" class="swatch">
            <span class="swatch-block" :style="{ background: color.hex }"></span>
            <div class="swatch-copy">
              <strong>{{ color.name }}</strong>
              <code>{{ color.hex }}</code>
              <small>{{ color.note }}</small>
            </div>
          </article>
        </div>
      </section>

      <div class="ds-grid">
        <section class="ds-section">
          <div class="ds-head">
            <h2>按钮</h2>
            <span>Buttons</span>
          </div>
          <div class="ds-row">
            <el-button type="primary">申请借用</el-button>
            <el-button type="primary" plain>次要操作</el-button>
            <el-button>普通按钮</el-button>
            <el-button type="success" plain>通过审核</el-button>
            <el-button type="danger" plain>拒绝</el-button>
          </div>
          <div class="ds-row">
            <el-button type="primary" round>圆角按钮</el-button>
            <el-button type="primary" disabled>禁用状态</el-button>
            <button class="ai-pill">
              <span class="spark">✦</span>
              AI 帮我挑
            </button>
          </div>
        </section>

        <section class="ds-section">
          <div class="ds-head">
            <h2>状态胶囊</h2>
            <span>Status</span>
          </div>
          <div class="ds-row">
            <StatusPill v-for="status in statuses" :key="status" :status="status" />
          </div>
          <div class="ds-row">
            <span class="custom-pill blacklist"><i></i>已拉黑</span>
            <span class="custom-pill normal"><i></i>账号正常</span>
            <span class="custom-pill ai"><i></i>AI 推荐</span>
          </div>
        </section>
      </div>

      <section class="ds-section">
        <div class="ds-head">
          <h2>项目专属光标</h2>
          <span>Cursor States · 仅在项目内生效</span>
        </div>

        <div class="cursor-grid">
          <article v-for="state in cursorStates" :key="state.key" class="cursor-card">
            <div class="cursor-stage" :class="`state-${state.key}`">
              <span class="mini-ring"></span>
              <span class="mini-dot"></span>
            </div>
            <strong>{{ state.label }}</strong>
            <p>{{ state.desc }}</p>
          </article>
        </div>

        <p class="ds-note">
          光标会随元素状态自动切换：悬停可点击元素、进入输入框、路由/AI 加载中、以及鼠标左/中/右键按下时都有不同反馈；可在「个人中心 → 偏好设置」中关闭。
        </p>
      </section>

      <div class="ds-grid">
        <section class="ds-section">
          <div class="ds-head">
            <h2>烧杯加载</h2>
            <span>Beaker Loader</span>
          </div>
          <div class="beaker-stage">
            <BeakerLoader :progress="78" :size="104" />
          </div>
          <p class="ds-note">溶液随进度注满，气泡上升，完成时烧杯轻摇；标签与百分比来自同一个加载组件。</p>
        </section>

        <section class="ds-section">
          <div class="ds-head">
            <h2>加载与骨架</h2>
            <span>Loading</span>
          </div>
          <div class="ds-row">
            <AppLoading variant="inline" label="正在加载设备…" size="sm" />
          </div>
          <div class="skeleton-box">
            <AppSkeleton type="list" :rows="2" />
          </div>
        </section>
      </div>

      <div class="ds-grid">
        <section class="ds-section">
          <div class="ds-head">
            <h2>数据卡片</h2>
            <span>Stat Card</span>
          </div>
          <div class="stat-demo">
            <StatCard
              label="可借设备"
              :value="200"
              unit="台"
              hint="设备总量 228 台"
              tone="primary"
              :spark="spark"
            />
            <StatCard
              label="待审核"
              :value="11"
              unit="条"
              hint="需要尽快处理"
              tone="amber"
            />
          </div>
        </section>

        <section class="ds-section">
          <div class="ds-head">
            <h2>空状态</h2>
            <span>Empty State</span>
          </div>
          <div class="empty-box">
            <EmptyState
              compact
              title="还没有收藏设备"
              description="在设备大厅点击星标，常用设备会出现在这里"
            />
          </div>
        </section>
      </div>

      <section class="ds-section">
        <div class="ds-head">
          <h2>交互原则</h2>
          <span>Motion & Interaction</span>
        </div>
        <div class="principle-grid">
          <article>
            <strong>01 · 可感知</strong>
            <p>页面跳转、主题切换、加载与审核动作都有明确反馈，而不是静默完成。</p>
          </article>
          <article>
            <strong>02 · 有节制</strong>
            <p>粒子、倾斜与光标光晕保持低对比，优先保证信息可读与操作准确。</p>
          </article>
          <article>
            <strong>03 · 可关闭</strong>
            <p>自定义光标与主题都可在偏好设置中关闭，尊重用户的设备与动效偏好。</p>
          </article>
        </div>
      </section>
    </main>

    <footer class="ds-footer">
      <span>VERDANT LAB · AURORA LAB PLATFORM</span>
      <span>Design tokens · Components · Cursor</span>
    </footer>
  </div>
</template>

<style scoped src="./DesignSystem.css"></style>
