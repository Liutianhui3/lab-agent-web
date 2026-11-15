<template>
  <main
    ref="root"
    class="relative min-h-svh bg-[#faf9fe] px-5 pt-20 pb-8 text-[#1a1b1f] selection:bg-[#eeecfe] selection:text-[#2a238a] dark:bg-[#18191e] dark:text-[#f4f3f8] lg:grid lg:grid-cols-[7fr_5fr] lg:bg-white lg:p-0"
  >
    <a
      href="#register-account"
      class="sr-only z-50 rounded-lg bg-white p-4 text-[#524ac6] focus:not-sr-only focus:absolute focus:top-4 focus:left-4"
    >
      跳转到注册表单
    </a>
    <LoginVisual />
    <section
      aria-labelledby="register-title"
      class="mt-4 flex flex-col rounded-2xl bg-white px-6 shadow-[0_2px_4px_rgba(26,27,31,0.04)] dark:bg-[#202127] lg:relative lg:mt-0 lg:min-h-svh lg:rounded-none lg:bg-transparent lg:px-14 lg:shadow-none lg:dark:bg-transparent xl:px-20"
    >
      <LoginThemeToggle />
      <div class="mx-auto w-full max-w-[440px] flex-1 content-center py-7 sm:py-9 lg:py-20">
        <div data-enter class="mb-8">
          <h2
            id="register-title"
            class="text-[23px] leading-tight font-semibold tracking-tight lg:text-[32px]"
          >
            创建您的账号
          </h2>
          <p class="mt-2 text-[13px] leading-6 text-[#747984] dark:text-[#a9adb9]">
            填写账号信息，开始使用实验室预约系统。
          </p>
        </div>
        <form novalidate :aria-busy="submitting" class="space-y-5" @submit.prevent="submit">
          <RegisterField
            id="register-account"
            v-model="form.account"
            label="用户名"
            placeholder="请输入您的用户名"
            autocomplete="username"
            :icon="UserRound"
            :error="errors.account"
            @clear-error="clearError('account')"
          />
          <RegisterField
            id="register-email"
            v-model="form.email"
            label="邮箱"
            type="email"
            placeholder="请输入您的邮箱"
            autocomplete="email"
            :icon="Mail"
            :error="errors.email"
            @clear-error="clearError('email')"
          />
          <RegisterField
            id="register-password"
            v-model="form.password"
            label="设置密码"
            type="password"
            placeholder="请设置密码"
            :hint="PASSWORD_HINT"
            autocomplete="new-password"
            :icon="LockKeyhole"
            :error="passwordError"
            @clear-error="clearError('password')"
          >
            <div
              v-if="form.password"
              role="meter"
              aria-label="密码强度"
              aria-valuemin="0"
              aria-valuemax="4"
              :aria-valuenow="passwordStrength"
              :aria-valuetext="passwordStrengthLabel"
              class="mt-2 flex items-center gap-1.5"
            >
              <span
                v-for="n in 4"
                :key="n"
                aria-hidden="true"
                class="h-[3px] flex-1 rounded-full"
                :class="
                  n <= passwordStrength
                    ? 'bg-[#635bd2] dark:bg-[#a69fff]'
                    : 'bg-[#e5e4ed] dark:bg-[#383943]'
                "
              />
              <span class="ml-1 text-[11px] text-[#747984] dark:text-[#a9adb9]">
                {{ passwordStrengthLabel }}
              </span>
            </div>
          </RegisterField>
          <RegisterField
            id="register-confirm"
            v-model="form.confirmPassword"
            label="确认密码"
            type="password"
            placeholder="请再次输入密码"
            autocomplete="new-password"
            :icon="LockKeyhole"
            :error="errors.confirmPassword"
            @clear-error="clearError('confirmPassword')"
          />
          <div data-enter class="pt-3">
            <button
              type="submit"
              :disabled="submitting || registered"
              class="disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:active:scale-100 flex h-[52px] w-full cursor-pointer items-center justify-center rounded-lg bg-[#7b74f3] text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#6259d0] active:translate-y-0 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b74f3]"
            >
              {{ submitting ? '注册中…' : registered ? '注册成功' : '立即注册' }}
            </button>
          </div>
          <p
            v-if="notice"
            :role="registered ? 'status' : 'alert'"
            class="text-sm leading-6"
            :class="
              registered
                ? 'text-[#635bd2] dark:text-[#b9b3ff]'
                : 'text-[#e52e55] dark:text-[#ff839b]'
            "
          >
            {{ notice }}
          </p>
        </form>
        <div data-enter class="mt-6 flex flex-wrap items-center justify-center gap-2 text-[13px]">
          <span class="text-[#747984] dark:text-[#a9adb9]">已有账号？</span>
          <RouterLink
            to="/login"
            class="inline-flex min-h-11 items-center font-medium text-[#635bd2] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7b74f3] dark:text-[#b9b3ff]"
          >
            返回登录
          </RouterLink>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
  import { computed, reactive, ref } from 'vue'
  import { RouterLink } from 'vue-router'
  import { UserRound, Mail, LockKeyhole } from 'lucide-vue-next'
  import LoginVisual from '@/views/login/components/LoginVisual.vue'
  import LoginThemeToggle from '@/views/login/components/LoginThemeToggle.vue'
  import { useLoginMotion } from '@/views/login/composables/useLoginMotion'
  import RegisterField from './components/RegisterField.vue'
  import { register } from '@/api/auth'
  import { PASSWORD_HINT, validatePassword } from '@/utils/password'

  const root = ref(null)
  const form = reactive({ account: '', email: '', password: '', confirmPassword: '' })
  const errors = ref({})
  const notice = ref('')
  const submitting = ref(false)
  const registered = ref(false)
  const passwordValidation = computed(() => validatePassword(form.password))
  const passwordError = computed(() =>
    form.password ? passwordValidation.value.errors.join('；') : errors.value.password
  )
  const passwordStrength = computed(() => {
    if (!form.password) return 0
    if (passwordValidation.value.valid) return /[^a-zA-Z0-9]/.test(form.password) ? 4 : 3
    return Math.min(2, [/[A-Z]/, /[a-z]/, /[0-9]/].filter(rule => rule.test(form.password)).length)
  })
  const passwordStrengthLabel = computed(() =>
    !passwordValidation.value.valid ? '未达标' : passwordStrength.value === 3 ? '合格' : '强'
  )
  useLoginMotion(root)
  function clearError(field) {
    errors.value[field] = ''
    if (field === 'password') errors.value.confirmPassword = ''
    if (!registered.value) notice.value = ''
  }
  async function submit() {
    if (submitting.value || registered.value) return
    errors.value = {
      account: !form.account.trim()
        ? '请输入用户名'
        : form.account.trim().length > 50
          ? '用户名不能超过 50 位'
          : '',
      email:
        form.email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
          ? ''
          : '请输入有效的邮箱地址（不超过 254 位）',
      password: passwordValidation.value.errors.join('；'),
      confirmPassword: !form.confirmPassword
        ? '请再次输入密码'
        : form.confirmPassword !== form.password
          ? '两次输入的密码不一致'
          : ''
    }
    notice.value = ''
    if (Object.values(errors.value).some(Boolean)) {
      requestAnimationFrame(() => root.value.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    submitting.value = true
    try {
      await register({
        username: form.account.trim(),
        email: form.email.trim(),
        password: form.password
      })
      registered.value = true
      form.password = ''
      form.confirmPassword = ''
      notice.value = '注册成功，请点击下方“返回登录”登录账号。'
    } catch (error) {
      const message = typeof error === 'string' ? error : error?.response?.data?.message
      notice.value =
        message ||
        (error?.code === 'ECONNABORTED'
          ? '请求超时，请稍后重试。'
          : error?.response
            ? '注册失败，请稍后重试。'
            : '网络连接失败，请检查网络后重试。')
    } finally {
      submitting.value = false
    }
  }
</script>
