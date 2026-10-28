# 组件登记表

> 规范来源：`前端开发规范与最佳实践（优化版）` 2.2 复用组件的前置沟通。
> 新增或修改通用组件时，必须同步更新本文件。

## 一、通用组件（src/components/common）

| 组件 | 路径 | 用途 | 主要 Props | 事件 |
| --- | --- | --- | --- | --- |
| AppLoading | `src/components/common/AppLoading.vue` | 全屏 / 覆盖层 / 行内加载态 | `variant`(splash/overlay/inline)、`label`、`hint`、`progress`、`size`(sm/md/lg) | - |
| AppSkeleton | `src/components/common/AppSkeleton.vue` | 首屏骨架屏 | `type`(card/stat/list/table/chart/text)、`rows`、`height` | - |
| BeakerLoader | `src/components/common/BeakerLoader.vue` | 品牌化烧杯加载动画 | `progress`、`size`、`shake` | - |
| BrandMark | `src/components/common/BrandMark.vue` | 品牌标识 | `size`、`glow`、`mono` | - |
| CursorLab | `src/components/common/CursorLab.vue` | 自定义光标实验效果 | - | - |
| EmptyState | `src/components/common/EmptyState.vue` | 空状态占位 | `title`、`description`、`actionText`、`compact` | `action` |
| ErrorPage | `src/components/common/ErrorPage.vue` | 403/404/500 错误页 | `code`、`title`、`description`、`accent` | - |
| PageHeader | `src/components/common/PageHeader.vue` | 页面标题区 | `title`、`description`、`eyebrow` | 插槽 `actions` |
| ParticleField | `src/components/common/ParticleField.vue` | 背景粒子 | `density`、`interactive`、`speed` | - |
| StatCard | `src/components/common/StatCard.vue` | 指标卡片 | `label`、`value`、`unit`、`hint`、`tone`、`precision`、`trend`、`spark` | - |
| StatusPill | `src/components/common/StatusPill.vue` | 业务状态徽标 | `status`、`label`、`size`(sm/md) | - |
| ThemeToggle | `src/components/common/ThemeToggle.vue` | 明暗主题切换 | - | - |

### 使用示例

```vue
<PageHeader eyebrow="MY APPLICATIONS" title="我的申请" description="查看借用进度">
  <template #actions>
    <el-button type="primary" @click="router.push('/devices')">去借新设备</el-button>
  </template>
</PageHeader>

<StatusPill status="approved" size="sm" />

<EmptyState
  title="还没有借用记录"
  description="去设备大厅挑选一台设备"
  action-text="去设备大厅"
  @action="router.push('/devices')"
/>
```

## 二、图表与布局组件

| 组件 | 路径 | 用途 | 主要 Props |
| --- | --- | --- | --- |
| BaseChart | `src/components/charts/BaseChart.vue` | ECharts 统一封装（自适应、主题联动） | `option`、`height` |
| AdminSidebar | `src/components/layout/AdminSidebar.vue` | 管理端侧边导航 | `mobileOpen` |
| AppHeader | `src/components/layout/AppHeader.vue` | 顶栏、搜索、通知入口 | - |
| CommandPalette | `src/components/layout/CommandPalette.vue` | 全局命令面板 | - |
| NotificationDrawer | `src/components/layout/NotificationDrawer.vue` | 通知抽屉 | - |
| RouteProgress | `src/components/layout/RouteProgress.vue` | 路由切换进度条 | - |
| AiCopilot | `src/components/ai/AiCopilot.vue` | AI 助手侧栏 | - |

## 三、页面级组件（按业务域拆分）

> 单文件超过 600 行时按“弹窗 → 查询表单 → 复杂表格 → 重复片段”的顺序拆分；拆分后的组件与页面同目录的 `components/` 下。

### 设备大厅 `src/views/Home/components`

| 组件 | 用途 | 主要 Props | 事件 |
| --- | --- | --- | --- |
| DeviceCard | 设备卡片（网格 / 列表两种形态） | `device`、`favorite`、`activeStatus`、`blacklisted`、`accent`、`index`、`listMode` | `open`、`toggle-favorite`、`apply` |
| DeviceDetailDrawer | 设备详情、可用日历、用户评价 | `modelValue`、`device`、`favorite`、`blacklisted`、`activeStatus`、`accent` | `update:modelValue`、`toggle-favorite`、`report`、`apply`、`apply-day` |
| DeviceApplyDialog | 借用申请（含 AI 生成用途、协议确认） | `modelValue`、`device`、`startDate` | `update:modelValue`、`success` |
| DeviceReportDialog | 设备报修 | `modelValue`、`device` | `update:modelValue`、`success` |

### 管理端 `src/views/Admin/components`

| 组件 | 用途 | 主要 Props | 事件 |
| --- | --- | --- | --- |
| DeviceFormDialog | 设备上架 / 编辑（含图片上传） | `modelValue`、`device`、`categories` | `update:modelValue`、`saved` |
| ApplyStatsGrid | 申请状态统计卡片 | `lists`、`activeTab` | `select` |
| ApplyReviewDrawer | 申请详情与 AI 审批建议 | `modelValue`、`row`、`status`、`reviewLoading`、`reviewResult`、`reviewBookingId` | `update:modelValue`、`approve`、`reject`、`approve-extension`、`reject-extension`、`confirm-return`、`return-reject`、`generate-review` |
| RejectBookingDialog | 拒绝借用申请 | `modelValue`、`row` | `update:modelValue`、`rejected` |
| RejectReturnDialog | 拒绝归还申请 | `modelValue`、`row` | `update:modelValue`、`rejected` |
| AnnouncementManager | 平台公告增删改与启停 | 无 | 无 |
| DepartmentManager | 院系增删改 | 无 | 无 |
| LabManager | 实验室场地增删改（含院系选择） | 无 | 无 |
| SettingsManager | 系统设置读取与逐项保存 | 无 | 无 |

### 学生端 `src/views/User/components`

| 组件 | 用途 | 主要 Props | 事件 |
| --- | --- | --- | --- |
| ApplyDetailDrawer | 借用详情、取件码 / 归还码、流程时间线 | `modelValue`、`record`、`returning`、`pickupLoadingId` | `update:modelValue`、`cancel`、`pickup`、`extend`、`return`、`review` |
| BookingExtendDialog | 续借申请 | `modelValue`、`record` | `update:modelValue`、`success` |
| BookingReviewDialog | 设备评价 | `modelValue`、`record` | `update:modelValue`、`success` |

## 四、维护约定

1. 组件文件名使用 PascalCase，页面私有组件放在页面目录的 `components/` 下。
2. 组件只通过 Props / Emits 与父级通信，不在子组件内直接修改父级状态。
3. 弹窗通过 `modelValue` + `update:modelValue` 支持 `v-model`。
4. 样式必须写在组件内并添加 `scoped`；样式较长时可拆到同目录同名 `.css`，通过 `<style scoped src="./X.css">` 引入。
5. 单文件行数控制在 600 行以内（不含注释与空行可放宽至 650 行）。
