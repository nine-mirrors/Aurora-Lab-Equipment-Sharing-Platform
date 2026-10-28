import { computed, ref } from 'vue'

/**
 * 前端本地分页：只管理页码、每页条数与切片结果，不混入请求逻辑。
 * source 为已筛选好的列表 computed/ref。
 */
export function usePagination(source, defaultSize = 10) {
  const page = ref(1)
  const pageSize = ref(defaultSize)

  const total = computed(() => source.value.length)
  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })

  function reset() {
    page.value = 1
  }

  return { page, pageSize, total, paged, reset }
}
