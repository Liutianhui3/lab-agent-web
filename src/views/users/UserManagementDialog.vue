<script setup>
  import { nextTick, onBeforeUnmount, reactive, ref } from 'vue'
  import { X, Eye, EyeOff, Trash2, UserPlus, Pencil } from 'lucide-vue-next'
  import { createUser, updateManagedUser, deleteUser } from '@/api/user'

  const emit = defineEmits(['saved'])
  const dialog = ref(null)
  const mode = ref('create')
  const target = ref(null)
  const busy = ref(false)
  const error = ref('')
  const errors = ref({})
  const visiblePassword = ref(false)
  const form = reactive({
    username: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'student',
    status: 1
  })
  let opener
  function present() {
    opener = document.activeElement
    error.value = ''
    errors.value = {}
    visiblePassword.value = false
    dialog.value.hidden = false
    document.body.classList.add('user-dialog-open')
    nextTick(() =>
      dialog.value.querySelector(mode.value === 'delete' ? '.cancel' : 'input')?.focus()
    )
  }
  function open(user) {
    target.value = user || null
    mode.value = user ? 'edit' : 'create'
    Object.assign(form, {
      username: user?.username || '',
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      password: '',
      role: user?.role || 'student',
      status: user?.status ?? 1
    })
    present()
  }
  function confirmDelete(user) {
    if (user.status !== 0) return
    target.value = user
    mode.value = 'delete'
    present()
  }
  function close() {
    if (busy.value) return
    dialog.value.hidden = true
    document.body.classList.remove('user-dialog-open')
    form.password = ''
    opener?.focus()
  }
  function message(reason) {
    const data = reason?.response?.data
    if (typeof reason === 'string') return reason
    if (Array.isArray(data?.detail)) {
      for (const issue of data.detail) {
        const field = issue.loc?.at(-1)
        if (field in form) errors.value[field] = issue.msg.replace(/^Value error, /, '')
      }
      return '请检查填写的信息。'
    }
    return (
      data?.message ||
      (typeof data?.detail === 'string' ? data.detail : '') ||
      '操作失败，请稍后重试。'
    )
  }
  async function submit() {
    if (busy.value) return
    error.value = ''
    errors.value = {}
    if (mode.value !== 'delete') {
      if (!form.username.trim()) errors.value.username = '请输入系统账号'
      if (!form.name.trim()) errors.value.name = '请输入姓名'
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        errors.value.email = '请输入有效的电子邮箱'
      if (form.phone && !/^\+?[\d\s()-]{6,32}$/.test(form.phone.trim()))
        errors.value.phone = '请输入有效的手机号'
      if (
        mode.value === 'create' &&
        !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)[!-~]{8,20}$/.test(form.password)
      )
        errors.value.password = '请输入 8–20 位密码，包含大写字母、小写字母和数字，不含空格或中文'
      if (Object.keys(errors.value).length) {
        await nextTick()
        dialog.value.querySelector('[aria-invalid="true"]')?.focus()
        return
      }
    }
    busy.value = true
    try {
      if (mode.value === 'delete') {
        if (target.value.status !== 0) throw new Error('账号必须先禁用')
        await deleteUser(target.value.id)
      } else {
        const payload = {
          username: form.username.trim(),
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          role: form.role,
          status: form.status
        }
        if (mode.value === 'create') await createUser({ ...payload, password: form.password })
        else await updateManagedUser(target.value.id, payload)
      }
      const result =
        mode.value === 'delete'
          ? '用户已删除'
          : mode.value === 'create'
            ? '用户已新增'
            : '用户信息已保存'
      busy.value = false
      close()
      emit('saved', result)
    } catch (reason) {
      error.value = message(reason)
    } finally {
      busy.value = false
    }
  }
  onBeforeUnmount(() => document.body.classList.remove('user-dialog-open'))
  defineExpose({ open, confirmDelete })
</script>

<template>
  <div
    ref="dialog"
    class="user-dialog"
    hidden
    :class="{ 'delete-dialog': mode === 'delete' }"
    aria-labelledby="user-dialog-title"
    :aria-describedby="mode === 'delete' ? 'delete-description' : undefined"
    @cancel.prevent="close"
    @click="
      event => {
        if (event.target === dialog) close()
      }
    "
  >
    <section
      class="dialog-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-dialog-title"
      :aria-describedby="mode === 'delete' ? 'delete-description' : undefined"
    >
      <form @submit.prevent="submit" :aria-busy="busy">
        <header class="dialog-heading">
          <div class="heading-icon" :class="{ destructive: mode === 'delete' }">
            <component
              :is="mode === 'delete' ? Trash2 : mode === 'create' ? UserPlus : Pencil"
              :size="21"
            />
          </div>
          <div>
            <h2 id="user-dialog-title">
              {{ mode === 'delete' ? '删除用户' : mode === 'create' ? '新增用户' : '编辑用户' }}
            </h2>
            <p v-if="mode !== 'delete'">
              {{ mode === 'create' ? '创建账号并设置登录权限' : '更新用户资料与账号权限' }}
            </p>
          </div>
          <button
            type="button"
            class="close-button"
            aria-label="关闭弹窗"
            :disabled="busy"
            @click="close"
          >
            <X :size="20" />
          </button>
        </header>
        <template v-if="mode === 'delete'">
          <p id="delete-description" class="delete-description">
            确定删除
            <strong>{{ target.name || target.username }}</strong>
            （{{ target.username }}）吗？
            <br />
            删除后无法恢复，该账号将从系统中移除。
          </p>
        </template>
        <div v-else class="fields">
          <label
            v-for="field in [
              { key: 'username', label: '系统账号', max: 50 },
              { key: 'name', label: '姓名', max: 100 },
              { key: 'email', label: '电子邮箱', max: 254 },
              { key: 'phone', label: '手机号', max: 32 }
            ]"
            :key="field.key"
            :for="`managed-${field.key}`"
          >
            <span>
              {{ field.label }}
              <small>{{ ['email', 'phone'].includes(field.key) ? '选填' : '*' }}</small>
            </span>
            <input
              :id="`managed-${field.key}`"
              v-model="form[field.key]"
              :maxlength="field.max"
              :type="field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'"
              :required="['username', 'name'].includes(field.key)"
              :disabled="busy"
              autocomplete="off"
              :aria-invalid="!!errors[field.key]"
              :aria-describedby="errors[field.key] ? `error-${field.key}` : undefined"
            />
            <span v-if="errors[field.key]" :id="`error-${field.key}`" class="field-error">
              {{ errors[field.key] }}
            </span>
          </label>
          <label v-if="mode === 'create'" class="full-field" for="managed-password">
            <span>
              初始密码
              <small>*</small>
            </span>
            <div class="password-field">
              <input
                id="managed-password"
                v-model="form.password"
                :type="visiblePassword ? 'text' : 'password'"
                autocomplete="new-password"
                required
                maxlength="20"
                :disabled="busy"
                :aria-invalid="!!errors.password"
                aria-describedby="password-help"
              />
              <button
                type="button"
                :aria-label="visiblePassword ? '隐藏密码' : '显示密码'"
                @click="visiblePassword = !visiblePassword"
              >
                <component :is="visiblePassword ? EyeOff : Eye" :size="18" />
              </button>
            </div>
            <span id="password-help" :class="errors.password ? 'field-error' : 'field-hint'">
              {{ errors.password || '8–20 位，包含大写字母、小写字母和数字' }}
            </span>
          </label>
          <fieldset>
            <legend>用户角色</legend>
            <div class="choices">
              <label
                v-for="option in [
                  { value: 'student', text: '学生' },
                  { value: 'admin', text: '管理员' }
                ]"
                :key="option.value"
              >
                <input
                  v-model="form.role"
                  type="radio"
                  name="managed-role"
                  :value="option.value"
                  :disabled="busy"
                />
                <span>{{ option.text }}</span>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>账号状态</legend>
            <div class="choices">
              <label
                v-for="option in [
                  { value: 1, text: '正常' },
                  { value: 0, text: '禁用' }
                ]"
                :key="option.value"
              >
                <input
                  v-model="form.status"
                  type="radio"
                  name="managed-status"
                  :value="option.value"
                  :disabled="busy"
                />
                <span>{{ option.text }}</span>
              </label>
            </div>
          </fieldset>
        </div>
        <p v-if="error" class="submit-error" role="alert">{{ error }}</p>
        <footer>
          <button type="button" class="cancel" :disabled="busy" @click="close">取消</button>
          <button
            type="submit"
            class="submit"
            :class="{ destructive: mode === 'delete' }"
            :disabled="busy"
          >
            {{
              busy
                ? '正在提交…'
                : mode === 'delete'
                  ? '确认删除'
                  : mode === 'create'
                    ? '新增用户'
                    : '保存修改'
            }}
          </button>
        </footer>
      </form>
    </section>
  </div>
</template>

<style scoped>
  .user-dialog {
    --dialog-accent: #514def;
    --dialog-bg: #fff;
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgb(0 0 0 / 48%);
    backdrop-filter: blur(4px);
  }
  .user-dialog[hidden] {
    display: none;
  }
  :global(body.user-dialog-open) {
    overflow: hidden;
  }
  .dialog-surface {
    position: relative;
    --dialog-ink: #20232b;
    --dialog-muted: #6b7280;
    --dialog-line: #e5e7eb;
    color: var(--dialog-ink);
    background: var(--dialog-bg);
    border: 1px solid var(--dialog-line);
    border-radius: 20px;
    padding: 28px;
    margin: auto;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100dvh - 40px);
    overflow: auto;
    box-shadow: 0 24px 100px #0003;
  }
  :global(html.dark .dialog-surface) {
    --dialog-accent: #514def;
    --dialog-bg: #19191b;
    --dialog-ink: #f2f3f5;
    --dialog-muted: #aeb1bc;
    --dialog-line: #36373d;
  }
  :global(html.dark .dialog-surface input:not([type='radio'])) {
    background: #0f0f10;
  }
  .dialog-heading {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 28px;
    padding-right: 28px;
  }
  .heading-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #514def15;
    color: #514def;
    flex-shrink: 0;
  }
  h2 {
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  .dialog-heading p {
    font-size: 13px;
    color: var(--dialog-muted);
    margin-top: 4px;
  }
  button {
    cursor: pointer;
    min-height: 44px;
    border-radius: 9px;
    padding: 0 16px;
    transition:
      background 0.18s,
      transform 0.18s;
    font: inherit;
  }
  button:hover:not(:disabled) {
    transform: translateY(-1px);
  }
  button:active:not(:disabled) {
    transform: scale(0.98);
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .close-button {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 0;
    width: 36px;
    min-width: 36px;
    height: 36px;
    min-height: 36px;
    border-radius: 50%;
    transition:
      background 0.18s,
      box-shadow 0.18s,
      color 0.18s;
    display: grid;
    place-items: center;
    color: var(--dialog-muted);
  }
  .close-button:hover:not(:disabled) {
    background: var(--dialog-bg);
    color: var(--dialog-ink);
    box-shadow:
      0 2px 12px rgb(32 24 60 / 16%),
      0 0 0 1px var(--dialog-line);
    transform: none;
  }
  .fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px 18px;
  }
  .fields > label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    min-width: 0;
  }
  small {
    color: var(--dialog-muted);
    font-weight: 400;
    margin-left: 4px;
  }
  .full-field {
    grid-column: 1/-1;
  }
  input:not([type='radio']) {
    width: 100%;
    min-width: 0;
    height: 44px;
    border: 1px solid var(--dialog-line);
    border-radius: 9px;
    padding: 0 12px;
    background: transparent;
    color: var(--dialog-ink);
    font: inherit;
  }
  input[aria-invalid='true'] {
    border-color: #e15263;
  }
  input:not([type='radio']):focus {
    outline: none;
    border-color: var(--dialog-accent);
    box-shadow: none;
  }
  button:focus-visible,
  input[type='radio']:focus-visible {
    outline: 2px solid var(--dialog-accent);
    outline-offset: 2px;
  }
  input:not([type='radio']):focus-visible {
    outline: none;
  }
  .password-field {
    position: relative;
  }
  .password-field input {
    padding-right: 48px;
  }
  .password-field button {
    position: absolute;
    right: 0;
    top: 0;
    padding: 0;
    width: 44px;
    display: grid;
    place-items: center;
    color: var(--dialog-muted);
  }
  .field-hint,
  .field-error {
    font-size: 12px;
    font-weight: 400;
    line-height: 1.6;
  }
  .field-hint {
    color: var(--dialog-muted);
  }
  .field-error,
  .submit-error {
    color: #e15263;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  legend {
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 9px;
  }
  .choices {
    display: flex;
    gap: 8px;
  }
  .choices label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    flex: 1;
    min-height: 44px;
    border: 1px solid var(--dialog-line);
    border-radius: 9px;
    font-size: 13px;
    cursor: pointer;
  }
  .choices label:has(:checked) {
    border-color: var(--dialog-accent);
    background: #514def10;
  }
  input[type='radio'] {
    accent-color: var(--dialog-accent);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid var(--dialog-line);
  }
  .cancel {
    border: 1px solid var(--dialog-line);
  }
  .submit {
    background: #514def;
    color: white;
    font-weight: 600;
  }
  .submit:hover {
    background: #6555d5;
  }
  .heading-icon.destructive {
    color: #e15263;
    background: #e1526315;
  }
  .submit.destructive {
    background: #c83244;
  }
  .submit.destructive:hover {
    background: #ac2333;
  }
  .submit-error {
    font-size: 13px;
    margin-top: 18px;
  }
  .delete-description {
    line-height: 1.9;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .delete-dialog .dialog-surface {
    width: min(460px, calc(100vw - 32px));
  }
  @media (max-width: 480px) {
    .dialog-surface {
      padding: 22px 18px;
    }
    .fields {
      grid-template-columns: 1fr;
      gap: 18px;
    }
    footer button {
      flex: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
