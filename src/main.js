import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import router from './router'
import '@/style/tokens.css'
import '@/style/main.css'
import {
  Aim, ArrowDown, ArrowLeft, ArrowRight, Bell, Box, Brush, Camera, Check, CircleCheck,
  Clock, Close, CopyDocument, Cpu, DataBoard, DataLine, Document, Download, Expand, Fold,
  Grid, InfoFilled, Key, List, Location, MagicStick, Menu, Moon, Plus, Promotion, Refresh,
  RefreshLeft, RefreshRight, Search, Setting, Star, StarFilled, Sunny, SwitchButton,
  Tickets, Tools, TrendCharts, User, Warning, WarningFilled
} from '@element-plus/icons-vue'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { setupDirectives } from '@/directives/setup'
import { useUiStore } from '@/stores/Ui'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

const icons = {
  Aim, ArrowDown, ArrowLeft, ArrowRight, Bell, Box, Brush, Camera, Check, CircleCheck,
  Clock, Close, CopyDocument, Cpu, DataBoard, DataLine, Document, Download, Expand, Fold,
  Grid, InfoFilled, Key, List, Location, MagicStick, Menu, Moon, Plus, Promotion, Refresh,
  RefreshLeft, RefreshRight, Search, Setting, Star, StarFilled, Sunny, SwitchButton,
  Tickets, Tools, TrendCharts, User, Warning, WarningFilled
}

for (const [key, component] of Object.entries(icons)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
setupDirectives(app)

// 在挂载前应用持久化的主题，避免闪烁
useUiStore(pinia).applyTheme()

app.mount('#app')
