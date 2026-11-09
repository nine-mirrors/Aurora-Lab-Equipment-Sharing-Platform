import { computed, ref, watch } from 'vue'

/**
 * 前端本地分页：只管理页码、每页条数与切片结果，不混入请求逻辑。
 * source 为已筛选好的列表 computed/ref。
 */
export function usePagination(source, defaultSize = 10) {
  const page = ref(1)
  const pageSize = ref(defaultSize)

  const total = computed(() => source.value.length)

  // 列表缩短（删除/筛选）后自动回落到最后一页，避免出现“假空态”
  watch(total, value => {
    const lastPage = Math.max(1, Math.ceil(value / pageSize.value))
    if (page.value > lastPage) page.value = lastPage
  })

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })

  function reset() {
    page.value = 1
  }

  return { page, pageSize, total, paged, reset }
}
