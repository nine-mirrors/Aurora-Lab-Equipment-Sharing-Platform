import { onBeforeUnmount } from 'vue'

/**
 * 简单防抖：输入类搜索统一延迟 300ms，避免每次按键都触发请求。
 * 返回的函数支持 cancel，组件卸载时自动取消未执行的调用。
 */
export function useDebounce(fn, delay = 300) {
  let timer = null

  const run = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delay)
  }

  run.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  onBeforeUnmount(run.cancel)
  return run
}
