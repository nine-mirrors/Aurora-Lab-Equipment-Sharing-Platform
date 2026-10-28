# Composable 使用指南

> 规范来源：`前端开发规范与最佳实践（优化版）` 五、Composable 复用。
> 命名统一以 `use` 开头，文件名使用 camelCase，每个 Composable 只负责一类逻辑。

## 一、清单

| Composable | 路径 | 职责 | 返回值 |
| --- | --- | --- | --- |
| useDebounce | `src/composables/useDebounce.js` | 输入类搜索 300ms 防抖，组件卸载时自动清理定时器 | `run(...args)`，附带 `run.cancel()` |
| usePagination | `src/composables/usePagination.js` | 前端数组分页（页码、每页条数、当前页数据） | `page`、`pageSize`、`total`、`paged`、`reset` |

## 二、useDebounce

### 适用场景

- 搜索框输入触发接口请求（设备大厅、设备管理）
- 任何高频输入导致重复计算的场景

### 用法

```js
import { useDebounce } from '@/composables/useDebounce'

function handleSearch() {
  page.value = 1
  loadDevices()
}

const debouncedSearch = useDebounce(handleSearch, 300)
```

```vue
<el-input v-model="keyword" @input="debouncedSearch" @keyup.enter="handleSearch" />
```

### 约定

- 默认延迟 300ms，符合规范要求；确需调整时显式传参。
- 只在输入事件上使用防抖；回车、清空、按钮点击仍应即时触发。
- 防抖函数内部不要再做防抖，避免双重延迟。

## 三、usePagination

### 适用场景

- 数据已一次性加载到前端，仅需本地分页
- 搜索 / 筛选后的结果分页

### 用法

```js
import { usePagination } from '@/composables/usePagination'

const filtered = computed(() => users.value.filter(...))
const { page, pageSize, paged, reset } = usePagination(filtered, 10)

function handleSearch() {
  reset()
}
```

```vue
<el-table :data="paged" />
<el-pagination
  v-if="filtered.length > pageSize"
  v-model:current-page="page"
  :page-size="pageSize"
  :total="filtered.length"
/>
```

### 约定

- `source` 必须是 `computed` 的数组；筛选条件变化后调用 `reset()` 回到第一页。
- 服务端分页（设备大厅、申请管理等）继续使用接口的 `page` / `pageSize` 参数，不套用本 Composable。

## 四、新增 Composable 的流程

1. 确认逻辑被至少两个页面使用，或单个页面逻辑超过 100 行。
2. 在 `src/composables/` 下新建 `useXxx.js`，使用 JSDoc 说明职责与返回值。
3. 只暴露必要的状态与方法，不返回组件实例或 DOM。
4. 在本文件“清单”中登记。
5. 运行 `npm run lint && npm run test:component`，确认无警告、无回归。
