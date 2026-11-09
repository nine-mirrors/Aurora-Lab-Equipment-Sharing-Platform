import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    Components({
      dts: false,
      resolvers: [ElementPlusResolver()]
    }),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 本地自研后端（端口被占用时可用 LAB_API_TARGET 覆盖）
      '/api': {
        target: process.env.LAB_API_TARGET || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    // ECharts 为按路由懒加载的独立图表包，gzip 后约 190KB，单独放宽该提示
    chunkSizeWarningLimit: 600
  }
})
