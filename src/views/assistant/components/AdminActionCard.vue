<script setup>
  import { computed, reactive, ref } from 'vue'
  import {
    CircleCheck,
    GraduationCap,
    ShieldAlert,
    ShieldCheck,
    Trash2,
    UserRoundCog
  } from 'lucide-vue-next'
  import { createUser, updateManagedUser, deleteUser, updateUser } from '@/api/user'

  const props = defineProps({ content: { type: String, required: true } })
  const emit = defineEmits(['completed'])
  const action = computed(() => {
    try {
      const value = JSON.parse(props.content)
      return value?.type?.startsWith('admin_user_') || value?.type === 'user_profile_edit'
        ? value
        : null
    } catch {
      return null
    }
  })
  const data = computed(() => action.value?.data || {})
  const selected = ref(null)
  const cancelled = ref(false)
  const isDelete = computed(() => selectedAction.value?.type === 'admin_user_delete')
  const isOwnProfile = computed(() => selectedAction.value?.type === 'user_profile_edit')
  const selectedAction = computed(() =>
    selected.value ? { type: action.value.action, data: selected.value } : action.value
  )
  const deletionBlocked = computed(() => isDelete.value && selectedAction.value.data?.status !== 0)
  const introduction = computed(() => {
    const target = selectedAction.value
    if (!target) return ''
    const name = target.data?.name || target.data?.username || '该用户'
    if (deletionBlocked.value) {
      return target.data?.status === 1
        ? `用户“${name}”当前处于正常状态，只有禁用状态的用户才允许删除。请先在用户管理中禁用该账号，再发起删除。`
        : `暂时无法确认用户“${name}”的禁用状态，请刷新用户信息后重试。`
    }
    if (isDelete.value)
      return `已找到已禁用的用户“${name}”。请核对下方账号信息，确认后再删除，删除操作无法恢复。`
    if (target.type === 'admin_user_create')
      return '请填写并核对下方用户信息，确认保存后才会创建账号。'
    if (target.type === 'user_profile_edit')
      return '请修改并核对下方个人资料，确认后保存到当前登录账号。'
    if (target.type === 'admin_user_edit')
      return `已找到用户“${name}”，请修改并核对下方信息后保存。`
    return ''
  })
  const form = reactive({
    username: '',
    name: '',
    email: '',
    phone: '',
    role: 'student',
    status: 1,
    password: ''
  })
  const initialized = ref(false)
  const busy = ref(false)
  const error = ref('')
  function sync() {
    if (initialized.value || !action.value) return
    Object.assign(form, data.value)
    initialized.value = true
  }
  sync()
  async function submit() {
    if (
      !selectedAction.value ||
      busy.value ||
      deletionBlocked.value ||
      (action.value.type === 'admin_user_select' && !selected.value)
    )
      return
    busy.value = true
    error.value = ''
    try {
      if (selectedAction.value.type === 'admin_user_delete')
        await deleteUser(selectedAction.value.data.id)
      else {
        const payload = {
          username: form.username,
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          role: form.role,
          status: form.status
        }
        if (selectedAction.value.type === 'admin_user_create')
          await createUser({ ...payload, password: form.password })
        else if (isOwnProfile.value)
          await updateUser({
            username: form.username,
            name: form.name,
            email: form.email || null,
            phone: form.phone || null
          })
        else await updateManagedUser(selectedAction.value.data.id, payload)
      }
      emit('completed', selectedAction.value.type)
    } catch (reason) {
      error.value = reason?.response?.data?.message || reason?.message || '操作失败，请稍后重试'
    } finally {
      busy.value = false
    }
  }
  function cancelEdit() {
    Object.assign(form, selectedAction.value.data)
    cancelled.value = true
    error.value = ''
  }
  function choose(user) {
    selected.value = user
    Object.assign(form, user)
  }
</script>

<template>
  <div v-if="action" class="admin-action-response">
    <p v-if="introduction" class="action-introduction">{{ introduction }}</p>
    <section v-if="!deletionBlocked" class="admin-action-card" @vue:mounted="sync">
      <header>
        <strong class="card-title">
          <span v-if="isDelete" class="delete-icon"><Trash2 :size="17" aria-hidden="true" /></span>
          <span v-if="!isDelete" class="edit-icon">
            <UserRoundCog :size="18" aria-hidden="true" />
          </span>
          {{
            action.type === 'admin_user_select' && !selected
              ? '选择用户'
              : action.type === 'admin_user_not_found'
                ? '未找到用户'
                : selectedAction.type === 'user_profile_edit'
                  ? '编辑个人资料'
                  : selectedAction.type === 'admin_user_create'
                    ? '新增用户'
                    : selectedAction.type === 'admin_user_edit'
                      ? '编辑用户'
                      : '删除用户确认'
          }}
          <code v-if="selectedAction.type === 'admin_user_edit'" class="identity">
            {{ selectedAction.data.name }} · {{ selectedAction.data.username }}
          </code>
        </strong>
        <span v-if="isDelete" class="risk-badge">
          <ShieldAlert :size="14" aria-hidden="true" />
          高危权限操作
        </span>
        <span v-else class="risk-badge">
          <ShieldCheck :size="14" aria-hidden="true" />
          {{ isOwnProfile ? '仅修改当前账号' : '管理员确认后执行' }}
        </span>
      </header>
      <template v-if="action.type === 'admin_user_not_found'">
        <p v-if="!introduction">没有找到匹配的用户，请检查姓名或系统账号。</p>
      </template>
      <template v-else-if="action.type === 'admin_user_select' && !selected">
        <p>
          “{{ action.query }}”匹配到多个用户，请选择要{{
            action.action === 'admin_user_delete' ? '删除' : '编辑'
          }}的账号。
        </p>
        <div class="candidates">
          <button v-for="user in action.items" :key="user.id" type="button" @click="choose(user)">
            <strong>{{ user.name }}</strong>
            <span>账号：{{ user.username }}</span>
            <span>
              {{ user.role === 'admin' ? '管理员' : '学生' }} ·
              {{ user.status === 1 ? '正常' : '已禁用' }}
            </span>
          </button>
        </div>
      </template>
      <template v-else-if="selectedAction.type === 'admin_user_delete'">
        <p class="delete-description">
          确定删除用户
          <b>{{ selectedAction.data.name || selectedAction.data.username }}</b>
          <code>{{ selectedAction.data.username }}</code>
          吗？删除后数据将无法恢复。
        </p>
        <p v-if="cancelled" class="cancelled" role="status">已取消删除。</p>
      </template>
      <form
        v-else-if="
          selectedAction.type === 'admin_user_create' ||
          selectedAction.type === 'admin_user_edit' ||
          selectedAction.type === 'user_profile_edit'
        "
        @submit.prevent="submit"
      >
        <label class="field">
          <span>账号名</span>
          <input
            v-model="form.username"
            placeholder="请输入系统账号"
            required
            :disabled="busy || cancelled"
          />
        </label>
        <label class="field">
          <span>姓名</span>
          <input
            v-model="form.name"
            placeholder="请输入姓名"
            required
            :disabled="busy || cancelled"
          />
        </label>
        <label class="field">
          <span>电子邮箱</span>
          <input
            v-model="form.email"
            type="email"
            placeholder="请输入电子邮箱"
            :disabled="busy || cancelled"
          />
        </label>
        <label class="field">
          <span>手机号</span>
          <input
            v-model="form.phone"
            type="tel"
            placeholder="请输入手机号"
            :disabled="busy || cancelled"
          />
        </label>
        <label v-if="selectedAction.type === 'admin_user_create'" class="field">
          <span>初始密码</span>
          <input
            v-model="form.password"
            type="password"
            placeholder="请输入初始密码"
            required
            :disabled="busy || cancelled"
          />
        </label>
        <fieldset v-if="!isOwnProfile" class="role-field" :disabled="busy || cancelled">
          <legend>角色选择</legend>
          <div class="role-options">
            <label>
              <input v-model="form.role" type="radio" value="student" />
              <span>
                <GraduationCap :size="17" />
                学生
              </span>
            </label>
            <label>
              <input v-model="form.role" type="radio" value="admin" />
              <span>
                <ShieldCheck :size="17" />
                管理员
              </span>
            </label>
          </div>
        </fieldset>
        <p v-if="cancelled" class="edit-cancelled" role="status">已取消修改。</p>
        <footer v-else class="edit-actions">
          <button type="button" class="cancel-button" :disabled="busy" @click="cancelEdit">
            取消
          </button>
          <button type="submit" class="save-button" :disabled="busy">
            <CircleCheck :size="16" />
            {{ busy ? '处理中…' : '确定保存' }}
          </button>
        </footer>
      </form>
      <footer v-if="isDelete && !cancelled" class="delete-actions">
        <button type="button" class="cancel-button" :disabled="busy" @click="cancelled = true">
          暂不删除
        </button>
        <button type="button" class="danger" :disabled="busy" @click="submit">
          <Trash2 :size="16" aria-hidden="true" />
          {{ busy ? '删除中…' : '确定删除' }}
        </button>
      </footer>
      <p v-if="error" class="error">{{ error }}</p>
    </section>
  </div>
</template>

<style scoped>
  .action-introduction {
    margin: 0 0 22px;
    color: var(--chat-text, inherit);
    font-size: 15px;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }

  .admin-action-card {
    position: relative;
    margin-top: 14px;
    --card-surface: #fff;
    --card-line: #e9e9ef;
    --card-soft: #f5f5f8;
    --card-text: #292a34;
    --card-muted: #747784;
    --card-danger: #bd181c;
    --card-danger-soft: #fff1f2;
    width: min(100%, 680px);
    padding: clamp(18px, 3vw, 25px);
    border: 2px solid var(--user-bubble-bg, #7b74f3);
    border-radius: 24px;
    background: var(--card-surface);
    color: var(--card-text);
    box-shadow:
      0 14px 30px #17132310,
      0 2px 4px #17132308;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-bottom: 17px;
    margin-bottom: 21px;
    border-bottom: 1px solid var(--card-line);
  }
  header span {
    color: var(--card-muted);
    font-size: 12px;
  }
  form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  input,
  select,
  button {
    min-height: 38px;
    padding: 8px 10px;
    border: 1px solid var(--card-line);
    border-radius: 9px;
    background: var(--card-surface);
    color: inherit;
  }
  .field {
    display: grid;
    gap: 7px;
    min-width: 0;
    font-size: 13px;
    font-weight: 550;
  }
  .field input {
    width: 100%;
    min-width: 0;
    height: 42px;
    font-size: 13px;
    font-weight: 400;
  }
  .field input::placeholder {
    color: var(--card-muted);
  }
  .field input:focus {
    outline: 2px solid color-mix(in srgb, var(--accent, #7b74f3) 35%, transparent);
    outline-offset: 1px;
  }
  form {
    gap: 17px 15px;
  }
  .edit-icon {
    display: grid;
    place-items: center;
    width: 31px;
    height: 31px;
    flex: none;
    background: color-mix(in srgb, var(--accent, #7b74f3) 9%, var(--card-surface));
    color: var(--accent, #7b74f3);
    border-radius: 9px;
  }
  .identity {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 400;
  }
  .role-field {
    grid-column: 1 / -1;
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .role-field legend {
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 550;
  }
  .role-options {
    display: inline-flex;
    padding: 4px;
    gap: 3px;
    border: 1px solid var(--card-line);
    border-radius: 12px;
    background: var(--card-soft);
  }
  .role-options label {
    position: relative;
    cursor: pointer;
  }
  .role-options input {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    padding: 0;
    min-height: 0;
  }
  .role-options span {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 7px 14px;
    border-radius: 9px;
    font-size: 13px;
    color: var(--card-muted);
    transition:
      background-color 0.18s,
      color 0.18s;
  }
  .role-options input:checked + span {
    background: var(--card-surface);
    color: var(--accent, #7b74f3);
    box-shadow: 0 2px 5px #0000000b;
  }
  .role-options input:focus-visible + span {
    outline: 2px solid var(--accent, #7b74f3);
  }
  .role-options:has(input:disabled) {
    opacity: 0.6;
  }
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
    grid-column: 1 / -1;
    padding-top: 17px;
    margin-top: 2px;
    border-top: 1px solid var(--card-line);
  }
  .edit-actions button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 8px 17px;
    border-radius: 11px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 0.18s,
      transform 0.18s;
  }
  .edit-actions .save-button {
    background: #7b74f3;
    color: #fff;
    border-color: transparent;
    box-shadow: 0 4px 10px #7b74f326;
  }
  .edit-actions button:hover:not(:disabled) {
    filter: brightness(0.95);
  }
  .edit-actions button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .edit-cancelled {
    grid-column: 1 / -1;
    color: var(--card-muted);
    font-size: 13px;
  }
  .danger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    background: var(--card-danger);
    color: white;
    cursor: pointer;
  }
  .error {
    color: var(--card-danger);
  }
  :global(.dark .admin-action-card) {
    --card-surface: #202023;
    --card-line: #35353c;
    --card-soft: #2b2b31;
    --card-text: #f0f0f4;
    --card-muted: #b0b0bd;
    --card-danger: #e14850;
    --card-danger-soft: #e1485015;
    box-shadow: 0 14px 30px #0003;
  }
  .card-title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 15px;
  }
  .delete-icon {
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    border-radius: 9px;
    color: var(--card-danger);
    background: var(--card-danger-soft);
    border: 1px solid color-mix(in srgb, var(--card-danger) 14%, transparent);
  }
  header .risk-badge {
    position: absolute;
    top: 0;
    right: 22px;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 13px;
    border-radius: 999px;
    color: #fff;
    background: var(--user-bubble-bg, #7b74f3);
    border: 1px solid var(--user-bubble-bg, #7b74f3);
    box-shadow: 0 3px 8px #29204b18;
    white-space: nowrap;
    font-size: 11px;
  }
  .delete-description {
    margin: 0;
    line-height: 1.9;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  code {
    display: inline;
    margin-inline: 3px;
    padding: 2px 6px;
    border: 1px solid var(--card-line);
    border-radius: 5px;
    background: var(--card-soft);
    color: var(--card-muted);
    font-size: 12px;
  }
  .delete-actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 30px;
  }
  .delete-actions button {
    padding: 10px 20px;
    border-radius: 13px;
    font-size: 13px;
    font-weight: 600;
    transition:
      background-color 0.18s ease,
      transform 0.18s ease;
    cursor: pointer;
  }
  .cancel-button {
    background: var(--card-soft);
    color: var(--card-text);
  }
  .delete-actions .danger {
    border-color: transparent;
  }
  .delete-actions button:hover:not(:disabled) {
    filter: brightness(0.95);
  }
  .delete-actions button:active:not(:disabled) {
    transform: scale(0.97);
  }
  button:disabled {
    cursor: wait;
    opacity: 0.6;
  }
  button:focus-visible {
    outline: 2px solid var(--accent, #7b74f3);
    outline-offset: 3px;
  }
  .cancelled {
    color: var(--card-muted);
    font-size: 13px;
    margin: 20px 0 0;
  }
  @media (max-width: 480px) {
    form {
      grid-template-columns: minmax(0, 1fr);
    }
    .identity {
      display: none;
    }
    header {
      align-items: flex-start;
      flex-wrap: wrap;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .delete-actions button {
      transition: none;
    }
  }
  .candidates {
    display: grid;
    gap: 8px;
  }
  .candidates button {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 12px;
    text-align: left;
    cursor: pointer;
  }
  .candidates strong {
    grid-column: 1 / -1;
  }
</style>
