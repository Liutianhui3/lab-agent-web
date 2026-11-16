<template>
  <main
    ref="root"
    class="relative min-h-svh bg-[#faf9fe] px-5 pt-20 pb-8 lg:bg-white lg:p-0 text-[#1a1b1f] selection:bg-[#eeecfe] selection:text-[#2a238a] dark:bg-[#000] dark:text-[#f4f3f8] lg:grid lg:grid-cols-[7fr_5fr]"
  >
    <a
      href="#login-account"
      class="sr-only z-50 rounded-lg bg-white p-4 text-[#524ac6] focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
    >
      跳转到登录表单
    </a>
    <LoginVisual />
    <LoginForm
      v-model:account="account"
      v-model:password="password"
      :errors="errors"
      :submitting="submitting"
      :notice="notice"
      @submit="submit"
      @clear-error="clearFieldError"
      @register="register"
    />
  </main>
</template>

<script setup>
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import LoginVisual from './components/LoginVisual.vue'
  import LoginForm from './components/LoginForm.vue'
  import { login } from '@/api/auth'
  import { ACCESS_TOKEN, USER_INFO } from '@/utils/constant'
  import { setLocalStorage, getLocalStorage, delLocalStorage } from '@/utils/localStorage'
  import { useLoginMotion } from './composables/useLoginMotion'

  const router = useRouter()
  const root = ref(null)
  const account = ref('')
  const password = ref('')
  const errors = ref({})
  const submitting = ref(false)
  const notice = ref('')

  useLoginMotion(root)

  function clearFieldError(field) {
    errors.value[field] = ''
    notice.value = ''
  }

  async function submit() {
    if (submitting.value) return
    notice.value = ''
    errors.value = {
      account: account.value.trim() ? '' : '用户名为空',
      password: password.value ? '' : '访问密码为空'
    }
    if (errors.value.account || errors.value.password) {
      requestAnimationFrame(() => root.value.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    submitting.value = true
    try {
      const response = await login({ username: account.value.trim(), password: password.value })
      const { accessToken, user } = response.data || {}
      if (typeof accessToken !== 'string' || !accessToken.trim() || !user?.id) {
        notice.value = '登录响应不完整，请稍后重试。'
        return
      }
      setLocalStorage(ACCESS_TOKEN, accessToken)
      setLocalStorage(USER_INFO, user)
      if (getLocalStorage(ACCESS_TOKEN) !== accessToken || !getLocalStorage(USER_INFO)?.id) {
        delLocalStorage(ACCESS_TOKEN)
        delLocalStorage(USER_INFO)
        notice.value = '无法保存登录状态，请检查浏览器存储设置后重试。'
        return
      }
      password.value = ''
      await router.replace('/home')
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.response?.data?.message
      notice.value =
        message ||
        (error?.code === 'ECONNABORTED'
          ? '请求超时，请稍后重试。'
          : error?.response
            ? '登录失败，请稍后重试。'
            : '网络连接失败，请检查网络后重试。')
    } finally {
      submitting.value = false
    }
  }

  function register() {
    router.push('/register')
  }
</script>
