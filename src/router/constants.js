import Login from '@/views/login/index.vue'
import Register from '@/views/register/index.vue'
import NoPermission from '@/views/no-permission/index.vue'
import NotFound from '@/views/not-found/index.vue'

// Only routes that do not require an authenticated session belong here.
export const constantRoutes = [
  { path: '/', redirect: '/login' },
  { path: '/login', name: 'login', component: Login, meta: { title: '登录页' } },
  { path: '/register', name: 'register', component: Register, meta: { title: '注册页' } },
  {
    path: '/no-permission',
    name: 'no-permission',
    component: NoPermission,
    meta: { title: '无权限' }
  },
  { path: '/not-found', name: 'not-found', component: NotFound, meta: { title: '页面不存在' } },
  // Keep the original target available to the guard until dynamic routes are installed.
  { path: '/:pathMatch(.*)*', name: 'unmatched', component: NotFound }
]
