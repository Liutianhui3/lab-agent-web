<script setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import {
    Plus,
    FlaskConical,
    Building2,
    CalendarDays,
    AlignLeft,
    UserRound,
    Check,
    X,
    Ban,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ClipboardList,
    RotateCw
  } from 'lucide-vue-next'
  import { useUserInfo } from '@/composables/useUserInfo'
  import { queryReservations, updateReservationStatus } from '@/api/reservation'

  const router = useRouter()
  const { userInfo } = useUserInfo()
  const isAdmin = computed(() => userInfo.value.role === 'admin')
  const items = ref([]),
    total = ref(0),
    page = ref(1),
    size = ref(6),
    status = ref('')
  const loading = ref(true),
    error = ref(''),
    notice = ref(''),
    sizeMenu = ref(false)
  const saving = ref(new Set())
  const counts = ref({})
  const states = [
    { value: '', label: '全部', tone: 'all' },
    { value: 1, label: '已通过', tone: 'approved', count: 'approved_count' },
    { value: 0, label: '待审核', tone: 'pending', count: 'pending_count' },
    { value: 2, label: '已拒绝', tone: 'rejected', count: 'rejected_count' },
    { value: 3, label: '已取消', tone: 'cancelled', count: 'cancelled_count' }
  ]
  const stateFor = value =>
    states.find(state => state.value === Number(value)) || { label: '未知状态', tone: 'cancelled' }
  const allCount = computed(() =>
    states.slice(1).reduce((sum, state) => sum + (counts.value[state.count] || 0), 0)
  )
  const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
  const pageNumbers = computed(() => {
    const numbers = new Set([1, pages.value, page.value - 1, page.value, page.value + 1])
    const result = []
    for (const n of [...numbers].filter(n => n >= 1 && n <= pages.value).sort((a, b) => a - b)) {
      if (result.length && n - result[result.length - 1] > 1) result.push(`gap-${n}`)
      result.push(n)
    }
    return result
  })
  let version = 0,
    noticeTimer
  async function load() {
    const current = ++version
    loading.value = true
    error.value = ''
    try {
      const data = await queryReservations({
        page: page.value,
        size: size.value,
        status: status.value === '' ? undefined : status.value
      })
      if (current !== version) return
      total.value = data.total
      counts.value = data
      if (page.value > pages.value) {
        page.value = pages.value
        return
      }
      items.value = data.items
    } catch (reason) {
      if (current !== version) return
      items.value = []
      total.value = 0
      error.value = typeof reason === 'string' ? reason : '预约列表加载失败，请稍后重试。'
    } finally {
      if (current === version) loading.value = false
    }
  }
  watch([status, size, () => userInfo.value.role], () => {
    if (page.value !== 1) page.value = 1
    else load()
  })
  watch(page, load, { immediate: true })
  function setSize(value) {
    size.value = value
    sizeMenu.value = false
  }
  function showNotice(message) {
    clearTimeout(noticeTimer)
    notice.value = message
    noticeTimer = setTimeout(() => {
      notice.value = ''
    }, 5000)
  }
  async function changeStatus(item, target) {
    if (saving.value.has(item.id) || loading.value) return
    if (
      isAdmin.value
        ? ![1, 2].includes(target) || Number(item.status) !== 0
        : target !== 3 || ![0, 1].includes(Number(item.status))
    )
      return
    saving.value.add(item.id)
    try {
      const response = await updateReservationStatus(item.id, target)
      item.status = response.data?.status ?? target
      showNotice({ 1: '预约已通过', 2: '预约已拒绝', 3: '预约已取消' }[target])
      await load()
    } catch (reason) {
      showNotice(
        typeof reason === 'string'
          ? reason
          : reason?.response?.data?.message || '状态更新失败，请稍后重试。'
      )
    } finally {
      saving.value.delete(item.id)
    }
  }
  function createdAt(value) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? '—'
      : new Intl.DateTimeFormat('zh-CN', {
          timeZone: 'Asia/Shanghai',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date)
  }
  onBeforeUnmount(() => {
    version++
    clearTimeout(noticeTimer)
  })
</script>

<template>
  <section class="reservations-page" @click="sizeMenu = false">
    <div class="reservations-wrap">
      <header class="page-heading">
        <h1>{{ isAdmin ? '预约审核' : '我的预约' }}</h1>
        <button v-if="!isAdmin" class="primary" @click="router.push({ name: 'laboratory-list' })">
          <Plus :size="18" />
          发起预约
        </button>
      </header>
      <div class="toolbar">
        <div
          class="filters"
          role="group"
          aria-label="预约状态"
          :style="{ '--active-index': states.findIndex(s => s.value === status) }"
        >
          <span class="filter-indicator" aria-hidden="true"></span>
          <button
            v-for="state in states"
            :key="state.tone"
            :aria-pressed="status === state.value"
            @click="status = state.value"
          >
            <i v-if="state.value !== ''" :class="state.tone" aria-hidden="true"></i>
            {{ state.label }}
            <span>{{ state.value === '' ? allCount : counts[state.count] || 0 }}</span>
          </button>
        </div>
      </div>
      <div
        v-if="loading && !items.length"
        class="card-grid"
        aria-busy="true"
        aria-label="正在加载预约"
      >
        <div v-for="n in 4" :key="n" class="skeleton">
          <span></span>
          <span></span>
          <div></div>
          <span></span>
        </div>
      </div>
      <div v-else-if="error || !items.length" class="empty" :role="error ? 'alert' : 'status'">
        <span><ClipboardList :size="32" /></span>
        <h2>
          {{ error ? '预约列表加载失败' : status === '' ? '暂无预约记录' : '暂无此状态的预约' }}
        </h2>
        <p>
          {{
            error || (isAdmin ? '新的预约申请将在这里显示。' : '选择实验室，安排你的下一次实验。')
          }}
        </p>
        <button v-if="error" class="secondary" @click="load">
          <RotateCw :size="16" />
          重新加载
        </button>
        <button v-else-if="status !== ''" class="secondary" @click="status = ''">
          查看全部预约
        </button>
      </div>
      <div v-else class="card-grid" :aria-busy="loading">
        <article
          v-for="(item, index) in items"
          :key="`${page}-${status}-${item.id}`"
          class="reservation-card"
          :style="{ '--card-index': index }"
        >
          <header class="card-heading">
            <div class="record-meta">
              <span>预约单号：{{ item.id }}</span>
              <span>申请于 {{ createdAt(item.createdAt) }}</span>
            </div>
            <span class="status-badge" :class="stateFor(item.status).tone">
              <i></i>
              {{ stateFor(item.status).label }}
            </span>
          </header>
          <h2>{{ item.labName || item.lab?.name || '实验室' }}</h2>
          <p class="applicant">
            <UserRound :size="14" />
            预约人：{{ item.userName || item.user?.name || '—' }}
          </p>
          <dl class="booking-details">
            <div>
              <span class="detail-icon">
                <FlaskConical v-if="item.type === 'equipment'" :size="22" />
                <Building2 v-else :size="22" />
              </span>
              <div>
                <dt>{{ item.type === 'equipment' ? '预约设备' : '预约实验室' }}</dt>
                <dd>
                  {{
                    item.type === 'equipment'
                      ? item.equipmentName || item.equipment?.name || '设备名称未提供'
                      : item.labName || item.lab?.name || '实验室名称未提供'
                  }}
                </dd>
              </div>
            </div>
            <div>
              <span class="detail-icon calendar"><CalendarDays :size="22" /></span>
              <div>
                <dt>预约日期与时段</dt>
                <dd>
                  {{ item.date }}
                  <span class="time">
                    {{ item.startTime?.slice(0, 5) }} – {{ item.endTime?.slice(0, 5) }}
                  </span>
                </dd>
              </div>
            </div>
          </dl>
          <div class="remark">
            <AlignLeft :size="17" />
            <p>
              <strong>预约备注：</strong>
              {{ item.remark || '暂无备注' }}
            </p>
          </div>
          <footer class="card-actions" :aria-busy="saving.has(item.id)">
            <span v-if="saving.has(item.id)" class="saving-label" role="status">处理中…</span>
            <template v-if="isAdmin">
              <button
                class="secondary reject"
                :disabled="loading || saving.has(item.id) || Number(item.status) !== 0"
                @click="changeStatus(item, 2)"
              >
                <X :size="16" />
                拒绝
              </button>
              <button
                class="primary approve"
                :disabled="loading || saving.has(item.id) || Number(item.status) !== 0"
                @click="changeStatus(item, 1)"
              >
                <Check :size="16" />
                同意
              </button>
            </template>
            <button
              v-else
              class="secondary cancel"
              :disabled="loading || saving.has(item.id) || ![0, 1].includes(Number(item.status))"
              @click="changeStatus(item, 3)"
            >
              <Ban :size="15" />
              取消预约
            </button>
          </footer>
        </article>
      </div>
      <footer v-if="total && !error" class="pagination">
        <p>
          显示 {{ (page - 1) * size + 1 }}–{{ Math.min(page * size, total) }} 条，共
          {{ total }} 条预约
        </p>
        <div>
          <div
            class="size-picker"
            @click.stop
            @keydown.esc="sizeMenu = false"
            @focusout="
              event => {
                if (!event.currentTarget.contains(event.relatedTarget)) sizeMenu = false
              }
            "
          >
            <button
              class="size-trigger"
              aria-haspopup="listbox"
              :aria-expanded="sizeMenu"
              @click="sizeMenu = !sizeMenu"
            >
              {{ size }} 条/页
              <ChevronDown :size="16" :class="{ rotated: sizeMenu }" />
            </button>
            <Transition name="menu">
              <div v-if="sizeMenu" class="size-options" role="listbox" aria-label="每页显示条数">
                <button
                  v-for="option in [6, 12, 24]"
                  :key="option"
                  role="option"
                  :aria-selected="size === option"
                  @click="setSize(option)"
                >
                  {{ option }} 条/页
                  <Check v-if="size === option" :size="16" />
                </button>
              </div>
            </Transition>
          </div>
          <nav aria-label="预约分页">
            <button :disabled="page === 1 || loading" aria-label="上一页" @click="page--">
              <ChevronLeft :size="18" />
            </button>
            <template v-for="n in pageNumbers" :key="n">
              <span v-if="typeof n === 'string'" class="page-gap">…</span>
              <button
                v-else
                :aria-current="page === n ? 'page' : undefined"
                :disabled="loading"
                @click="page = n"
              >
                {{ n }}
              </button>
            </template>
            <button :disabled="page === pages || loading" aria-label="下一页" @click="page++">
              <ChevronRight :size="18" />
            </button>
          </nav>
        </div>
      </footer>
    </div>
    <Transition name="notice">
      <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    </Transition>
  </section>
</template>

<style scoped>
  .reservations-page {
    --bg: #f8f7fc;
    --surface: #fff;
    --input: #f3f2f8;
    --ink: #25232d;
    --muted: #726d82;
    --line: #eeecf4;
    --accent: #514def;
    background: var(--bg);
    color: var(--ink);
    padding: 36px 40px;
    min-height: 100%;
  }
  :global(html.dark .reservations-page) {
    --bg: #000;
    --surface: #19191b;
    --input: #101012;
    --ink: #f2f0f8;
    --muted: #b6b1c6;
    --line: #35343f;
    --accent: #a78bfa;
  }
  .reservations-wrap {
    max-width: 1440px;
    margin: 0 auto;
  }
  .page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 26px;
  }
  h1 {
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 7px;
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 9px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    background: transparent;
    color: inherit;
    transition:
      background 0.2s,
      transform 0.2s,
      box-shadow 0.2s;
  }
  button:active:not(:disabled) {
    transform: scale(0.97);
  }
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .primary {
    background: #514def;
    color: #fff;
    font-weight: 550;
    min-height: 44px;
    padding-inline: 18px;
  }
  .primary:hover:not(:disabled) {
    background: #4540d9;
    box-shadow: 0 4px 12px #514def24;
  }
  .secondary {
    background: var(--input);
  }
  .secondary:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 9%, var(--input));
  }
  .toolbar {
    background: var(--surface);
    border: 1px solid var(--line);
    padding: 10px;
    border-radius: 16px;
    margin-bottom: 24px;
    overflow-x: auto;
  }
  .filters {
    display: flex;
    position: relative;
    isolation: isolate;
    background: var(--input);
    padding: 4px;
    width: 590px;
    border-radius: 11px;
  }
  .filters button {
    position: relative;
    z-index: 1;
    flex: 1;
    white-space: nowrap;
    padding-inline: 8px;
    color: var(--muted);
  }
  .filters button[aria-pressed='true'] {
    color: var(--ink);
    font-weight: 600;
  }
  .filters button > span {
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
  .filter-indicator {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 8px) / 5);
    transform: translateX(calc(var(--active-index) * 100%));
    background: var(--surface);
    box-shadow: 0 2px 5px #20183c10;
    border-radius: 8px;
    transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
    background: currentColor;
  }
  .filters i.approved {
    color: #278449;
  }
  .filters i.pending {
    color: #bb730d;
  }
  .filters i.rejected {
    color: #c23d4c;
  }
  .filters i.cancelled {
    color: var(--muted);
  }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
    margin-bottom: 24px;
    transition: opacity 0.2s;
  }
  .card-grid[aria-busy='true'] {
    opacity: 0.55;
  }
  .reservation-card {
    min-width: 0;
    padding: 26px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    animation: arrive 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(var(--card-index) * 40ms);
    transition:
      transform 0.3s,
      box-shadow 0.3s,
      border-color 0.3s;
  }
  .reservation-card:hover,
  .reservation-card:focus-within {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px #24164514;
    border-color: color-mix(in srgb, var(--accent) 28%, var(--line));
  }
  .card-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }
  .record-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 12px;
    font-size: 11px;
    color: var(--muted);
  }
  .record-meta > span:first-child {
    color: var(--accent);
    font-weight: 600;
    font-size: 12px;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 550;
    padding: 5px 10px;
    border-radius: 20px;
  }
  .approved {
    color: #257443;
    background: #eaf7ee;
  }
  .pending {
    color: #95600c;
    background: #fff4e4;
  }
  .rejected {
    color: #b73444;
    background: #fff0f1;
  }
  .cancelled {
    color: var(--muted);
    background: var(--input);
  }
  :global(html.dark) .approved {
    color: #8ee3a7;
    background: #193224;
  }
  :global(html.dark) .pending {
    color: #efc17b;
    background: #332819;
  }
  :global(html.dark) .rejected {
    color: #ff9ba6;
    background: #351e26;
  }
  h2 {
    font-size: 19px;
    line-height: 1.5;
    font-weight: 650;
    overflow-wrap: anywhere;
  }
  .applicant {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-top: 10px;
    font-size: 12px;
    color: var(--muted);
  }
  .booking-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    background: var(--input);
    padding: 18px;
    border-radius: 13px;
    margin: 23px 0;
  }
  .booking-details > div {
    display: flex;
    gap: 12px;
    align-items: center;
    min-width: 0;
  }
  .booking-details > div > div {
    min-width: 0;
  }
  .detail-icon {
    flex-shrink: 0;
    width: 42px;
    height: 46px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--surface);
    color: var(--accent);
    box-shadow: 0 2px 3px #20183c05;
  }
  .calendar {
    color: var(--muted);
  }
  dt {
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 5px;
  }
  dd {
    margin: 0;
    font-size: 13px;
    font-weight: 550;
    line-height: 1.6;
    overflow-wrap: anywhere;
    font-variant-numeric: tabular-nums;
  }
  .time {
    display: block;
  }
  .remark {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.9;
    margin-bottom: 24px;
  }
  .remark svg {
    flex-shrink: 0;
    margin-top: 4px;
  }
  .remark p {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .remark strong {
    color: var(--ink);
    font-weight: 550;
  }
  .saving-label {
    color: var(--muted);
    font-size: 12px;
    margin-right: auto;
  }
  .card-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .cancel,
  .reject {
    color: #bc394c;
  }
  :global(html.dark) .cancel,
  :global(html.dark) .reject {
    color: #ff9ba6;
  }
  .card-actions button {
    min-height: 38px;
  }
  .card-actions .approve {
    padding-inline: 20px;
  }
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px 24px;
    background: color-mix(in srgb, var(--surface) 65%, var(--input));
    font-size: 12px;
  }
  .pagination p {
    color: var(--muted);
  }
  .pagination > div {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .size-picker {
    position: relative;
  }
  .size-trigger {
    border: 1px solid var(--line);
    background: var(--surface);
    font-size: 12px;
  }
  .size-trigger svg {
    transition: transform 0.2s;
  }
  .rotated {
    transform: rotate(180deg);
  }
  .size-options {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 5;
    min-width: 140px;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: 0 8px 24px #17132324;
  }
  .size-options button {
    width: 100%;
    justify-content: space-between;
  }
  .size-options button:hover,
  .size-options [aria-selected='true'] {
    background: var(--input);
    color: var(--accent);
  }
  .pagination nav {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    background: var(--input);
  }
  .pagination nav button,
  .page-gap {
    min-width: 34px;
    height: 34px;
    min-height: 34px;
    padding: 0 5px;
    display: grid;
    place-items: center;
    color: var(--muted);
  }
  .pagination nav button[aria-current='page'] {
    background: var(--surface);
    color: var(--ink);
    font-weight: 600;
    box-shadow: 0 2px 4px #20183108;
  }
  .pagination nav button:hover:not(:disabled) {
    background: var(--surface);
    color: var(--accent);
  }
  .empty {
    min-height: 360px;
    border-radius: 18px;
    border: 1px solid var(--line);
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 32px;
    text-align: center;
  }
  .empty > span {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    background: var(--input);
    color: var(--accent);
    border-radius: 20px;
    margin-bottom: 20px;
  }
  .empty p {
    color: var(--muted);
    margin: 12px 0 22px;
    line-height: 1.8;
    font-size: 13px;
  }
  .skeleton {
    border-radius: 18px;
    border: 1px solid var(--line);
    padding: 26px;
    background: var(--surface);
    min-height: 300px;
  }
  .skeleton span,
  .skeleton > div {
    display: block;
    height: 15px;
    width: 60%;
    margin-bottom: 18px;
    background: var(--input);
    border-radius: 6px;
    animation: pulse 1.4s ease-in-out infinite alternate;
  }
  .skeleton span:nth-child(2) {
    width: 80%;
    height: 23px;
  }
  .skeleton > div {
    width: 100%;
    height: 90px;
    margin: 26px 0;
  }
  .notice {
    position: fixed;
    z-index: 50;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 14px 22px;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--line);
    border-radius: 12px;
    box-shadow: 0 8px 30px #17132324;
    font-size: 13px;
    width: max-content;
    max-width: calc(100vw - 32px);
  }
  .menu-enter-active,
  .menu-leave-active,
  .notice-enter-active,
  .notice-leave-active {
    transition:
      opacity 0.18s,
      translate 0.18s;
  }
  .menu-enter-from,
  .menu-leave-to,
  .notice-enter-from,
  .notice-leave-to {
    opacity: 0;
    translate: 0 6px;
  }
  ::selection {
    background: #514def30;
  }
  @keyframes arrive {
    from {
      opacity: 0.6;
      translate: 0 10px;
    }
    to {
      opacity: 1;
      translate: 0 0;
    }
  }
  @keyframes pulse {
    to {
      opacity: 0.45;
    }
  }
  @media (max-width: 1100px) {
    .reservations-page {
      padding: 28px 24px;
    }
    .reservation-card {
      padding: 20px;
    }
    .booking-details {
      gap: 12px;
      padding: 14px;
    }
    .detail-icon {
      display: none;
    }
  }
  @media (max-width: 700px) {
    .reservations-page {
      padding: 22px 16px;
    }
    h1 {
      font-size: 22px;
    }
    .card-grid {
      grid-template-columns: 1fr;
      gap: 18px;
    }
    .filters {
      width: 490px;
    }
    .filters button {
      font-size: 12px;
      gap: 5px;
    }
    .page-heading {
      margin-bottom: 20px;
    }
    .toolbar {
      margin-bottom: 20px;
    }
    .pagination {
      padding: 16px;
      align-items: flex-start;
      flex-direction: column;
    }
    .pagination > div {
      width: 100%;
      gap: 8px;
      justify-content: space-between;
      flex-wrap: wrap;
    }
    .pagination nav {
      gap: 2px;
    }
    .pagination nav button,
    .page-gap {
      min-width: 28px;
    }
    h2 {
      font-size: 18px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
    .reservation-card:hover,
    .reservation-card:focus-within {
      transform: none;
    }
  }
</style>
