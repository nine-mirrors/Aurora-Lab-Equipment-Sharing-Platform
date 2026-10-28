/**
 * 将本地图片压缩为方形头像的 Data URL，避免把大图写入本地 JSON。
 */
export function compressImage(file, { size = 160, quality = 0.86 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type).startsWith('image/')) {
      reject(new Error('请选择图片文件'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('图片不能超过 5MB'))
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const image = new Image()

      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size

        const context = canvas.getContext('2d')
        const side = Math.min(image.width, image.height)
        const offsetX = (image.width - side) / 2
        const offsetY = (image.height - side) / 2

        context.drawImage(image, offsetX, offsetY, side, side, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }

      image.onerror = () => reject(new Error('图片解析失败，请换一张试试'))
      image.src = reader.result
    }

    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}
