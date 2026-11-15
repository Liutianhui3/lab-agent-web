import Login from '@/views/login/index.vue'
import Register from '@/views/register/index.vue'

// Only routes that do not require an authenticated session belong here.
export const constantRoutes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: Login, meta: { title: '登录页' } },
  { path: '/register', name: 'register', component: Register, meta: { title: '注册页' } },
  { path: '/no-permission', name: 'no-permission', component: Login, meta: { title: '无权限' } },
  // Keep the original target available to the guard until dynamic routes are installed.
  { path: '/:pathMatch(.*)*', name: 'not-found', component: Login }
]
