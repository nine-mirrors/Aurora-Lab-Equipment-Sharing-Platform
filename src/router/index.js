import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/useUserStore'
import { useUiStore } from '@/stores/Ui'
import DefaultLayout from '../layouts/DefaultLayout.vue'
import AdminLayout from '../layouts/AdminLayout.vue'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login/Login.vue'),
    meta: { public: true, title: '登录' }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/Login/Register.vue'),
    meta: { public: true, title: '注册' }
  },
  {
    path: '/forgetPassword',
    name: 'forgetPassword',
    component: () => import('../views/Login/forgetPassword.vue'),
    meta: { public: true, title: '找回密码' }
  },
  {
    path: '/',
    component: DefaultLayout,
    redirect: '/homePage',
    children: [
      {
        path: 'homePage',
        name: 'student-home',
        component: () => import('../views/Home/StudentDashboard.vue'),
        meta: { title: '数据看板' }
      },
      {
        path: 'devices',
        name: 'device-hall',
        component: () => import('../views/Home/DeviceHall.vue'),
        meta: { title: '设备大厅' }
      },
      {
        path: 'apply',
        redirect: '/devices'
      },
      {
        path: 'applyRecord',
        name: 'apply-record',
        component: () => import('../views/User/applyRecord.vue'),
        meta: { title: '我的申请' }
      },
      {
        path: 'student/profile',
        name: 'student-profile',
        component: () => import('../views/User/studentProfile.vue'),
        meta: { title: '个人中心' }
      }
    ]
  },
  {
    path: '/admin',
    component: AdminLayout,
    redirect: '/admin/dashboard',
    meta: { role: ['admin'] },
    children: [
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('../views/Admin/AdminDashboard.vue'),
        meta: { title: '数据总览', subtitle: '设备、库存与申请的整体运行情况', role: ['admin'] }
      },
      {
        path: 'homePage',
        redirect: '/admin/dashboard'
      },
      {
        path: 'device',
        name: 'admin-device',
        component: () => import('../views/Admin/deviceManage.vue'),
        meta: { title: '设备管理', subtitle: '维护设备档案、库存与上下架状态', role: ['admin'] }
      },
      {
        path: 'apply',
        name: 'admin-apply',
        component: () => import('../views/Admin/applyManage.vue'),
        meta: { title: '申请管理', subtitle: '审核借用申请与归还确认', role: ['admin'] }
      },
      {
        path: 'maintenance',
        name: 'admin-maintenance',
        component: () => import('../views/Admin/maintenance.vue'),
        meta: { title: '维护中心', subtitle: '设备报修、维修进度与恢复可借', role: ['admin'] }
      },
      {
        path: 'getUser',
        name: 'admin-users',
        component: () => import('../views/Admin/getUser.vue'),
        meta: { title: '用户管理', subtitle: '查看平台账号并处理异常账号', role: ['admin'] }
      },
      {
        path: 'baseData',
        name: 'admin-base-data',
        component: () => import('../views/Admin/baseData.vue'),
        meta: { title: '基础数据', subtitle: '平台公告、院系与实验室场地', role: ['admin'] }
      },
      {
        path: 'systemData',
        name: 'admin-system-data',
        component: () => import('../views/Admin/systemData.vue'),
        meta: { title: '系统数据', subtitle: '数据表规模与管理员操作审计', role: ['admin'] }
      },
      {
        path: 'adminProfile',
        name: 'admin-profile',
        component: () => import('../views/User/studentProfile.vue'),
        meta: { title: '个人中心', subtitle: '维护个人资料与账号安全', role: ['admin'] }
      }
    ]
  },
  {
    path: '/design',
    name: 'design-system',
    component: () => import('../views/Design/DesignSystem.vue'),
    meta: { public: true, standalone: true, title: '设计系统' }
  },
  {
    path: '/403',
    name: 'forbidden',
    component: () => import('../views/Error/Forbidden.vue'),
    meta: { public: true, standalone: true, title: '无访问权限' }
  },
  {
    path: '/500',
    name: 'server-error',
    component: () => import('../views/Error/ServerError.vue'),
    meta: { public: true, standalone: true, title: '服务异常' }
  },
  {
    path: '/404',
    name: 'not-found',
    component: () => import('../views/Error/NotFound.vue'),
    meta: { public: true, standalone: true, title: '页面不存在' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'catch-all',
    component: () => import('../views/Error/NotFound.vue'),
    meta: { public: true, standalone: true, title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth', top: 90 }
    return { top: 0 }
  }
})

router.beforeEach(to => {
  const ui = useUiStore()
  ui.routeLoading = true

  const userStore = useUserStore()
  const token = userStore.token
  const role = userStore.role || 'student'

  // 错误页等独立页面不做登录重定向
  if (to.meta?.standalone) return true

  if (!token) {
    return to.meta.public ? true : { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.public) {
    return role === 'admin' ? '/admin/dashboard' : '/homePage'
  }

  if (to.meta?.role && !to.meta.role.includes(role)) {
    return '/403'
  }

  if (to.path === '/') {
    return role === 'admin' ? '/admin/dashboard' : '/homePage'
  }

  return true
})

router.afterEach(to => {
  const ui = useUiStore()
  ui.routeLoading = false

  const base = '极光 · 实验室设备共享平台'
  const map = {
    '/login': '登录',
    '/register': '注册',
    '/forgetPassword': '找回密码'
  }
  const title = to.meta?.title || map[to.path]
  document.title = title ? `${title} · ${base}` : base
})

router.onError(() => {
  const ui = useUiStore()
  ui.routeLoading = false
})

export default router
