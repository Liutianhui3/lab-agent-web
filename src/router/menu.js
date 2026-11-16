import Home from '@/views/home/index.vue'

// Authorized routes are registered under the authenticated layout by permission.js.
export const menuRoutes = [
  { path: '/home', name: 'home', component: Home, meta: { title: '首页工作台' } },
  {
    path: '/assistant',
    name: 'assistant',
    component: () => import('@/views/assistant/index.vue'),
    meta: { title: 'AI 智能助手' }
  },
  {
    path: '/laboratories',
    name: 'laboratories',
    component: () => import('@/views/laboratories/index.vue'),
    meta: { title: '实验室管理', roles: ['admin'] }
  },
  {
    path: '/equipment',
    name: 'equipment',
    component: () => import('@/views/equipment/index.vue'),
    meta: { title: '设备列表管理' }
  },
  {
    path: '/reviews',
    name: 'reviews',
    component: () => import('@/views/reviews/index.vue'),
    meta: { title: '预约审核' }
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('@/views/users/index.vue'),
    meta: { title: '用户管理', roles: ['admin'] }
  }
]

// Account pages require authentication but do not appear in the primary navigation.
export const authorizedRoutes = [
  ...menuRoutes,
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/profile/index.vue'),
    meta: { title: '个人资料' }
  },
  {
    path: '/security',
    name: 'security',
    component: () => import('@/views/security/index.vue'),
    meta: { title: '安全与访问' }
  }
]

// Header and router share the same role policy; unknown roles cannot access restricted routes.
export function canAccessRoute(route, role) {
  return !route.meta?.roles || route.meta.roles.includes(role)
}
