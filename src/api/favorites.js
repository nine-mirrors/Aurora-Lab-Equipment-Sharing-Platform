import request from '@/utils/request'

export const getFavorites = () => request({ url: '/api/favorites', method: 'get' })

export const addFavorite = deviceId =>
  request({ url: `/api/favorites/${deviceId}`, method: 'post' })

export const removeFavorite = deviceId =>
  request({ url: `/api/favorites/${deviceId}`, method: 'delete' })
