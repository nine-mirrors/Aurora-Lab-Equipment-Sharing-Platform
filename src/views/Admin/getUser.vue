<!-- 管理端用户管理 -->
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { blacklistUser, deleteUserByAdmin, getUserList, getUserStats } from '@/api/Admin/admin'
import AppSkeleton from '@/components/common/AppSkeleton.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useDebounce } from '@/composables/useDebounce'
import { formatDate } from '@/utils/date'

const loading = ref(true)
const loadError = ref(false)
const users = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const keyword = ref('')
const deletingId = ref(null)
const blacklistingId = ref(null)
const roleFilter = ref('all')
let requestSeq = 0

const tabs = [
  { key: 'all', label: '全部用户' },
  { key: 'student', label: '学生' },
  { key: 'admin', label: '管理员' },
  { key: 'blacklist', label: '黑名单' }
]

const stats = reactive({ total: 0, students: 0, admins: 0, blacklisted: 0, health: 0 })

const paged = computed(() => users.value)

function roleText(role) {
  return role === 'admin' ? '管理员' : '学生'
}

function switchRole(key) {
  if (key === roleFilter.value) return
  roleFilter.value = key
  page.value = 1
  loadUsers()
}

async function loadStats() {
  try {
    const res = await getUserStats()
    if (res.code !== 200) return
    Object.assign(stats, res.data || {})
  } catch {
    // 统计失败不阻塞列表
  }
}

async function loadUsers() {
  const seq = ++requestSeq
  loading.value = true
  loadError.value = false
  try {
    const params = {
      page: page.value,
      pageSize,
      keyword: keyword.value.trim() || undefined
    }
    if (roleFilter.value === 'student' || roleFilter.value === 'admin') params.role = roleFilter.value
    if (roleFilter.value === 'blacklist') params.blacklisted = '1'

    const res = await getUserList(params)
    if (seq !== requestSeq) return
    if (res.code !== 200) throw new Error(res.message || '加载失败')

    const list = res.data?.list || []
    const totalCount = Number(res.data?.total || 0)
    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize))

    if (!list.length && totalCount > 0 && page.value > lastPage) {
      page.value = lastPage
      return loadUsers()
    }

    users.value = list
    total.value = totalCount
  } catch {
    if (seq !== requestSeq) return
    loadError.value = true
    users.value = []
    total.value = 0
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadUsers(), loadStats()])
}

const debouncedSearch = useDebounce(() => {
  page.value = 1
  loadUsers()
}, 300)

function handleSearchNow() {
  debouncedSearch.cancel()
  page.value = 1
  loadUsers()
}

function handlePageChange(value) {
  page.value = value
  loadUsers()
  document.querySelector('.user-stats')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定注销「${row.name}（${row.account}）」吗？该用户的借用记录也会一并删除，操作不可恢复。`,
      '注销账号',
      { confirmButtonText: '确认注销', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  deletingId.value = row.id
  try {
    const res = await deleteUserByAdmin(row.id)
    if (res.code !== 200) {
      ElMessage.error(res.message || '注销失败')
      return
    }
    ElMessage.success('账号已注销')
    await refreshAll()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '注销失败')
  } finally {
    deletingId.value = null
  }
}

async function handleBlacklist(row) {
  if (row.role === 'admin') return

  let reason = ''
  if (row.blacklisted) {
    try {
      await ElMessageBox.confirm(
        `确定将「${row.name || row.account}」移出黑名单？解除后可正常提交借用申请。`,
        '解除黑名单',
        { confirmButtonText: '解除限制', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
  } else {
    try {
      const result = await ElMessageBox.prompt(
        `加入黑名单后，该用户将无法提交新的借用申请或续借。请填写原因：`,
        '加入黑名单',
        {
          confirmButtonText: '确认拉黑',
          cancelButtonText: '取消',
          inputPlaceholder: '例如：多次逾期未归还 / 损坏设备未处理',
          inputValidator: value => Boolean(String(value || '').trim()) || '请填写拉黑原因'
        }
      )
      reason = result.value
    } catch {
      return
    }
  }

  blacklistingId.value = row.id
  try {
    const res = await blacklistUser(row.id, {
      action: row.blacklisted ? 'remove' : 'add',
      reason
    })
    if (res.code !== 200) {
      ElMessage.error(res.message || '操作失败')
      return
    }
    ElMessage.success(row.blacklisted ? '已解除黑名单' : '已加入黑名单')
    await refreshAll()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || '操作失败')
  } finally {
    blacklistingId.value = null
  }
}

onMounted(() => {
  loadStats()
  loadUsers()
})
</script>

<template>
  <div class="page-shell">
    <section class="user-stats stagger">
      <div class="u-stat card">
        <span>平台账号</span>
        <strong>{{ stats.total }}</strong>
        <small>全部注册用户</small>
      </div>
      <div class="u-stat card tone-primary">
        <span>学生账号</span>
        <strong>{{ stats.students }}</strong>
        <small>可预约实验室设备</small>
      </div>
      <div class="u-stat card tone-amber">
        <span>管理员</span>
        <strong>{{ stats.admins }}</strong>
        <small>拥有审批与管理权限</small>
      </div>
      <div class="u-stat card tone-green">
        <span>邮箱绑定率</span>
        <strong>{{ stats.health }}<em>%</em></strong>
        <small>已绑定邮箱的账号占比</small>
      </div>
      <div class="u-stat card tone-red">
        <span>黑名单</span>
        <strong>{{ stats.blacklisted }}</strong>
        <small>限制借用与续借</small>
      </div>
    </section>

    <div class="card card-pad">
      <div class="toolbar">
        <div class="tabs" role="tablist" aria-label="用户角色">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="tab-chip"
            role="tab"
            :aria-selected="roleFilter === tab.key"
            :class="{ active: roleFilter === tab.key }"
            @click="switchRole(tab.key)"
          >
            {{ tab.label }}
            <span class="tab-count">
              {{
                tab.key === 'all'
                  ? stats.total
                  : tab.key === 'admin'
                    ? stats.admins
                    : tab.key === 'blacklist'
                      ? stats.blacklisted
                      : stats.students
              }}
            </span>
          </button>
        </div>

        <el-input
          v-model="keyword"
          class="search-input"
          placeholder="搜索账号 / 姓名 / 邮箱"
          clearable
          :prefix-icon="Search"
          aria-label="搜索用户"
          @input="debouncedSearch"
          @keyup.enter="handleSearchNow"
          @clear="handleSearchNow"
        />
      </div>

      <AppSkeleton v-if="loading" type="table" :rows="7" />

      <EmptyState
        v-else-if="loadError"
        tone="error"
        title="用户列表加载失败"
        description="网络或服务暂不可用，请检查后重试"
        action-text="重新加载"
        @action="refreshAll"
      />

      <template v-else-if="paged.length">
        <el-table :data="paged">
          <el-table-column label="用户" min-width="190">
            <template #default="{ row }">
              <div class="user-cell">
                <el-avatar :size="34" class="user-avatar" :src="row.avatar || undefined">
                  {{ (row.name || row.account || '?').slice(0, 1) }}
                </el-avatar>
                <div>
                  <strong>{{ row.name || '未设置姓名' }}</strong>
                  <span>{{ row.account }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="角色" width="110">
            <template #default="{ row }">
              <span class="role-tag" :class="row.role">
                {{ roleText(row.role) }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="邮箱" min-width="190">
            <template #default="{ row }">
              <span class="muted">{{ row.email || '未绑定' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="手机号" width="140">
            <template #default="{ row }">
              <span class="muted">{{ row.phone || '未填写' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="账号状态" min-width="150">
            <template #default="{ row }">
              <div class="status-cell">
                <span v-if="row.blacklisted" class="blacklist-tag" :title="row.blacklist_reason">
                  <i></i>已拉黑
                </span>
                <span v-else class="normal-tag">正常</span>
                <small v-if="row.blacklisted && row.blacklist_reason">{{ row.blacklist_reason }}</small>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="注册时间" width="130">
            <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
          </el-table-column>

          <el-table-column label="操作" width="190" align="right">
            <template #default="{ row }">
              <div v-if="row.role !== 'admin'" class="row-actions">
                <el-button
                  :type="row.blacklisted ? 'success' : 'warning'"
                  size="small"
                  plain
                  :loading="blacklistingId === row.id"
                  @click="handleBlacklist(row)"
                >
                  {{ row.blacklisted ? '解除' : '拉黑' }}
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  plain
                  :loading="deletingId === row.id"
                  @click="handleDelete(row)"
                >
                  注销
                </el-button>
              </div>
              <span v-else class="muted">-</span>
            </template>
          </el-table-column>
        </el-table>

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
      </template>

      <EmptyState
        v-else
        :title="keyword.trim() ? '没有找到用户' : '该分类下暂无用户'"
        :description="keyword.trim() ? '换个关键词或角色筛选条件试试' : '切换上方角色标签查看其他用户'"
      />
    </div>
  </div>
</template>

<style scoped>
.user-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.u-stat {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 15px 18px;
  overflow: hidden;
  --tone: var(--primary);
}

.u-stat::after {
  content: "";
  position: absolute;
  right: -20px;
  top: -24px;
  width: 84px;
  height: 84px;
  border-radius: 999px;
  background: radial-gradient(circle, color-mix(in srgb, var(--tone) 16%, transparent), transparent 70%);
}

.u-stat span {
  font-size: 11.5px;
  color: var(--text-3);
}

.u-stat strong {
  font-size: 25px;
  letter-spacing: -0.03em;
  color: var(--text-1);
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.u-stat strong em {
  font-style: normal;
  font-size: 13px;
  color: var(--text-3);
  margin-left: 1px;
}

.u-stat small {
  font-size: 10.5px;
  color: var(--text-3);
}

.tone-primary { --tone: var(--primary); }
.tone-amber { --tone: var(--amber); }
.tone-green { --tone: var(--green); }
.tone-red { --tone: var(--red); }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.search-input {
  width: 260px;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  background: var(--gradient-aurora);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex: none;
}

.user-cell div {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}

.user-cell strong {
  font-size: 13px;
  color: var(--text-1);
}

.user-cell span {
  font-size: 10.5px;
  color: var(--text-3);
}

.role-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid color-mix(in srgb, var(--primary) 16%, transparent);
}

.role-tag.admin {
  color: var(--amber);
  background: var(--amber-soft);
  border-color: color-mix(in srgb, var(--amber) 20%, transparent);
}

.status-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.blacklist-tag,
.normal-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 10.5px;
}

.blacklist-tag {
  color: var(--red);
  background: var(--red-soft);
  border: 1px solid color-mix(in srgb, var(--red) 20%, transparent);
}

.blacklist-tag i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--red);
  box-shadow: 0 0 6px color-mix(in srgb, var(--red) 60%, transparent);
}

.normal-tag {
  color: var(--green);
  background: var(--green-soft);
  border: 1px solid color-mix(in srgb, var(--green) 18%, transparent);
}

.status-cell small {
  max-width: 160px;
  font-size: 9.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-wrap: wrap;
}

.row-actions :deep(.el-button) {
  margin-left: 0;
}

@media (max-width: 1100px) {
  .user-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .search-input {
    width: 100%;
  }

  .user-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
