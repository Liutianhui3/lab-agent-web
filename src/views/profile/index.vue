<script setup>
  import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
  import { Camera, Check, LockKeyhole, RotateCcw, LoaderCircle, UserRound } from 'lucide-vue-next'
  import gsap from 'gsap'
  import SnowfallBackground from '@/components/SnowfallBackground.vue'
  import { getUserInfo, updateUser } from '@/api/user'
  import { uploadAvatar } from '@/api/file'
  import { useUserInfo } from '@/composables/useUserInfo'
  import { USER_ROLES } from '@/utils/constant'
  import { avatarUrl } from '@/utils/avatar'

  const { userInfo, updateUserInfo } = useUserInfo()
  const root = ref(null)
  const fileInput = ref(null)
  const form = reactive({ name: '', username: '', email: '', phone: '', avatar: null })
  const errors = ref({})
  const loading = ref(true)
  const loadFailed = ref(false)
  const saving = ref(false)
  const uploading = ref(false)
  const notice = ref('')
  const success = ref(false)
  const preview = ref('')
  const brokenImage = ref('')
  const role = computed(
    () => USER_ROLES.find(item => item.value === userInfo.value.role)?.label || '用户'
  )
  const image = computed(() => preview.value || avatarUrl(form.avatar))
  const busy = computed(() => loading.value || saving.value || uploading.value)
  const dirty = computed(() =>
    Object.keys(form).some(key => (form[key] || '') !== (userInfo.value[key] || ''))
  )
  let motionMedia
  let active = true
  let loadVersion = 0

  function clearFieldFeedback(field) {
    errors.value[field] = ''
    notice.value = ''
  }

  function clearPreview() {
    if (preview.value) URL.revokeObjectURL(preview.value)
    preview.value = ''
  }
  function reset() {
    clearPreview()
    for (const key of Object.keys(form))
      form[key] = userInfo.value[key] || (key === 'avatar' ? null : '')
    errors.value = {}
    notice.value = ''
    success.value = false
    brokenImage.value = ''
  }
  function message(error, fallback) {
    return (typeof error === 'string' ? error : error?.response?.data?.message) || fallback
  }
  async function load() {
    const version = ++loadVersion
    loading.value = true
    loadFailed.value = false
    notice.value = ''
    try {
      const response = await getUserInfo()
      if (!active || version !== loadVersion) return
      updateUserInfo(response.data)
      reset()
    } catch (error) {
      if (!active || version !== loadVersion) return
      loadFailed.value = true
      notice.value = message(error, '资料加载失败，请重试。')
    } finally {
      if (active && version === loadVersion) loading.value = false
    }
  }
  async function selectAvatar(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy.value) return
    errors.value.avatar = ''
    notice.value = ''
    success.value = false
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      errors.value.avatar = '请选择 JPG 或 PNG 图片。'
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      errors.value.avatar = '图片不能超过 5MB。'
      return
    }
    uploading.value = true
    try {
      // Decode before uploading so a renamed or corrupt file never becomes a preview.
      const bitmap = await createImageBitmap(file)
      bitmap.close()
      const response = await uploadAvatar(file)
      if (!active) return
      if (!response.data?.url) throw new Error('missing upload URL')
      clearPreview()
      preview.value = URL.createObjectURL(file)
      form.avatar = response.data.url
      brokenImage.value = ''
    } catch (error) {
      if (active) errors.value.avatar = message(error, '头像上传失败，请选择有效图片后重试。')
    } finally {
      if (active) uploading.value = false
    }
  }
  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = '请输入姓名。'
    else if (form.name.trim().length > 100) next.name = '姓名不能超过 100 个字符。'
    if (!form.username.trim()) next.username = '请输入用户名。'
    else if (form.username.trim().length > 50) next.username = '用户名不能超过 50 个字符。'
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = '请输入有效的电子邮箱。'
    if (form.phone.trim() && !/^\+?[\d\s()-]{6,32}$/.test(form.phone.trim()))
      next.phone = '请输入有效的手机号。'
    errors.value = next
    return Object.keys(next).length === 0
  }
  async function save() {
    if (busy.value || loadFailed.value) return
    notice.value = ''
    success.value = false
    if (!validate()) {
      requestAnimationFrame(() => root.value?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    saving.value = true
    try {
      const response = await updateUser({
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        avatar: form.avatar || null
      })
      if (!active) return
      if (!response.data?.id) throw new Error('missing user response')
      updateUserInfo(response.data)
      reset()
      success.value = true
      notice.value = '个人资料已保存。'
    } catch (error) {
      if (active) notice.value = message(error, '保存失败，请稍后重试。')
    } finally {
      if (active) saving.value = false
    }
  }
  reset()
  onMounted(() => {
    load()
    motionMedia = gsap.matchMedia()
    motionMedia.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        root.value.querySelector('.profile-card'),
        { y: 8 },
        { y: 0, duration: 0.4, ease: 'power3.out' }
      )
    })
  })
  onBeforeUnmount(() => {
    active = false
    motionMedia?.revert()
    clearPreview()
  })
</script>

<template>
  <section ref="root" class="profile-page" aria-labelledby="profile-title">
    <SnowfallBackground />
    <div class="profile-wrap">
      <div class="profile-heading">
        <h1 id="profile-title">个人资料设置</h1>
      </div>
      <form class="profile-card" novalidate :aria-busy="busy" @submit.prevent="save">
        <div class="avatar-section">
          <button
            type="button"
            class="avatar-button"
            aria-label="上传头像"
            :disabled="busy || loadFailed"
            @click="fileInput.click()"
          >
            <span class="profile-avatar">
              <img
                v-if="image && brokenImage !== image"
                :src="image"
                alt="当前头像"
                @error="brokenImage = image"
              />
              <UserRound v-else :size="56" aria-hidden="true" />
            </span>
            <span class="camera-badge">
              <LoaderCircle v-if="uploading" :size="19" class="animate-spin" />
              <Camera v-else :size="19" />
            </span>
          </button>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            tabindex="-1"
            aria-label="选择头像文件"
            @change="selectAvatar"
          />
          <p class="avatar-help">
            {{ uploading ? '正在上传头像…' : '支持 JPG / PNG，大小不超过 5MB' }}
          </p>
          <p v-if="errors.avatar" role="alert" class="field-error">{{ errors.avatar }}</p>
          <p v-else-if="preview" class="avatar-help">头像已上传，保存修改后生效</p>
        </div>
        <div v-if="loadFailed" class="load-error" role="alert">
          <span>{{ notice }}</span>
          <button type="button" @click="load">重新加载</button>
        </div>
        <fieldset :disabled="busy || loadFailed" :class="{ 'fields-loading': loading }">
          <div class="form-grid">
            <div class="field field-wide">
              <label for="profile-name">
                姓名
                <span class="required" aria-hidden="true">*</span>
              </label>
              <input
                id="profile-name"
                v-model="form.name"
                name="name"
                autocomplete="name"
                required
                maxlength="100"
                placeholder="请输入姓名"
                :aria-invalid="!!errors.name"
                :aria-describedby="errors.name ? 'name-error' : undefined"
                @input="clearFieldFeedback('name')"
              />
              <p v-if="errors.name" id="name-error" role="alert" class="field-error">
                {{ errors.name }}
              </p>
            </div>
            <div class="field">
              <label for="profile-email">
                电子邮箱
                <span class="optional">选填</span>
              </label>
              <input
                id="profile-email"
                v-model="form.email"
                name="email"
                type="email"
                autocomplete="email"
                maxlength="254"
                placeholder="请输入电子邮箱"
                :aria-invalid="!!errors.email"
                :aria-describedby="errors.email ? 'email-error' : undefined"
                @input="clearFieldFeedback('email')"
              />
              <p v-if="errors.email" id="email-error" role="alert" class="field-error">
                {{ errors.email }}
              </p>
            </div>
            <div class="field">
              <label for="profile-phone">
                手机号
                <span class="optional">选填</span>
              </label>
              <input
                id="profile-phone"
                v-model="form.phone"
                name="tel"
                type="tel"
                autocomplete="tel"
                maxlength="32"
                placeholder="请输入手机号"
                :aria-invalid="!!errors.phone"
                :aria-describedby="errors.phone ? 'phone-error' : undefined"
                @input="clearFieldFeedback('phone')"
              />
              <p v-if="errors.phone" id="phone-error" role="alert" class="field-error">
                {{ errors.phone }}
              </p>
            </div>
            <div class="field">
              <label for="profile-username">
                用户名
                <span class="required" aria-hidden="true">*</span>
              </label>
              <input
                id="profile-username"
                v-model="form.username"
                name="username"
                autocomplete="username"
                required
                maxlength="50"
                placeholder="请输入用户名"
                :aria-invalid="!!errors.username"
                :aria-describedby="errors.username ? 'username-error' : undefined"
                @input="clearFieldFeedback('username')"
              />
              <p v-if="errors.username" id="username-error" role="alert" class="field-error">
                {{ errors.username }}
              </p>
            </div>
            <div class="field">
              <label for="profile-role">
                用户角色
                <span class="optional">
                  <LockKeyhole :size="12" />
                  不可修改
                </span>
              </label>
              <div class="locked-field">
                <input id="profile-role" :value="role" readonly />
                <LockKeyhole :size="17" aria-hidden="true" />
              </div>
            </div>
          </div>
        </fieldset>
        <div class="form-footer">
          <p v-if="loading" class="form-status" role="status">正在读取个人资料…</p>
          <p
            v-else-if="notice && !loadFailed"
            class="form-status"
            :class="success ? 'is-success' : 'is-error'"
            :role="success ? 'status' : 'alert'"
          >
            {{ notice }}
          </p>
          <span v-else class="form-status" />
          <div class="form-actions">
            <button
              type="button"
              class="profile-btn secondary"
              :disabled="busy || !dirty"
              @click="reset"
            >
              <RotateCcw :size="17" />
              重置
            </button>
            <button
              type="submit"
              class="profile-btn primary"
              :disabled="busy || loadFailed || !dirty"
            >
              <LoaderCircle v-if="saving" :size="18" class="animate-spin" />
              <Check v-else :size="18" />
              {{ saving ? '保存中…' : '保存修改' }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
  .profile-page {
    --profile-surface: #fff;
    --profile-input: #f5f4f9;
    --profile-ink: #25232d;
    --profile-muted: #726d82;
    --profile-line: #eeecf4;
    --profile-accent: #514def;
    position: relative;
    isolation: isolate;
    background: #f7f9fc;
    min-height: 100%;
    padding: 36px 40px 48px;
    color: var(--profile-ink);
  }
  :global(.dark .profile-page) {
    background: #000;
    --profile-surface: #19191b;
    --profile-input: #0f0f10;
    --profile-ink: #f2f0f8;
    --profile-muted: #b6b1c6;
    --profile-line: #35343f;
    --profile-accent: #514def;
  }
  .profile-wrap {
    position: relative;
    max-width: 1240px;
    margin: auto;
  }
  .profile-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--profile-line);
    padding-bottom: 18px;
    margin-bottom: 30px;
  }
  h1 {
    font-size: 26px;
    line-height: 1.4;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  .profile-card {
    width: 100%;
    max-width: 800px;
    margin: auto;
    padding: 32px 38px 28px;
    border: 1px solid var(--profile-line);
    border-radius: 20px;
    background: var(--profile-surface);
    box-shadow: 0 6px 32px rgb(50 35 90 / 3%);
  }
  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 26px;
    margin-bottom: 28px;
    border-bottom: 1px solid var(--profile-line);
  }
  .avatar-button {
    position: relative;
    padding: 0;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .avatar-button:not(:disabled):hover {
    transform: translateY(-2px);
  }
  .profile-avatar {
    display: flex;
    width: 112px;
    height: 112px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #514def;
    color: #fff;
    font-size: 38px;
    font-weight: 600;
    overflow: hidden;
  }
  .profile-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .camera-badge {
    position: absolute;
    bottom: 1px;
    right: 0;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--profile-surface);
    background: var(--profile-surface);
    color: var(--profile-accent);
    box-shadow: 0 2px 8px rgb(30 20 60 / 12%);
  }
  .avatar-help {
    margin-top: 14px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--profile-muted);
    text-align: center;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .fields-loading {
    opacity: 0.5;
  }
  .form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 20px;
  }
  .field-wide {
    grid-column: 1 / -1;
  }
  .field {
    min-width: 0;
  }
  .field label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 14px;
    font-weight: 550;
    margin-bottom: 9px;
  }
  .required {
    color: #cc324a;
    margin-right: auto;
  }
  .optional {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--profile-muted);
    font-size: 11px;
    font-weight: 400;
  }
  .field input {
    width: 100%;
    min-width: 0;
    height: 50px;
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 0 16px;
    background: var(--profile-input);
    color: var(--profile-ink);
    font-size: 15px;
    outline: none;
    caret-color: var(--profile-accent);
    transition: border-color 0.18s;
  }
  .field input::placeholder {
    color: var(--profile-muted);
    font-size: 13px;
  }
  .field input:focus {
    border-color: var(--profile-accent);
  }
  .field input[aria-invalid='true'] {
    border-color: #d14359;
  }
  .field-error {
    margin-top: 7px;
    font-size: 12px;
    line-height: 1.5;
    color: #bc2941;
  }
  :global(.dark .field-error) {
    color: #ff91a2;
  }
  .locked-field {
    position: relative;
  }
  .locked-field input {
    padding-right: 40px;
    color: var(--profile-muted);
    cursor: default;
  }
  .locked-field > svg {
    position: absolute;
    right: 16px;
    top: 16px;
    color: var(--profile-muted);
    pointer-events: none;
  }
  .form-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px;
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid var(--profile-line);
  }
  .form-status {
    flex: 1;
    font-size: 12px;
    line-height: 1.5;
    color: var(--profile-muted);
  }
  .is-success {
    color: #258348;
  }
  .is-error {
    color: #bc2941;
  }
  :global(.dark .is-success) {
    color: #83d39a;
  }
  :global(.dark .is-error) {
    color: #ff91a2;
  }
  .form-actions {
    display: flex;
    gap: 10px;
    margin-left: auto;
  }
  .profile-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 46px;
    border-radius: 12px;
    padding: 0 22px;
    font-size: 14px;
    font-weight: 550;
    cursor: pointer;
    transition:
      transform 0.18s,
      background-color 0.18s;
  }
  .primary {
    background: #514def;
    color: #fff;
  }
  .primary:not(:disabled):hover {
    background: #6555d5;
    transform: translateY(-2px);
  }
  .secondary {
    background: var(--profile-input);
    color: var(--profile-ink);
  }
  .secondary:not(:disabled):hover {
    background: var(--profile-line);
    transform: translateY(-2px);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  button:not(:disabled):active {
    transform: translateY(0) scale(0.98);
  }
  button:focus-visible {
    outline: 2px solid var(--profile-accent);
    outline-offset: 4px;
  }
  .load-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
    font-size: 13px;
    color: #bc2941;
  }
  .load-error button {
    min-height: 44px;
    text-decoration: underline;
    cursor: pointer;
  }
  @media (max-width: 767px) {
    .profile-page {
      padding: 22px 16px 28px;
    }
    .profile-heading {
      margin-bottom: 20px;
      padding-bottom: 12px;
    }
    h1 {
      font-size: 22px;
    }
    .profile-card {
      padding: 24px 20px;
      border-radius: 18px;
    }
    .profile-avatar {
      width: 96px;
      height: 96px;
      font-size: 32px;
    }
    .avatar-section {
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .form-grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
    }
    .field input {
      font-size: 16px;
    }
    .form-footer {
      flex-direction: column;
      align-items: stretch;
    }
    .form-status:empty {
      display: none;
    }
    .form-actions {
      width: 100%;
      margin: 0;
    }
    .profile-btn {
      flex: 1;
      padding: 0 12px;
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
