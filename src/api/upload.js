import request from '@/utils/request'

export const uploadImage = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)

  return request({
    url: '/api/uploads',
    method: 'post',
    data: form,
    timeout: 60000,
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: event => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
  })
}
