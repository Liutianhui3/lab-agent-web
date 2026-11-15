import { readonly, ref } from 'vue'
import { USER_INFO } from '@/utils/constant'
import { getLocalStorage, setLocalStorage } from '@/utils/localStorage'

const userInfo = ref(getLocalStorage(USER_INFO) || {})
const refresh = () => { userInfo.value = getLocalStorage(USER_INFO) || {} }
window.addEventListener('user-info-change', refresh)
window.addEventListener('storage', event => {
  if (event.key === USER_INFO || event.key === null) refresh()
})

export function useUserInfo() {
  function updateUserInfo(user) {
    setLocalStorage(USER_INFO, user)
    // Keep the UI current even when browser storage is unavailable.
    userInfo.value = user || {}
  }
  return { userInfo: readonly(userInfo), updateUserInfo }
}
