<script setup>
  import { ref } from 'vue'
  import { Eye, EyeOff, CircleAlert, UserRound, LockKeyhole } from 'lucide-vue-next'
  import ThemeModeSwitch from '@/components/ThemeModeSwitch.vue'

  const account = defineModel('account', { type: String, default: '' })
  const password = defineModel('password', { type: String, default: '' })
  defineProps({
    errors: { type: Object, default: () => ({}) },
    submitting: Boolean,
    notice: String
  })
  const emit = defineEmits(['submit', 'clear-error', 'register'])
  const visible = ref(false)
</script>

<template>
  <section
    aria-labelledby="login-title"
    class="mt-4 flex flex-col rounded-2xl bg-white px-6 shadow-[0_2px_4px_rgba(26,27,31,0.04)] dark:bg-[#19191B] lg:relative lg:mt-0 lg:min-h-svh lg:rounded-none lg:bg-transparent lg:px-14 lg:shadow-none lg:dark:bg-transparent xl:px-20"
  >
    <ThemeModeSwitch placement="auth" />
    <div class="mx-auto w-full max-w-[440px] flex-1 content-center py-7 sm:py-9 lg:py-20">
      <div data-enter class="mb-9">
        <h2
          id="login-title"
          class="text-[23px] leading-tight font-semibold tracking-tight lg:text-[32px]"
        >
          统一身份登录
        </h2>
        <p class="mt-2 text-[13px] leading-6 text-[#747984] dark:text-[#a9adb9]">
          请输入您的科研凭据以访问实验控制台
        </p>
      </div>
      <form :aria-busy="submitting" novalidate @submit.prevent="emit('submit')" class="space-y-6">
        <div data-enter>
          <label for="login-account" class="mb-2.5 block text-[13px] font-medium">用户名</label>
          <div class="relative">
            <UserRound
              aria-hidden="true"
              :size="19"
              class="pointer-events-none absolute left-3 top-[13px] z-10 text-[#9290a6]"
            />
            <input
              id="login-account"
              v-model="account"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              :aria-invalid="!!errors.account"
              :aria-describedby="errors.account ? 'account-error' : undefined"
              @input="emit('clear-error', 'account')"
              placeholder="请输入您的用户名"
              class="h-[46px] w-full rounded-none border-0 border-b border-[#e2e4ea] bg-transparent pr-3 pl-11 text-sm caret-[#7b74f3] outline-none transition placeholder:text-[#787d89] focus:border-[#7b74f3] focus:bg-white focus:ring-0 focus:border-b-2 dark:border-[#383943] dark:bg-transparent dark:focus:bg-transparent aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-[#f43f66] aria-[invalid=true]:bg-[#fff8fa] aria-[invalid=true]:pl-11 aria-[invalid=true]:focus:border-[#f43f66] aria-[invalid=true]:focus:bg-[#fff8fa] dark:aria-[invalid=true]:border-[#ff839b] dark:aria-[invalid=true]:bg-[#35232d] dark:aria-[invalid=true]:focus:bg-[#35232d]"
            />
          </div>
          <p
            v-if="errors.account"
            id="account-error"
            role="alert"
            class="pt-1 flex items-start gap-2 text-xs leading-5 text-[#e52e55] dark:text-[#ff839b]"
          >
            <CircleAlert :size="15" class="mt-0.5 shrink-0" />
            <span>{{ errors.account }}</span>
          </p>
        </div>
        <div data-enter>
          <label for="login-password" class="mb-2.5 block text-[13px] font-medium">访问密码</label>
          <div class="relative">
            <LockKeyhole
              aria-hidden="true"
              :size="19"
              class="pointer-events-none absolute left-3 top-[13px] z-10 text-[#9290a6]"
            />
            <input
              id="login-password"
              v-model="password"
              :type="visible ? 'text' : 'password'"
              autocomplete="current-password"
              :aria-invalid="!!errors.password"
              :aria-describedby="errors.password ? 'password-error' : undefined"
              @input="emit('clear-error', 'password')"
              placeholder="请输入登录凭证密码"
              class="h-[46px] w-full rounded-none border-0 border-b border-[#e2e4ea] bg-transparent pr-12 pl-11 text-sm caret-[#7b74f3] outline-none transition placeholder:text-[#787d89] focus:border-[#7b74f3] focus:bg-white focus:ring-0 focus:border-b-2 dark:border-[#383943] dark:bg-transparent dark:focus:bg-transparent aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-[#f43f66] aria-[invalid=true]:bg-[#fff8fa] aria-[invalid=true]:pl-11 aria-[invalid=true]:focus:border-[#f43f66] aria-[invalid=true]:focus:bg-[#fff8fa] dark:aria-[invalid=true]:border-[#ff839b] dark:aria-[invalid=true]:bg-[#35232d] dark:aria-[invalid=true]:focus:bg-[#35232d]"
            />
            <button
              type="button"
              :aria-label="visible ? '隐藏密码' : '显示密码'"
              :aria-pressed="visible"
              @click="visible = !visible"
              class="absolute top-1 right-1 flex size-11 cursor-pointer items-center justify-center rounded-md text-[#787d89] transition hover:text-[#635bd2] focus-visible:outline-2 focus-visible:outline-[#7b74f3]"
            >
              <EyeOff v-if="visible" :size="18" />
              <Eye v-else :size="18" />
            </button>
          </div>
          <p
            v-if="errors.password"
            id="password-error"
            role="alert"
            class="pt-1 flex items-start gap-2 text-xs leading-5 text-[#e52e55] dark:text-[#ff839b]"
          >
            <CircleAlert :size="15" class="mt-0.5 shrink-0" />
            <span>{{ errors.password }}</span>
          </p>
        </div>
        <div data-enter class="pt-2">
          <button
            type="submit"
            :disabled="submitting"
            class="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 group flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-lg bg-[#7b74f3] text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#6259d0] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b74f3]"
          >
            {{ submitting ? '登录中…' : '立即登录' }}
          </button>
        </div>
        <p v-if="notice" role="alert" class="text-sm leading-6 text-[#e52e55] dark:text-[#ff839b]">
          {{ notice }}
        </p>
      </form>
      <div data-enter class="mt-7 flex flex-wrap items-center justify-center gap-x-2 text-[13px]">
        <span class="text-[#747984] dark:text-[#a9adb9]">还没有账号？</span>
        <button
          type="button"
          @click="emit('register')"
          class="inline-flex min-h-11 cursor-pointer items-center gap-1 font-medium text-[#635bd2] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7b74f3] dark:text-[#b9b3ff]"
        >
          立即注册
        </button>
      </div>
    </div>
  </section>
</template>
