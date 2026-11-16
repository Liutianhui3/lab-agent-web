<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import {
    UsersRound,
    ShieldCheck,
    UserRoundX,
    Search,
    X,
    Plus,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    SearchX,
    ChevronDown,
    Check
  } from 'lucide-vue-next'
  import UserManagementDialog from './UserManagementDialog.vue'
  import SnowfallBackground from '@/components/SnowfallBackground.vue'
  import { getUserList, updateManagedUser } from '@/api/user'
  import { avatarUrl } from '@/utils/avatar'

  const editor = ref(null)
  const busyUser = ref(null)
  const notice = ref('')
  const actionError = ref('')
  async function changeStatus(user) {
    if (busyUser.value || loading.value) return
    busyUser.value = user.id
    actionError.value = ''
    notice.value = ''
    try {
      await updateManagedUser(user.id, { status: user.status === 0 ? 1 : 0 })
      notice.value = user.status === 0 ? '账号已激活' : '账号已禁用'
      await load()
    } catch (reason) {
      actionError.value =
        typeof reason === 'string'
          ? reason
          : reason?.response?.data?.message || '操作失败，请重试。'
    } finally {
      busyUser.value = null
    }
  }
  function saved(message) {
    notice.value = message
    actionError.value = ''
    load()
  }
  const users = ref([])
  const total = ref(0)
  const page = ref(1)
  const size = ref(10)
  const keyword = ref('')
  const loading = ref(true)
  const error = ref('')
  const loaded = ref(false)
  const role = ref('')
  const roleControl = ref(null)
  const roleIndicator = ref({})
  let roleResizeObserver
  function syncRoleIndicator() {
    const button = roleControl.value?.querySelector('[aria-pressed="true"]')
    if (!button) return
    roleIndicator.value = {
      width: `${button.offsetWidth}px`,
      height: `${button.offsetHeight}px`,
      transform: `translate(${button.offsetLeft}px, ${button.offsetTop}px)`
    }
  }
  const brokenAvatars = ref(new Set())
  const searchInput = ref(null)
  let timer,
    version = 0,
    active = true
  const admins = ref(0)
  const disabled = ref(0)
  const globalTotal = ref(0)
  const sizeOpen = ref(false)
  const sizePicker = ref(null)
  const sizeOptions = [10, 20, 50]
  const rate = computed(() =>
    globalTotal.value ? Math.round((admins.value / globalTotal.value) * 1000) / 10 : 0
  )
  async function chooseSize(value) {
    sizeOpen.value = false
    sizePicker.value?.querySelector('.size-trigger')?.focus()
    if (value === size.value) return
    size.value = value
    search()
  }
  async function openSizes(position = 0) {
    sizeOpen.value = true
    await nextTick()
    const options = sizePicker.value?.querySelectorAll('[role="option"]')
    options?.[position < 0 ? options.length - 1 : position]?.focus()
  }
  function menuKeys(event) {
    const options = [...sizePicker.value.querySelectorAll('[role="option"]')]
    const index = options.indexOf(document.activeElement)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
      options[next]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      sizeOpen.value = false
      sizePicker.value.querySelector('.size-trigger').focus()
    }
  }
  function outsidePicker(event) {
    if (!sizePicker.value?.contains(event.target)) sizeOpen.value = false
  }
  const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
  const pageNumbers = computed(() => {
    const values = [...new Set([1, page.value - 1, page.value, page.value + 1, pages.value])]
      .filter(n => n > 0 && n <= pages.value)
      .sort((a, b) => a - b)
    return values.flatMap((n, i) => (i && n - values[i - 1] > 1 ? ['gap-' + n, n] : [n]))
  })
  const number = value => new Intl.NumberFormat('zh-CN').format(value)
  const initials = user => (user.name || user.username || '?').slice(0, 1).toUpperCase()
  const roleFilters = computed(() => [
    { value: '', label: '全部', count: globalTotal.value },
    { value: 'admin', label: '管理员', count: admins.value },
    { value: 'student', label: '学生', count: Math.max(0, globalTotal.value - admins.value) }
  ])
  watch([role, roleFilters], () => nextTick(syncRoleIndicator), { flush: 'post' })
  function filterRole(value) {
    if (role.value === value) return
    role.value = value
    search()
  }
  async function load() {
    clearTimeout(timer)
    const current = ++version
    loading.value = true
    error.value = ''
    try {
      const response = await getUserList({
        page: page.value,
        size: size.value,
        role: role.value || undefined,
        keyword: keyword.value.trim()
      })
      if (!active || current !== version) return
      const data = response.data
      if (!Array.isArray(data?.items) || !Number.isFinite(data.total))
        throw new Error('invalid response')
      users.value = data.items
      total.value = data.total
      if (
        !Number.isFinite(data.admin_count) ||
        !Number.isFinite(data.disabled_count) ||
        !Number.isFinite(data.global_total)
      )
        throw new Error('invalid statistics')
      admins.value = data.admin_count
      disabled.value = data.disabled_count
      globalTotal.value = data.global_total
      loaded.value = true
      if (page.value > pages.value) {
        page.value = pages.value
        return load()
      }
    } catch (reason) {
      if (active && current === version)
        error.value =
          (typeof reason === 'string' ? reason : reason?.response?.data?.message) ||
          '用户列表加载失败，请稍后重试。'
    } finally {
      if (active && current === version) loading.value = false
    }
  }
  function search() {
    page.value = 1
    load()
  }
  function goTo(value) {
    if (value < 1 || value > pages.value || loading.value) return
    page.value = value
    load()
  }
  watch(keyword, () => {
    // Invalidate in-flight requests immediately so old searches cannot replace new results.
    version++
    loading.value = true
    clearTimeout(timer)
    timer = setTimeout(search, 350)
  })
  function shortcut(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      searchInput.value?.focus()
    }
  }
  onMounted(() => {
    load()
    syncRoleIndicator()
    roleResizeObserver = new ResizeObserver(syncRoleIndicator)
    if (roleControl.value) roleResizeObserver.observe(roleControl.value)
    window.addEventListener('keydown', shortcut)
    document.addEventListener('pointerdown', outsidePicker)
  })
  onBeforeUnmount(() => {
    roleResizeObserver?.disconnect()
    active = false
    version++
    clearTimeout(timer)
    window.removeEventListener('keydown', shortcut)
    document.removeEventListener('pointerdown', outsidePicker)
  })
</script>

<template>
  <section class="users-page" aria-labelledby="users-title">
    <UserManagementDialog ref="editor" @saved="saved" />
    <SnowfallBackground />
    <div class="users-wrap">
      <header class="page-heading">
        <h1 id="users-title">用户管理</h1>
        <button class="create-button" @click="editor.open()">
          <Plus :size="17" />
          新增用户
        </button>
      </header>
      <!-- <p v-if="notice" class="action-notice" role="status">{{ notice }}</p>
      <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p> -->
      <div class="stats-grid" aria-label="用户统计" :aria-busy="loading">
        <article class="stat-card">
          <div>
            <p>所有人数</p>
            <strong>{{ loaded ? number(globalTotal) : '—' }}</strong>
            <span>已加入系统的用户</span>
          </div>
          <div class="stat-icon blue"><UsersRound :size="26" /></div>
        </article>
        <article class="stat-card">
          <div>
            <p>系统管理员人数</p>
            <strong>{{ loaded ? admins : '—' }}</strong>
            <span>拥有系统管理权限</span>
          </div>
          <div class="stat-icon violet"><ShieldCheck :size="26" /></div>
        </article>
        <article class="stat-card">
          <div>
            <p>禁用人数</p>
            <strong>{{ loaded ? disabled : '—' }}</strong>
            <span>当前不可访问系统</span>
          </div>
          <div class="stat-icon amber"><UserRoundX :size="26" /></div>
        </article>
        <article class="stat-card">
          <div>
            <p>管理员率</p>
            <strong>{{ loaded ? rate + '%' : '—' }}</strong>
            <span>管理员占全部用户比例</span>
          </div>
          <svg class="rate-ring" viewBox="0 0 64 64" aria-hidden="true">
            <circle class="ring-track" cx="32" cy="32" r="27" />
            <circle
              class="ring-value"
              cx="32"
              cy="32"
              r="27"
              pathLength="100"
              :stroke-dasharray="`${rate} 100`"
            />
            <text x="32" y="36">{{ loaded ? rate + '%' : '—' }}</text>
          </svg>
        </article>
      </div>
      <div class="list-panel">
        <div class="toolbar">
          <form class="search-box" role="search" autocomplete="off" @submit.prevent="search">
            <Search :size="20" aria-hidden="true" />
            <input
              ref="searchInput"
              v-model="keyword"
              aria-label="搜索账号、姓名、邮箱或手机号"
              placeholder="搜索账号、姓名、邮箱或手机号…"
            />
            <button
              v-if="keyword"
              type="button"
              class="clear-button"
              aria-label="清空搜索"
              @click="keyword = ''"
            >
              <X :size="17" />
            </button>
            <kbd v-else>⌘ / Ctrl K</kbd>
          </form>
          <div class="list-meta">
            <div ref="roleControl" class="role-filters" role="group" aria-label="按用户角色筛选">
              <span class="role-indicator" :style="roleIndicator" aria-hidden="true" />
              <button
                v-for="filter in roleFilters"
                :key="filter.value"
                type="button"
                :aria-pressed="role === filter.value"
                :class="{ active: role === filter.value }"
                @click="filterRole(filter.value)"
              >
                {{ filter.label }}
                <span>({{ loaded ? number(filter.count) : '—' }})</span>
              </button>
            </div>
          </div>
        </div>
        <div class="table-scroll" :aria-busy="loading">
          <table>
            <caption class="sr-only">系统用户列表，可按账号、姓名、邮箱或手机号搜索</caption>
            <thead>
              <tr>
                <th>用户 / 姓名</th>
                <th>系统账号</th>
                <th>电子邮箱</th>
                <th>手机号</th>
                <th>角色 / 权限</th>
                <th>账号状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody v-if="loading && !loaded">
              <tr v-for="row in 6" :key="row" class="skeleton-row">
                <td v-for="col in 7" :key="col"><span class="skeleton" /></td>
              </tr>
            </tbody>
            <tbody v-else-if="!error" :class="{ 'is-loading': loading }">
              <tr
                v-for="(user, index) in users"
                :key="user.id"
                :class="{ 'is-disabled': user.status === 0 }"
                :style="{ '--row-index': Math.min(index, 9) }"
              >
                <td>
                  <div class="user-cell">
                    <span
                      class="user-avatar"
                      :class="user.role === 'admin' ? 'admin-avatar' : `avatar-${index % 3}`"
                    >
                      <img
                        v-if="avatarUrl(user.avatar) && !brokenAvatars.has(user.id)"
                        :src="avatarUrl(user.avatar)"
                        alt=""
                        @error="brokenAvatars.add(user.id)"
                      />
                      <span v-else>{{ initials(user) }}</span>
                    </span>
                    <span class="user-name">{{ user.name || user.username }}</span>
                  </div>
                </td>
                <td>
                  <span class="account">{{ user.username }}</span>
                </td>
                <td>{{ user.email || '—' }}</td>
                <td class="phone">{{ user.phone || '—' }}</td>
                <td>
                  <span class="role-badge" :class="{ admin: user.role === 'admin' }">
                    <i />
                    {{ user.role === 'admin' ? '管理员' : '学生' }}
                  </span>
                </td>
                <td>
                  <span class="status" :class="user.status === 0 ? 'disabled' : 'normal'">
                    <i />
                    {{ user.status === 0 ? '已禁用' : '正常' }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <button :disabled="!!busyUser || loading" @click="editor.open(user)">
                      编辑
                    </button>
                    <button :disabled="!!busyUser || loading" @click="changeStatus(user)">
                      {{ busyUser === user.id ? '处理中…' : user.status === 0 ? '激活' : '禁用' }}
                    </button>
                    <button
                      v-if="user.status === 0"
                      class="danger-action"
                      :disabled="!!busyUser || loading"
                      @click="editor.confirmDelete(user)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="error" class="empty-state" role="alert">
            <CircleAlert :size="34" />
            <h2>暂时无法加载用户</h2>
            <p>{{ error }}</p>
            <button class="retry-button" :disabled="loading" @click="load">重新加载</button>
          </div>
          <div v-else-if="!loading && !users.length" class="empty-state" role="status">
            <SearchX :size="36" />
            <h2>{{ keyword.trim() || role ? '没有找到匹配的用户' : '暂无用户' }}</h2>
            <p>
              {{
                keyword.trim() || role
                  ? '试试其他姓名、账号、邮箱或手机号。'
                  : '用户加入系统后，将显示在这里。'
              }}
            </p>
            <button v-if="keyword" class="retry-button" @click="keyword = ''">清空搜索</button>
          </div>
        </div>
        <footer class="pagination">
          <p role="status">
            {{
              loading
                ? '正在加载用户…'
                : error
                  ? '列表加载失败'
                  : total
                    ? `显示 ${(page - 1) * size + 1} 至 ${Math.min(page * size, total)} 条，共 ${number(total)} 位用户`
                    : '共 0 位用户'
            }}
          </p>
          <div class="pagination-actions">
            <div
              ref="sizePicker"
              class="size-picker"
              @focusout="
                event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) sizeOpen = false
                }
              "
            >
              <button
                class="size-trigger"
                aria-haspopup="listbox"
                aria-controls="user-page-sizes"
                :aria-expanded="sizeOpen"
                :disabled="loading"
                aria-label="每页显示条数"
                @click="sizeOpen ? (sizeOpen = false) : openSizes(sizeOptions.indexOf(size))"
                @keydown.down.prevent="openSizes()"
                @keydown.up.prevent="openSizes(-1)"
              >
                {{ size }} 条/页
                <ChevronDown :size="15" :class="{ 'is-open': sizeOpen }" />
              </button>
              <Transition name="size-menu">
                <div
                  v-if="sizeOpen"
                  id="user-page-sizes"
                  class="size-options"
                  role="listbox"
                  aria-label="每页显示条数"
                  @keydown="menuKeys"
                >
                  <button
                    v-for="option in sizeOptions"
                    :key="option"
                    type="button"
                    role="option"
                    :aria-selected="size === option"
                    :class="{ active: size === option }"
                    @click="chooseSize(option)"
                  >
                    <span>{{ option }} 条/页</span>
                    <Check v-if="size === option" :size="15" />
                  </button>
                </div>
              </Transition>
            </div>
            <nav aria-label="用户列表分页">
              <button aria-label="上一页" :disabled="loading || page === 1" @click="goTo(page - 1)">
                <ChevronLeft :size="18" />
              </button>
              <template v-for="item in pageNumbers" :key="item">
                <span v-if="typeof item === 'string'" class="page-gap">…</span>
                <button
                  v-else
                  :aria-label="`第 ${item} 页`"
                  :aria-current="page === item ? 'page' : undefined"
                  :class="{ current: page === item }"
                  :disabled="loading"
                  @click="goTo(item)"
                >
                  {{ item }}
                </button>
              </template>
              <button
                aria-label="下一页"
                :disabled="loading || page >= pages"
                @click="goTo(page + 1)"
              >
                <ChevronRight :size="18" />
              </button>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  </section>
</template>

<style scoped>
  .users-page {
    --surface: #fff;
    --input: #f5f4f9;
    --ink: #25232d;
    --muted: #716d80;
    --line: #eeecf4;
    --accent: #514def;
    position: relative;
    isolation: isolate;
    min-height: 100%;
    padding: 36px 40px 48px;
    background: #f7f9fc;
    color: var(--ink);
    font-size: 14px;
  }
  :global(html.dark .users-page) {
    --surface: #19191b;
    --input: #0f0f10;
    --ink: #f2f0f8;
    --muted: #b6b1c6;
    --line: #35343f;
    --accent: #a78bfa;
    background: #000;
  }
  .users-wrap {
    position: relative;
    max-width: 1440px;
    margin: auto;
  }
  .page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
  }
  h1 {
    font-size: 26px;
    line-height: 1.4;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  button,
  select,
  input {
    font: inherit;
  }
  button,
  select {
    cursor: pointer;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  button:disabled,
  select:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button:focus-visible,
  select:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  button:not(:disabled):active {
    transform: scale(0.97);
  }
  .refresh-button {
    color: var(--muted);
    min-height: 40px;
    padding: 0 12px;
    border-radius: 10px;
    transition:
      background 0.2s,
      color 0.2s;
  }
  .refresh-button:hover {
    background: var(--surface);
    color: var(--accent);
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 18px;
    margin-bottom: 28px;
  }
  .stat-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: 0 5px 24px #32235a04;
    transition:
      transform 0.25s,
      box-shadow 0.25s;
    animation: arrive 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .stat-card:nth-child(2) {
    animation-delay: 45ms;
  }
  .stat-card:nth-child(3) {
    animation-delay: 90ms;
  }
  .stat-card:nth-child(4) {
    animation-delay: 135ms;
  }
  .stat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 26px #32235a0b;
  }
  .stat-card p {
    font-size: 13px;
    font-weight: 550;
    color: var(--muted);
  }
  .stat-card small {
    font-size: 10px;
    font-weight: 400;
    margin-left: 4px;
  }
  .stat-card strong {
    display: block;
    font-size: 34px;
    line-height: 1.3;
    font-weight: 620;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    margin: 7px 0 3px;
  }
  .stat-card span {
    font-size: 11px;
    color: var(--muted);
  }
  .stat-icon {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    border-radius: 16px;
  }
  .blue {
    background: #edf2ff;
    color: #2366c2;
  }
  .violet {
    background: #f0edfc;
    color: #7860bd;
  }
  .amber {
    background: #fff0e2;
    color: #a46517;
  }
  .rate-ring {
    flex-shrink: 0;
    width: 62px;
    height: 62px;
  }
  .rate-ring circle {
    fill: none;
    stroke-width: 5;
  }
  .ring-track {
    stroke: var(--input);
  }
  .ring-value {
    stroke: var(--accent);
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: center;
    transition: stroke-dasharray 0.7s;
  }
  .rate-ring text {
    fill: var(--ink);
    font-size: 11px;
    font-weight: 600;
    text-anchor: middle;
  }
  .list-panel {
    overflow: visible;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--surface);
    box-shadow: 0 6px 32px #32235a05;
  }
  .toolbar {
    padding: 22px 24px 18px;
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 680px;
    min-height: 50px;
    padding: 0 16px;
    background: var(--input);
    border: 1px solid transparent;
    border-radius: 12px;
    color: var(--muted);
    transition: border-color 0.2s;
  }
  .search-box:focus-within {
    border-color: var(--accent);
  }
  .search-box input {
    width: 100%;
    min-width: 0;
    outline: none;
    background: transparent;
    border: 0;
    color: var(--ink);
    height: 48px;
    caret-color: var(--accent);
  }
  .search-box input:focus-visible {
    outline: none;
  }
  .search-box input::placeholder {
    color: var(--muted);
  }
  kbd {
    white-space: nowrap;
    font-family: inherit;
    font-size: 10px;
    background: var(--surface);
    border-radius: 5px;
    padding: 3px 6px;
  }
  .clear-button {
    min-width: 30px;
    height: 30px;
    border-radius: 6px;
  }
  .clear-button:hover {
    background: var(--line);
  }
  .list-meta {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-top: 20px;
    min-height: 26px;
  }
  .list-label {
    font-weight: 550;
  }
  .list-label b {
    font-size: 12px;
    font-weight: 500;
    margin-left: 7px;
    background: var(--input);
    color: var(--muted);
    border-radius: 6px;
    padding: 3px 8px;
  }
  .role-filters {
    position: relative;
    isolation: isolate;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: var(--input);
  }
  .role-filters button {
    position: relative;
    z-index: 1;
    min-height: 34px;
    padding: 0 16px;
    border-radius: 9px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 550;
    transition:
      background 0.2s,
      color 0.2s,
      box-shadow 0.2s;
  }
  .role-filters button:hover {
    color: var(--ink);
  }
  .role-indicator {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    border-radius: 9px;
    background: var(--surface);
    box-shadow: 0 2px 6px rgb(35 25 65 / 5%);
    transition:
      transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .role-filters button.active {
    color: var(--ink);
  }
  .role-filters button span {
    font-variant-numeric: tabular-nums;
  }
  th:first-child,
  td:first-child {
    padding-left: 24px;
  }
  @media (max-width: 767px) {
    .role-filters {
      width: 100%;
    }
    .role-filters button {
      position: relative;
      z-index: 1;
      flex: 1;
      padding: 0 8px;
    }
    th:first-child,
    td:first-child {
      padding-left: 16px;
    }
  }
  .table-scroll {
    overflow-x: auto;
    margin-inline: 16px;
    border-radius: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  th {
    font-size: 12px;
    font-weight: 550;
    letter-spacing: 0.03em;
    color: var(--muted);
    background: var(--input);
    height: 54px;
  }
  th,
  td {
    padding: 15px 20px;
  }
  td {
    height: 82px;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 13px;
  }
  tbody tr:last-child td {
    border-bottom: 0;
  }
  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 140px;
  }
  .user-avatar {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    font-weight: 600;
    font-size: 15px;
    background: var(--input);
    color: var(--muted);
  }
  .user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .admin-avatar {
    background: #e2eaff;
    color: #3066b4;
  }
  .avatar-0 {
    background: #f7e9dd;
    color: #89613e;
  }
  .avatar-1 {
    background: #e5e2ef;
    color: #6b5a88;
  }
  .avatar-2 {
    background: #e3eee9;
    color: #43715d;
  }
  .user-name {
    font-size: 14px;
    color: var(--ink);
    font-weight: 550;
  }
  .account {
    display: inline-block;
    background: var(--input);
    padding: 5px 9px;
    border-radius: 8px;
    color: var(--ink);
    font-size: 12px;
  }
  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 10px;
    border-radius: 20px;
    background: var(--input);
    font-size: 12px;
    color: var(--muted);
    font-weight: 550;
  }
  .role-badge.admin {
    color: #2561b1;
    background: #eaf0fa;
  }
  .role-badge i,
  .status i {
    width: 6px;
    height: 6px;
    display: inline-block;
    border-radius: 50%;
    background: currentColor;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
  }
  .normal {
    color: #27824c;
  }
  .disabled {
    color: var(--muted);
  }
  .is-disabled .user-name {
    color: var(--muted);
  }
  tbody tr {
    transition: background 0.18s;
    animation: row-enter 0.35s ease-out both;
    animation-delay: calc(var(--row-index, 0) * 22ms);
  }
  tbody tr:hover {
    background: var(--input);
  }
  .is-loading {
    opacity: 0.45;
    pointer-events: none;
  }
  .skeleton {
    display: block;
    width: 80%;
    height: 16px;
    border-radius: 6px;
    background: var(--input);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .empty-state {
    min-height: 310px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
    padding: 36px 20px;
    color: var(--muted);
    text-align: center;
  }
  .empty-state h2 {
    font-size: 16px;
    color: var(--ink);
    font-weight: 550;
  }
  .empty-state p {
    font-size: 13px;
    max-width: 50ch;
    overflow-wrap: anywhere;
  }
  .retry-button {
    margin-top: 4px;
    padding: 10px 18px;
    border-radius: 10px;
    background: var(--input);
    color: var(--accent);
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px 24px;
    border-top: 1px solid var(--line);
    background: color-mix(in srgb, var(--surface) 65%, var(--input));
  }
  .pagination p {
    color: var(--muted);
    font-size: 12px;
  }
  .pagination-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .size-picker {
    position: relative;
  }
  .size-trigger {
    height: 40px;
    min-width: 112px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: var(--surface);
    color: var(--ink);
    font-size: 12px;
    justify-content: space-between;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }
  .size-trigger:hover,
  .size-trigger[aria-expanded='true'] {
    border-color: var(--accent);
    box-shadow: 0 3px 10px rgb(50 35 90 / 6%);
  }
  .size-trigger svg {
    transition: transform 0.2s;
    color: var(--muted);
  }
  .size-trigger svg.is-open {
    transform: rotate(180deg);
  }
  .size-options {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 20;
    min-width: 142px;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--surface);
    box-shadow: 0 8px 30px rgb(35 25 65 / 14%);
    transform-origin: bottom right;
  }
  .size-options button {
    width: 100%;
    min-height: 40px;
    padding: 0 11px;
    border-radius: 8px;
    justify-content: space-between;
    color: var(--ink);
    font-size: 13px;
    transition: background 0.15s;
  }
  .size-options button:hover,
  .size-options button:focus-visible {
    background: var(--input);
    outline-offset: -2px;
  }
  .size-options button.active {
    background: color-mix(in srgb, var(--accent) 10%, var(--surface));
    color: var(--accent);
    font-weight: 550;
  }
  .size-menu-enter-active,
  .size-menu-leave-active {
    transition:
      opacity 0.16s,
      transform 0.16s;
  }
  .size-menu-enter-from,
  .size-menu-leave-to {
    opacity: 0;
    transform: translateY(5px) scale(0.97);
  }
  .pagination nav {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    background: var(--input);
    border-radius: 12px;
  }
  .pagination nav button,
  .page-gap {
    display: grid;
    place-items: center;
    min-width: 34px;
    height: 34px;
    border-radius: 9px;
    color: var(--muted);
    font-size: 13px;
    transition:
      background 0.18s,
      color 0.18s;
  }
  .pagination nav button:not(:disabled):hover {
    background: var(--surface);
    color: var(--accent);
  }
  .pagination nav button.current {
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 2px 4px #20183108;
    font-weight: 600;
  }
  .spinning {
    animation: spin 1s linear infinite;
  }
  ::selection {
    background: #514def30;
  }
  :global(.dark .users-page .normal) {
    color: #80d6a0;
  }
  :global(.dark .users-page .role-badge.admin) {
    background: #293955;
    color: #9bbff5;
  }
  :global(.dark .users-page .stat-icon) {
    background: var(--input);
    color: var(--accent);
  }
  @keyframes arrive {
    from {
      transform: translateY(9px);
    }
    to {
      transform: translateY(0);
    }
  }
  @keyframes row-enter {
    from {
      opacity: 0.5;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes pulse {
    50% {
      opacity: 0.4;
    }
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (min-width: 768px) {
    .users-page {
      height: 100%;
      min-height: 0;
      overflow: hidden;
      padding: clamp(16px, 3vh, 36px) 32px 24px;
    }
    .users-wrap {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .page-heading {
      flex-shrink: 0;
      margin-bottom: 18px;
    }
    .stats-grid {
      flex-shrink: 0;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-card {
      padding: 18px;
    }
    .list-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .toolbar {
      flex-shrink: 0;
      padding: 16px 24px 12px;
    }
    .list-meta {
      margin-top: 12px;
    }
    .table-scroll {
      flex: 1;
      min-height: 0;
      overflow: auto;
      scrollbar-width: none;
      margin-inline: 12px;
    }
    .table-scroll::-webkit-scrollbar {
      display: none;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 2;
    }
    td {
      height: 66px;
      padding-top: 10px;
      padding-bottom: 10px;
    }
    .pagination {
      position: relative;
      z-index: 3;
      flex-shrink: 0;
      padding: 14px 24px;
      border-radius: 0 0 20px 20px;
    }
    .empty-state {
      min-height: 180px;
    }
  }
  @media (min-width: 768px) and (max-width: 1100px) {
    .stat-card {
      padding: 14px 12px;
    }
    .stat-icon {
      width: 36px;
      height: 36px;
    }
    .stat-card p {
      font-size: 11px;
    }
    .rate-ring {
      width: 44px;
      height: 44px;
    }
  }
  @media (min-width: 1600px) {
    .stat-card {
      padding: 28px;
    }
    .stat-card strong {
      font-size: 38px;
    }
    td {
      height: 90px;
    }
  }
  @media (max-width: 1100px) {
    .users-page {
      padding: 28px 24px 36px;
    }
  }
  @media (max-width: 767px) {
    .users-page {
      padding: 22px 16px 28px;
    }
    .page-heading {
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
    }
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .stat-card {
      padding: 16px 14px;
      border-radius: 14px;
      gap: 6px;
    }
    .stat-card strong {
      font-size: 28px;
    }
    .stat-card p {
      font-size: 11px;
    }
    .stat-card small {
      display: block;
      margin: 3px 0 0;
    }
    .stat-card span {
      font-size: 10px;
    }
    .stat-icon {
      width: 36px;
      height: 36px;
      border-radius: 11px;
    }
    .stat-icon svg {
      width: 20px;
    }
    .rate-ring {
      width: 44px;
      height: 44px;
    }
    .toolbar {
      padding: 16px;
    }
    .search-box {
      padding: 0 12px;
      gap: 8px;
    }
    .search-box input {
      font-size: 13px;
    }
    .search-box kbd {
      display: none;
    }
    .list-panel {
      border-radius: 16px;
    }
    .pagination {
      padding: 16px;
      gap: 14px;
    }
    .pagination-actions {
      width: 100%;
      justify-content: space-between;
      gap: 8px;
    }
    .pagination nav {
      gap: 1px;
    }
    .pagination nav button,
    .page-gap {
      min-width: 28px;
      height: 32px;
    }
    th,
    td {
      padding-right: 16px;
      padding-left: 16px;
    }
    .refresh-button {
      font-size: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }
</style>

<style scoped>
  .create-button {
    min-height: 44px;
    padding: 0 18px;
    border-radius: 10px;
    background: #514def;
    color: white;
    font-weight: 600;
    transition:
      background 0.18s,
      transform 0.18s;
  }
  .create-button:hover {
    background: #6555d5;
    transform: translateY(-1px);
  }
  .row-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .row-actions button {
    min-height: 44px;
    padding: 0 8px;
    color: var(--accent);
    border-radius: 6px;
    transition: background 0.18s;
  }
  .row-actions button:hover {
    background: var(--input);
  }
  .row-actions .danger-action {
    color: #dc3545;
  }
  .action-notice,
  .action-error {
    padding: 12px 16px;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .action-notice {
    color: var(--accent);
  }
  .action-error {
    color: #dc3545;
  }
  @media (max-width: 640px) {
    .create-button {
      padding: 0 12px;
    }
  }
</style>
