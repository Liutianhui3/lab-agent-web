<script setup>
  import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { LockKeyhole, Check, LoaderCircle } from 'lucide-vue-next'
  import gsap from 'gsap'
  import SnowfallBackground from '@/components/SnowfallBackground.vue'
  import RegisterField from '@/views/register/components/RegisterField.vue'
  import { PASSWORD_HINT, validatePassword } from '@/utils/password'
  import { updatePassword } from '@/api/user'

  const router = useRouter()
  const root = ref(null)
  const form = reactive({ oldPassword: '', password: '', confirm: '' })
  const errors = ref({})
  const submitting = ref(false)
  const notice = ref('')
  const success = ref(false)
  const validation = computed(() => validatePassword(form.password))
  const passwordError = computed(() =>
    form.password
      ? validation.value.errors.join('；') || errors.value.password
      : errors.value.password
  )
  const strength = computed(() =>
    !form.password
      ? 0
      : validation.value.valid
        ? /[^a-zA-Z0-9]/.test(form.password)
          ? 4
          : 3
        : Math.min(2, [/[A-Z]/, /[a-z]/, /[0-9]/].filter(rule => rule.test(form.password)).length)
  )
  const strengthLabel = computed(() =>
    !validation.value.valid ? '未达标' : strength.value === 3 ? '合格' : '强'
  )
  let media
  let active = true
  onMounted(() => {
    media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(root.value.querySelectorAll('.security-intro, .security-card'), {
        y: 14,
        opacity: 0,
        duration: 0.55,
        stagger: 0.1,
        ease: 'power3.out'
      })
    })
  })
  onBeforeUnmount(() => {
    active = false
    media?.revert()
  })
  function clearError(field) {
    errors.value[field] = ''
    if (field === 'password') errors.value.confirm = ''
    notice.value = ''
    success.value = false
  }
  async function submit() {
    if (submitting.value) return
    errors.value = {
      oldPassword: form.oldPassword ? '' : '请输入当前密码',
      password:
        validation.value.errors.join('；') ||
        (form.password === form.oldPassword ? '新密码不能与原密码相同' : ''),
      confirm: !form.confirm
        ? '请再次输入密码'
        : form.confirm !== form.password
          ? '两次输入的密码不一致'
          : ''
    }
    notice.value = ''
    success.value = false
    if (Object.values(errors.value).some(Boolean)) {
      requestAnimationFrame(() => root.value?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    submitting.value = true
    try {
      await updatePassword({ old_password: form.oldPassword, new_password: form.password })
      if (!active) return
      form.oldPassword = form.password = form.confirm = ''
      errors.value = {}
      success.value = true
      notice.value = '密码修改成功，下次登录请使用新密码。'
    } catch (error) {
      if (!active) return
      notice.value =
        (typeof error === 'string' ? error : error?.response?.data?.message) ||
        '密码修改失败，请稍后重试。'
    } finally {
      if (active) submitting.value = false
    }
  }
</script>

<template>
  <section ref="root" class="security-page" aria-labelledby="security-title">
    <SnowfallBackground />
    <div class="security-wrap">
      <div class="security-intro">
        <h1 id="security-title">修改密码</h1>
      </div>
      <form class="security-card" novalidate :aria-busy="submitting" @submit.prevent="submit">
        <fieldset :disabled="submitting">
          <RegisterField
            id="security-old-password"
            v-model="form.oldPassword"
            label="原密码"
            type="password"
            placeholder="请输入当前密码"
            autocomplete="current-password"
            :icon="LockKeyhole"
            :error="errors.oldPassword"
            @clear-error="clearError('oldPassword')"
          />
          <RegisterField
            id="security-new-password"
            v-model="form.password"
            label="设置密码"
            type="password"
            placeholder="请设置新密码"
            autocomplete="new-password"
            :icon="LockKeyhole"
            :hint="PASSWORD_HINT"
            :error="passwordError"
            @clear-error="clearError('password')"
          >
            <div
              v-if="form.password"
              class="password-strength"
              role="meter"
              aria-label="密码强度"
              :aria-valuenow="strength"
              aria-valuemin="0"
              aria-valuemax="4"
              :aria-valuetext="strengthLabel"
            >
              <span v-for="n in 4" :key="n" aria-hidden="true" :class="{ filled: n <= strength }" />
              <small>{{ strengthLabel }}</small>
            </div>
          </RegisterField>
          <RegisterField
            id="security-confirm-password"
            v-model="form.confirm"
            label="确认密码"
            type="password"
            placeholder="请再次输入密码"
            autocomplete="new-password"
            :icon="LockKeyhole"
            :error="errors.confirm"
            @clear-error="clearError('confirm')"
          />
        </fieldset>
        <p
          v-if="notice"
          class="security-notice"
          :class="{ success }"
          :role="success ? 'status' : 'alert'"
        >
          {{ notice }}
        </p>
        <div class="security-actions">
          <button type="submit" class="submit-button" :disabled="submitting">
            <LoaderCircle v-if="submitting" :size="20" class="animate-spin" />
            <Check v-else :size="20" />
            {{ submitting ? '正在修改…' : '确认修改密码' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
  .security-page {
    position: relative;
    isolation: isolate;
    --security-bg: #f7f9fc;
    --security-surface: #fff;
    --security-ink: #172033;
    --security-muted: #647895;
    --security-line: #dfe6f0;
    --security-input: #fafbfd;
    --security-accent: #6554ff;
    min-height: 100%;
    background: var(--security-bg);
    color: var(--security-ink);
    padding: 36px 40px 48px;
  }
  :global(.dark .security-page) {
    --security-bg: #000;
    --security-surface: #19191b;
    --security-ink: #f0f1f8;
    --security-muted: #a8b3c8;
    --security-line: #3c4050;
    --security-input: #252731;
    --security-accent: #a99aff;
  }
  .security-wrap {
    max-width: 1240px;
    margin: 0 auto;
  }
  .security-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px;
    border: 1px solid #dde2ff;
    border-radius: 24px;
    background: #eef1ff;
    color: #6554ff;
    font-size: 14px;
    font-weight: 500;
  }
  :global(.dark .security-badge) {
    background: #2c2944;
    border-color: #484269;
    color: #b4a8ff;
  }
  .security-intro {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #eeecf4;
    padding-bottom: 18px;
    margin-bottom: 30px;
  }
  :global(.dark .security-intro) {
    border-bottom-color: #35343f;
  }
  h1 {
    margin: 0;
    color: #25232d;
    font-size: 26px;
    font-weight: 650;
    line-height: 1.4;
    letter-spacing: -0.02em;
  }
  :global(.dark .security-intro h1) {
    color: #f2f0f8;
  }
  .security-intro > p {
    color: var(--security-muted);
    font-size: 16px;
    line-height: 1.7;
  }
  .security-card {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 50px;
    border: 1px solid var(--security-line);
    border-radius: 28px;
    background: var(--security-surface);
    box-shadow:
      0 2px 3px rgb(30 45 70 / 4%),
      0 18px 30px rgb(30 45 70 / 3%);
  }
  fieldset {
    display: grid;
    gap: 30px;
    min-width: 0;
    border: 0;
    padding: 0;
    margin: 0;
  }
  .security-card :deep(label) {
    margin-bottom: 10px;
    font-size: 16px;
    font-weight: 600;
  }
  .security-card :deep(input) {
    height: 56px;
    border: 0;
    border-bottom: 1px solid var(--security-line);
    border-radius: 0;
    background: transparent;
    color: var(--security-ink);
    padding-left: 56px;
    padding-right: 52px;
    font-size: 16px;
    caret-color: var(--security-accent);
  }
  .security-card :deep(input::placeholder) {
    color: var(--security-muted);
  }
  .security-card :deep(input:focus) {
    border-color: transparent;
    border-bottom: 2px solid var(--security-accent);
    background: transparent;
  }
  .security-card :deep(input[aria-invalid='true']) {
    border-color: transparent;
    border-bottom: 2px solid #ff3b63;
    background: #fff8fa;
  }
  :global(.dark .security-card input[aria-invalid='true']) {
    background: #35232d;
    border-bottom-color: #ff839b;
  }
  .security-card :deep(.relative > svg) {
    left: 20px;
    top: 17px;
    color: var(--security-muted);
    width: 22px;
    height: 22px;
  }
  .security-card :deep(.relative > button) {
    width: 56px;
    height: 56px;
    color: var(--security-muted);
  }
  .security-card :deep(.relative > button svg) {
    width: 22px;
    height: 22px;
  }
  .security-card :deep(p[id$='-error']) {
    font-size: 14px;
    line-height: 1.65;
    padding-top: 12px;
  }
  .security-card :deep(p[id$='-hint']) {
    color: var(--security-muted);
    font-size: 14px;
    line-height: 1.7;
    padding-top: 12px;
  }
  .password-strength {
    display: flex;
    align-items: center;
    gap: 9px;
    margin-top: 18px;
  }
  .password-strength > span {
    flex: 1;
    height: 6px;
    border-radius: 8px;
    background: var(--security-line);
    transition: background-color 0.25s;
  }
  .password-strength > span.filled {
    background: var(--security-accent);
  }
  .password-strength small {
    margin-left: 10px;
    color: var(--security-muted);
    font-size: 14px;
    white-space: nowrap;
  }
  .security-actions {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
    margin-top: 54px;
  }
  .security-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 22px;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.18s,
      background-color 0.18s;
  }
  .cancel-button {
    border: 1px solid var(--security-line);
    color: var(--security-muted);
    background: var(--security-surface);
  }
  .submit-button {
    background: #6554ff;
    color: #fff;
    box-shadow: 0 4px 7px rgb(101 84 255 / 18%);
  }
  .security-actions button:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .submit-button:not(:disabled):hover {
    background: #5544e5;
  }
  .security-actions button:not(:disabled):active {
    transform: translateY(0) scale(0.98);
  }
  .security-actions button:focus-visible {
    outline: 2px solid var(--security-accent);
    outline-offset: 4px;
  }
  .security-actions button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .security-notice {
    margin-top: 22px;
    font-size: 14px;
    line-height: 1.7;
    color: #d52950;
  }
  .security-notice.success {
    color: #258348;
  }
  :global(.dark .security-notice) {
    color: #ff839b;
  }
  :global(.dark .security-notice.success) {
    color: #83d39a;
  }
  @media (max-width: 767px) {
    .security-page {
      padding: 22px 16px 28px;
    }
    .security-intro {
      margin-bottom: 20px;
      padding-bottom: 12px;
    }
    h1 {
      font-size: 22px;
    }
  }
  @media (max-width: 600px) {
    .security-page {
      padding: 22px 16px 28px;
    }
    h1 {
      font-size: 22px;
    }
    .security-intro > p {
      font-size: 14px;
    }
    .security-card {
      padding: 26px 20px;
      border-radius: 22px;
      margin-top: 0;
    }
    fieldset {
      gap: 26px;
    }
    .security-actions {
      flex-direction: column-reverse;
      gap: 12px;
      margin-top: 32px;
    }
    .security-actions button {
      width: 100%;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
