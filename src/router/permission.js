import Layout from '@/layout/index.vue'
import { ACCESS_TOKEN } from '@/utils/constant'
import { getLocalStorage } from '@/utils/localStorage'
import { authorizedRoutes } from './menu'

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
  router.beforeEach(to => {
    const authenticated = hasToken()

    if (!authenticated) {
      removeAuthorizedRoutes(router)
      if (authPaths.has(to.path) || to.path === '/no-permission') return true
      return { path: '/login', replace: true, query: { redirect: to.fullPath } }
    }

    addAuthorizedRoutes(router)

    if (authPaths.has(to.path) || to.path === '/' || to.path === '/layout') {
      return { path: '/home', replace: true }
    }

    // Re-resolve once after adding the authenticated route tree.
    const isAuthorizedPath = authorizedRoutes.some(route => route.path === to.path)
    if (isAuthorizedPath && !to.matched.some(record => record.name === layoutRouteName)) {
      return { path: to.fullPath, replace: true }
    }

    if (to.name === 'not-found') return { path: '/home', replace: true }

    return true
  })
}
