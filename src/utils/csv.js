/**
 * 将二维数组导出为 CSV 并触发浏览器下载。
 * @param {string} filename 下载文件名
 * @param {Array<string>} header 表头
 * @param {Array<Array<unknown>>} rows 数据行
 */
export function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
