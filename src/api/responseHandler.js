import { ACCESS_TOKEN, USER_INFO } from '@/utils/constant'
import { delLocalStorage } from '@/utils/localStorage'

// 退出登录
export function clearLogin(path) {
  delLocalStorage(ACCESS_TOKEN)
  delLocalStorage(USER_INFO)
  window.location = path
}
