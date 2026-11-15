import { createRouter, createWebHistory } from 'vue-router'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { constantRoutes } from './constants'
import { createRouterGuard } from './permission'

NProgress.configure({ showSpinner: false })

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_PUBLIC_PATH),
  routes: constantRoutes
})

createRouterGuard(router)
router.afterEach(() => NProgress.done())
router.onError(() => NProgress.done())
router.beforeEach(() => {
  NProgress.start()
})

export function resetRouter() {
  if (router.hasRoute('authenticated-layout')) router.removeRoute('authenticated-layout')
}

export default router
