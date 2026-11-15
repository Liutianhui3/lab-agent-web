import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
// 启动时初始化主题；默认跟随系统，不依赖页面上的切换控件。
import '@/composables/useTheme'

import '@/assets/styles/tailwind.css'
import '@/assets/styles/main.less'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
