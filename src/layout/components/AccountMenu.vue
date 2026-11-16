<script setup>
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { UserRound, ShieldCheck, Wallet, LogOut } from 'lucide-vue-next'
  import { ACCESS_TOKEN, USER_INFO, USER_ROLES } from '@/utils/constant'
  import { delLocalStorage } from '@/utils/localStorage'
  import { removeAuthorizedRoutes } from '@/router/permission'
  import { useUserInfo } from '@/composables/useUserInfo'
  import { avatarUrl } from '@/utils/avatar'

  const route = useRoute()
  const router = useRouter()
  const root = ref(null)
  const trigger = ref(null)
  const open = ref(false)
  const { userInfo: user } = useUserInfo()
  const name = computed(() => user.value.name || user.value.username || '用户')
  const role = computed(() => USER_ROLES.find(item => item.value === user.value.role)?.label || '用户')
  const avatar = computed(() => avatarUrl(user.value.avatar))
  const failedAvatar = ref('')
  const showAvatar = computed(() => avatar.value && failedAvatar.value !== avatar.value)
  let closeTimer

  function cancelClose() { clearTimeout(closeTimer) }
  function showOnHover(event) {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(min-width: 768px) and (hover: hover)').matches) return
    cancelClose()
    open.value = true
  }
  function scheduleClose(event) {
    if (event.pointerType !== 'mouse') return
    closeTimer = setTimeout(() => { open.value = false }, 140)
  }
  function toggle() { cancelClose(); open.value = !open.value }
  function dismiss(event) {
    if (!root.value?.contains(event.target)) { cancelClose(); open.value = false }
  }
  function escape(event) {
    if (event.key === 'Escape' && open.value) {
      cancelClose()
      open.value = false
      trigger.value?.focus()
    }
  }
  function focusOut(event) {
    if (!root.value?.contains(event.relatedTarget)) { cancelClose(); open.value = false }
  }
  function logout() {
    open.value = false
    delLocalStorage(ACCESS_TOKEN)
    delLocalStorage(USER_INFO)
    removeAuthorizedRoutes(router)
    router.replace('/login')
  }
  watch(() => route.fullPath, () => { cancelClose(); open.value = false })
  onMounted(() => {
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
  })
  onBeforeUnmount(() => {
    cancelClose()
    document.removeEventListener('pointerdown', dismiss)
    document.removeEventListener('keydown', escape)
  })
</script>

<template>
  <div ref="root" class="account-menu relative" @pointerenter="showOnHover" @pointerleave="scheduleClose" @focusout="focusOut">
    <button ref="trigger" type="button" aria-label="账户菜单" :aria-expanded="open" aria-controls="account-panel"
      class="flex cursor-pointer items-center gap-2 rounded-lg bg-transparent text-left shadow-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b6cf0]"
      @click="toggle" @keydown.down.prevent="open = true">
      <span class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#514def] text-white"><img v-if="showAvatar" :src="avatar" alt="" class="size-full object-cover" @error="failedAvatar = avatar" /><UserRound v-else :size="18" aria-hidden="true" /></span>
      <span class="max-w-[100px] truncate text-sm leading-5 font-medium sm:max-w-[150px]">{{ name }}</span>
    </button>
    <Transition name="account">
      <section v-if="open" id="account-panel" aria-label="账户选项" class="account-panel absolute right-0 top-full z-50 mt-3 w-[304px] max-w-[calc(100vw-32px)] rounded-[22px] border border-white/80 bg-white/95 p-2.5 text-[#484653] shadow-[0_16px_48px_rgba(32,24,60,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-[#19191B] dark:text-[#d5d3df]">
        <div class="flex items-center gap-3 rounded-2xl bg-transparent p-3 shadow-none">
          <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#514def] text-white"><img v-if="showAvatar" :src="avatar" alt="" class="size-full object-cover" @error="failedAvatar = avatar" /><UserRound v-else :size="24" aria-hidden="true" /></span>
          <div class="min-w-0"><p class="truncate text-base font-semibold text-[#25232d] dark:text-white">{{ name }}</p><p class="mt-1 text-xs text-[#716d80] dark:text-[#b6b2c4]">{{ role }}</p></div>
        </div>
        <div class="my-2 border-t border-[#eeedf3] dark:border-white/10" />
        <RouterLink to="/profile" class="account-row"><UserRound :size="20" aria-hidden="true" /><span>个人资料</span></RouterLink>
        <RouterLink to="/security" class="account-row"><ShieldCheck :size="20" aria-hidden="true" /><span>安全与访问</span></RouterLink>
        <div class="account-row" aria-label="机时账户与经费，示例余额 12480 元">
          <Wallet :size="20" aria-hidden="true" /><span class="flex-1">机时账户与经费</span>
          <span class="rounded-full bg-[#e9f8ee] px-2 py-1 text-xs font-semibold text-[#22844b] dark:bg-[#1e3b2a] dark:text-[#8cdda8]">¥12,480</span>
        </div>
        <div class="my-2 border-t border-[#eeedf3] dark:border-white/10" />
        <button type="button" class="account-row w-full cursor-pointer text-[#d82c3c] dark:text-[#ff8490]" @click="logout"><LogOut :size="20" aria-hidden="true" /><span>登出</span></button>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
  .account-row { display: flex; min-height: 46px; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; font-size: 14px; text-decoration: none; transition: background-color .18s, transform .18s; }
  a.account-row:hover, button.account-row:hover { background: rgb(123 108 240 / 8%); transform: translateX(2px); }
  .account-row:focus-visible { outline: 2px solid #7b6cf0; outline-offset: -2px; }
  .account-panel { transform-origin: top right; }
  .account-enter-active { transition: opacity .2s, transform .24s cubic-bezier(.16,1,.3,1); }
  .account-leave-active { transition: opacity .14s, transform .14s; }
  .account-enter-from, .account-leave-to { opacity: 0; transform: translateY(-6px) scale(.96); }
  @media (prefers-reduced-motion: reduce) { .account-enter-active, .account-leave-active, .account-row { transition: none; } }
</style>
