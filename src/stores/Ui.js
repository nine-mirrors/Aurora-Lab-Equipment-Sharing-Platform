import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'light',
    sidebarCollapsed: false,
    paletteOpen: false,
    notificationsOpen: false,
    routeLoading: false,
    booting: true,
    cursorEnabled: true
  }),

  getters: {
    isDark: state => state.theme === 'dark'
  },

  actions: {
    applyTheme() {
      document.documentElement.classList.toggle('dark', this.theme === 'dark')
      document.documentElement.style.colorScheme = this.theme
    },

    setTheme(theme) {
      this.theme = theme === 'dark' ? 'dark' : 'light'
      this.applyTheme()
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },

    openPalette() {
      this.paletteOpen = true
    },

    closePalette() {
      this.paletteOpen = false
    },

    openNotifications() {
      this.notificationsOpen = true
    },

    closeNotifications() {
      this.notificationsOpen = false
    },

    finishBoot() {
      this.booting = false
    },

    setCursorEnabled(value) {
      this.cursorEnabled = Boolean(value)
    }
  },

  persist: {
    pick: ['theme', 'sidebarCollapsed', 'cursorEnabled']
  }
})
