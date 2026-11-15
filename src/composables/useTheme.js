import { readonly, ref } from 'vue'

const storageKey = 'theme'
const modes = ['light', 'dark', 'system']
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
const theme = ref('system')

try {
  const saved = localStorage.getItem(storageKey)
  if (modes.includes(saved)) theme.value = saved
} catch {
  // 禁用本地存储时仍可切换当前页面主题。
}

function applyTheme() {
  const dark = theme.value === 'dark' || (theme.value === 'system' && systemTheme.matches)
  document.documentElement.classList.toggle('dark', dark)
}

function setTheme(value) {
  if (!modes.includes(value)) return
  theme.value = value
  applyTheme()
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    // 存储不可用时保留本次选择。
  }
}

systemTheme.addEventListener('change', applyTheme)
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey && event.key !== null) return
  theme.value = modes.includes(event.newValue) ? event.newValue : 'system'
  applyTheme()
})
applyTheme()

// 在任意组件中调用 setTheme('light' | 'dark' | 'system') 切换主题。
export function useTheme() {
  return { theme: readonly(theme), setTheme }
}
