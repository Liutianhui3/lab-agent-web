import { watch } from 'vue'
import { useUserInfo } from '@/composables/useUserInfo'
import Layout from '@/layout/index.vue'
import { ACCESS_TOKEN } from '@/utils/constant'
import { getLocalStorage } from '@/utils/localStorage'
import { authorizedRoutes, canAccessRoute } from './menu'

const layoutRouteName = 'authenticated-layout'
const authPaths = new Set(['/login', '/register'])

function hasToken() {
  const token = getLocalStorage(ACCESS_TOKEN)
  return typeof token === 'string' && token.trim().length > 0
}

function addAuthorizedRoutes(router) {
  if (router.hasRoute(layoutRouteName)) return
  router.addRoute({
    path: '/layout',
    name: layoutRouteName,
    component: Layout,
    children: authorizedRoutes
  })
}

export function removeAuthorizedRoutes(router) {
  if (router.hasRoute(layoutRouteName)) router.removeRoute(layoutRouteName)
}

export function createRouterGuard(router) {
  const { userInfo } = useUserInfo()
  watch(
    () => userInfo.value.role,
    role => {
      if (!hasToken()) {
        removeAuthorizedRoutes(router)
        return
      }
      addAuthorizedRoutes(router)
      const current = authorizedRoutes.find(route => route.path === router.currentRoute.value.path)
      if (current && !canAccessRoute(current, role)) router.replace('/no-permission')
    },
    { flush: 'sync' }
  )
  router.beforeEach(to => {
    const authenticated = hasToken()
    const target = authorizedRoutes.find(route => route.path === to.path)

    // Known dynamic routes may initially match the catch-all on a fresh page load.
    // Resolve those after installing the route tree; only unknown URLs are 404s.
    if (to.name === 'unmatched' && !target) {
      return { path: '/not-found', replace: true }
    }

    if (!authenticated) {
      removeAuthorizedRoutes(router)
      if (authPaths.has(to.path) || ['/no-permission', '/not-found'].includes(to.path)) return true
      return { path: '/login', replace: true, query: { redirect: to.fullPath } }
    }

    addAuthorizedRoutes(router)
    if (target && !canAccessRoute(target, userInfo.value.role)) {
      return { path: '/no-permission', replace: true }
    }

    if (authPaths.has(to.path) || to.path === '/' || to.path === '/layout') {
      return { path: '/home', replace: true }
    }

    // Re-resolve once after adding the authenticated route tree.
    const isAuthorizedPath = authorizedRoutes.some(
      route => route.path === to.path && canAccessRoute(route, userInfo.value.role)
    )
    if (isAuthorizedPath && !to.matched.some(record => record.name === layoutRouteName)) {
      return { path: to.fullPath, replace: true }
    }

    return true
  })
}
