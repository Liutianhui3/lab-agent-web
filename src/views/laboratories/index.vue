<script setup>
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import {
    Plus,
    Search,
    X,
    Building2,
    DoorOpen,
    DoorClosed,
    UsersRound,
    LayoutGrid,
    Rows3,
    MapPin,
    Clock3,
    Pencil,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    SearchX,
    ImageOff,
    ArrowLeftRight,
    Trash2
  } from 'lucide-vue-next'
  import { queryLabs, removeLab, updateLab } from '@/api/lab'
  import LabDrawer from './LabDrawer.vue'
  import ReservationDialog from '@/components/ReservationDialog.vue'
  import { useRouter } from 'vue-router'
  const router = useRouter()
  function viewEquipment(lab) {
    router.push({ name: 'laboratory-list', query: { status: 'detail', lab_code: lab.lab_code } })
  }
  import { useUserInfo } from '@/composables/useUserInfo'
  const props = defineProps({ readOnly: { type: Boolean, default: false } })
  const { userInfo } = useUserInfo()
  const canManage = computed(() => !props.readOnly && userInfo.value.role === 'admin')
  const items = ref([]),
    total = ref(0),
    page = ref(1),
    size = ref(6),
    keyword = ref(''),
    status = ref(''),
    view = ref('grid'),
    loading = ref(false),
    menu = ref(null),
    drawer = ref(null),
    notice = ref(''),
    deletion = ref(null),
    deleting = ref(false),
    confirmDialog = ref(null)
  const sizeMenu = ref(false)
  const reservationOpen = ref(false)
  const reservationLab = ref(null)
  function openReservation(lab) { reservationLab.value = lab; reservationOpen.value = true }
  const stats = ref({ total: 0, open: 0, closed: 0, capacity: 0 })
  const loadError = ref('')
  const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
  const filters = computed(() => [
    { value: '', label: '全部', count: stats.value.total },
    { value: '1', label: '开放中', count: stats.value.open },
    { value: '0', label: '已关闭', count: stats.value.closed }
  ])
  let version = 0
  async function load() {
    const current = ++version
    loading.value = true
    loadError.value = ''
    try {
      const result = await queryLabs({
        page: page.value,
        size: size.value,
        keyword: keyword.value,
        status: status.value === '' ? undefined : Number(status.value)
      })
      if (current !== version) return
      total.value = result.total
      stats.value = result.stats
      if (page.value > pages.value) {
        page.value = pages.value
        return
      }
      items.value = result.items
    } catch (error) {
      if (current !== version) return
      items.value = []
      total.value = 0
      stats.value = { total: 0, open: 0, closed: 0, capacity: 0 }
      loadError.value = error.message || '实验室列表加载失败'
    } finally {
      if (current === version) loading.value = false
    }
  }
  watch([keyword, status, size], () => {
    page.value = 1
    load()
  })
  watch(page, load)
  onMounted(load)
  function saved() {
    notice.value = '实验室信息已保存'
    load()
  }
  async function toggle(lab) {
    if (!canManage.value) return
    menu.value = null
    try {
      await updateLab(lab.id, { ...lab, status: lab.status === 1 ? 0 : 1 })
      notice.value = lab.status === 1 ? '实验室已关闭' : '实验室已开放'
      load()
    } catch (error) {
      notice.value = error.message || '实验室状态更新失败'
    }
  }
  async function askDelete(lab) {
    if (!canManage.value) return
    menu.value = null
    deletion.value = lab
    await nextTick()
    confirmDialog.value.showModal()
  }
  async function destroy() {
    if (!canManage.value) return
    deleting.value = true
    try {
      await removeLab(deletion.value.id)
      confirmDialog.value.close()
      deletion.value = null
      notice.value = '实验室已删除'
      load()
    } catch (error) {
      notice.value = error.message || '实验室删除失败'
    } finally {
      deleting.value = false
    }
  }
  function clear() {
    keyword.value = ''
    status.value = ''
  }
  function setSize(value) {
    size.value = value
    sizeMenu.value = false
  }
</script>
<template>
  <section class="labs-page" @click="menu = null">
    <div class="labs-wrap">
      <header class="page-heading">
        <h1>{{ canManage ? '实验室管理' : '实验室列表' }}</h1>
        <button v-if="canManage" class="primary" @click="drawer.open()">
          <Plus :size="18" />
          新增实验室
        </button>
      </header>
      <div class="stats-grid">
        <article
          v-for="metric in [
            {
              label: '实验室总数',
              value: stats.total,
              unit: '间实验空间',
              icon: Building2,
              tone: 'purple',
              hint: '已纳入管理的实验室'
            },
            {
              label: '开放运行中',
              value: stats.open,
              unit: '间正常开放',
              icon: DoorOpen,
              tone: 'green',
              hint: '可用于科研与教学'
            },
            {
              label: '已关闭',
              value: stats.closed,
              unit: '间暂停开放',
              icon: DoorClosed,
              tone: 'gray',
              hint: '当前暂不接受预约'
            },
            {
              label: '总工位容量',
              value: stats.capacity,
              unit: '人同时容纳',
              icon: UsersRound,
              tone: 'purple',
              hint: '全部实验室额定容量'
            }
          ]"
          :key="metric.label"
          class="stat-card"
        >
          <div class="stat-title">
            {{ metric.label }}
            <span :class="metric.tone"><component :is="metric.icon" :size="21" /></span>
          </div>
          <div class="stat-number">
            <strong>{{ metric.value }}</strong>
            <span>{{ metric.unit }}</span>
          </div>
          <p>{{ metric.hint }}</p>
        </article>
      </div>
      <div class="toolbar">
        <form class="search" autocomplete="off" @submit.prevent="load">
          <Search :size="19" />
          <input
            v-model="keyword"
            aria-label="搜索实验室"
            placeholder="搜索实验室名称、编号或位置…"
          />
          <button v-if="keyword" type="button" aria-label="清空搜索" @click="keyword = ''">
            <X :size="16" />
          </button>
        </form>
        <div class="toolbar-right">
          <div
            class="filters"
            role="group"
            aria-label="按开放状态筛选"
            :data-active="
              Math.max(
                0,
                filters.findIndex(filter => filter.value === status)
              )
            "
            :style="{
              '--active-index': Math.max(
                0,
                filters.findIndex(filter => filter.value === status)
              )
            }"
          >
            <span class="filter-indicator" aria-hidden="true" />
            <button
              v-for="filter in filters"
              :key="filter.value"
              :aria-pressed="status === filter.value"
              @click="status = filter.value"
            >
              {{ filter.label }}
              <span>{{ filter.count }}</span>
            </button>
          </div>
          <div
            class="view-toggle"
            role="group"
            aria-label="显示方式"
            :style="{ '--active-index': view === 'grid' ? 0 : 1 }"
          >
            <span class="view-indicator" aria-hidden="true" />
            <button :aria-pressed="view === 'grid'" aria-label="卡片视图" @click="view = 'grid'">
              <LayoutGrid :size="18" />
            </button>
            <button :aria-pressed="view === 'list'" aria-label="列表视图" @click="view = 'list'">
              <Rows3 :size="18" />
            </button>
          </div>
        </div>
      </div>
      <!-- <p v-if="notice" class="notice" role="status">
        {{ notice }}
        <button aria-label="关闭提示" @click="notice = ''"><X :size="15" /></button>
      </p> -->
      <div v-if="loadError && !loading" class="empty">
        <h2>实验室列表加载失败</h2>
        <p>{{ loadError }}</p>
        <button class="secondary" @click="load">重试</button>
      </div>
      <div v-else-if="!items.length && !loading" class="empty empty-fill">
        <span>
          <SearchX v-if="keyword || status" :size="34" />
          <Building2 v-else :size="34" />
        </span>
        <h2>{{ keyword || status ? '没有找到匹配的实验室' : '还没有实验室' }}</h2>
        <p>
          {{
            keyword || status
              ? '试试其他关键词，或清除筛选条件。'
              : canManage
                ? '新增第一个实验室，开始管理空间和开放时间。'
                : '暂无可查看的实验室，请稍后再来。'
          }}
        </p>
        <button v-if="keyword || status" class="secondary" @click="clear">清除筛选</button>
        <button v-else-if="canManage" class="primary" @click="drawer.open()">
          <Plus :size="17" />
          新增实验室
        </button>
      </div>
      <div v-else-if="items.length" class="lab-collection" :class="view" :aria-busy="loading">
        <article
          v-for="(lab, index) in items"
          :key="lab.id"
          class="lab-card"
          :style="{ '--card-index': index }"
        >
          <div class="cover">
            <img
              v-if="lab.img"
              :src="lab.img"
              :alt="lab.name + '封面'"
              loading="lazy"
              @error="lab.img = null"
            />
            <div v-else class="no-image">
              <ImageOff :size="32" />
              <span>暂无封面</span>
            </div>
            <span class="code">{{ lab.lab_code }}</span>
            <span class="status-badge" :class="{ closed: lab.status === 0 }">
              <i />
              {{ lab.status === 1 ? '开放中' : '已关闭' }}
            </span>
            <span class="hours">
              <Clock3 :size="14" />
              {{
                lab.open_time && lab.close_time
                  ? `${lab.open_time} – ${lab.close_time}`
                  : '开放时间未设置'
              }}
            </span>
          </div>
          <div class="card-body">
            <h2>{{ lab.name }}</h2>
            <div class="lab-meta">
              <span>
                <MapPin :size="16" />
                {{ lab.location || '位置未设置' }}
              </span>
              <span>
                <UsersRound :size="16" />
                容量 {{ lab.capacity }} 人
              </span>
            </div>
            <p class="description">{{ lab.description || '暂无实验室描述' }}</p>
            <footer v-if="canManage">
              <span>{{ lab.status === 1 ? '实验空间开放使用' : '实验空间暂停开放' }}</span>
              <div v-if="canManage" class="card-actions">
                <button class="secondary" @click="drawer.open(lab)">
                  <Pencil :size="15" />
                  编辑
                </button>
                <div class="more-wrap">
                  <button
                    class="secondary icon-button"
                    :aria-label="lab.name + '更多操作'"
                    :aria-expanded="menu === lab.id"
                    @click.stop="menu = menu === lab.id ? null : lab.id"
                  >
                    <MoreHorizontal :size="19" />
                  </button>
                  <div v-if="menu === lab.id" class="more-menu">
                    <button @click="toggle(lab)">
                      <ArrowLeftRight :size="16" />
                      {{ lab.status === 1 ? '关闭实验室' : '开放实验室' }}
                    </button>
                    <button v-if="lab.status === 0" class="danger" @click="askDelete(lab)">
                      <Trash2 :size="16" />
                      删除实验室
                    </button>
                  </div>
                </div>
              </div>
            </footer>
            <footer v-else class="browse-actions">
              <button type="button" class="secondary" @click="viewEquipment(lab)">查看设备</button>
              <button type="button" class="primary" @click="openReservation(lab)">选择预约</button>
            </footer>
          </div>
        </article>
      </div>
      <footer v-if="total" class="pagination">
        <p>
          显示 {{ (page - 1) * size + 1 }}–{{ Math.min(page * size, total) }} 条，共
          {{ total }} 间实验室
        </p>
        <div>
          <div
            class="size-picker"
            @keydown.esc.stop="sizeMenu = false"
            @focusout="
              event => {
                if (!event.currentTarget.contains(event.relatedTarget)) sizeMenu = false
              }
            "
          >
            <button
              class="size-trigger"
              type="button"
              aria-haspopup="listbox"
              aria-label="每页显示条数"
              :aria-expanded="sizeMenu"
              @click="sizeMenu = !sizeMenu"
            >
              {{ size }} 条/页
              <ChevronDown :size="16" :class="{ rotated: sizeMenu }" />
            </button>
            <Transition name="size-menu">
              <div v-if="sizeMenu" class="size-options" role="listbox" aria-label="每页显示条数">
                <button
                  v-for="option in [6, 12, 24]"
                  :key="option"
                  type="button"
                  role="option"
                  :aria-selected="size === option"
                  @click="setSize(option)"
                >
                  <span>{{ option }} 条/页</span>
                  <span class="option-check">{{ size === option ? '✓' : '' }}</span>
                </button>
              </div>
            </Transition>
          </div>
          <nav aria-label="实验室分页">
            <button :disabled="page === 1" aria-label="上一页" @click="page--">
              <ChevronLeft :size="18" />
            </button>
            <button
              v-for="n in pages"
              :key="n"
              :aria-current="page === n ? 'page' : undefined"
              @click="page = n"
            >
              {{ n }}
            </button>
            <button :disabled="page === pages" aria-label="下一页" @click="page++">
              <ChevronRight :size="18" />
            </button>
          </nav>
        </div>
      </footer>
    </div>
    <ReservationDialog :open="reservationOpen" :lab="reservationLab" @close="reservationOpen = false" @success="notice = '预约提交成功，等待审核'" />
    <LabDrawer v-if="canManage" ref="drawer" @saved="saved" />
    <dialog
      v-if="canManage"
      ref="confirmDialog"
      class="delete-confirm"
      @click="
        e => {
          if (e.target === confirmDialog) confirmDialog.close()
        }
      "
    >
      <h2>删除实验室</h2>
      <p>
        确定删除「{{ deletion?.name }}」吗？
        <br />
        删除后无法恢复。
      </p>
      <footer>
        <button class="secondary" @click="confirmDialog.close()">取消</button>
        <button class="delete-button" :disabled="deleting" @click="destroy">
          {{ deleting ? '正在删除…' : '确认删除' }}
        </button>
      </footer>
    </dialog>
  </section>
</template>
<style scoped>
  .labs-page {
    --lab-bg: #f8f9fc;
    --lab-surface: #fff;
    --lab-input: #f5f4f9;
    --lab-ink: #25232d;
    --lab-muted: #716d80;
    --lab-line: #eeecf4;
    --lab-accent: #514def;
    min-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 32px 40px 40px;
    background: var(--lab-bg);
    color: var(--lab-ink);
    font-size: 14px;
  }
  :global(#main-content:has(.labs-page)) {
    scrollbar-width: none;
  }
  :global(#main-content:has(.labs-page)::-webkit-scrollbar) {
    display: none;
  }
  .labs-wrap {
    max-width: 1440px;
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    margin: 0 auto;
  }
  :global(html.dark .labs-page) {
    --lab-bg: #000;
    --lab-surface: #19191b;
    --lab-input: #0f0f10;
    --lab-ink: #f2f0f8;
    --lab-muted: #b6b1c6;
    --lab-line: #35343f;
    --lab-accent: #a78bfa;
  }
  .page-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 26px;
    gap: 16px;
  }
  h1 {
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    cursor: pointer;
    min-height: 40px;
    border-radius: 9px;
    padding: 0 13px;
    font: inherit;
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
  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--lab-accent);
    outline-offset: 2px;
  }
  .primary {
    background: #514def;
    color: white;
    font-weight: 550;
    min-height: 44px;
    padding: 0 18px;
  }
  .primary:hover {
    background: #4540d9;
    box-shadow: 0 4px 12px #514def24;
  }
  .secondary {
    background: var(--lab-input);
    color: var(--lab-ink);
  }
  .secondary:hover {
    background: color-mix(in srgb, var(--lab-accent) 10%, var(--lab-input));
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 18px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--lab-surface);
    border: 1px solid var(--lab-line);
    border-radius: 18px;
    padding: 22px;
  }
  .stat-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 550;
    gap: 8px;
  }
  .stat-title > span {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    background: var(--lab-input);
    color: var(--lab-accent);
  }
  .stat-title .green {
    color: #248047;
    background: #eaf7ed;
  }
  .stat-title .gray {
    color: var(--lab-muted);
  }
  .stat-number {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 14px 0 9px;
  }
  .stat-number strong {
    font-size: 36px;
    line-height: 1.2;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.03em;
  }
  .stat-number span,
  .stat-card p {
    font-size: 12px;
    color: var(--lab-muted);
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 14px;
    background: var(--lab-surface);
    border: 1px solid var(--lab-line);
    border-radius: 16px;
    margin-bottom: 28px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--lab-input);
    padding: 0 14px;
    border: 1px solid transparent;
    border-radius: 10px;
    flex: 1;
    max-width: 510px;
    color: var(--lab-muted);
  }
  .search:focus-within {
    border-color: var(--lab-accent);
  }
  .search input {
    background: transparent;
    outline: none;
    border: 0;
    width: 100%;
    min-width: 0;
    height: 44px;
    color: var(--lab-ink);
    caret-color: var(--lab-accent);
  }
  .search input::placeholder {
    color: var(--lab-muted);
  }
  .search button {
    padding: 0;
    min-width: 28px;
  }
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .filters,
  .view-toggle {
    position: relative;
    display: flex;
    background: var(--lab-input);
    padding: 4px;
    border-radius: 11px;
  }
  .filters button {
    min-height: 36px;
    font-size: 13px;
    color: var(--lab-muted);
    white-space: nowrap;
  }
  .filters span {
    font-size: 11px;
  }
  .view-toggle [aria-pressed='true'] {
    position: relative;
    z-index: 1;
    color: var(--lab-ink);
  }
  .filters [aria-pressed='true'] {
    position: relative;
    z-index: 1;
    color: var(--lab-ink);
    background: transparent;
  }
  .view-toggle [aria-pressed='true'] {
    color: var(--lab-accent);
  }
  .filter-indicator,
  .view-indicator {
    position: absolute;
    z-index: 0;
    top: 4px;
    bottom: 4px;
    left: 4px;
    border-radius: 8px;
    background: var(--lab-surface);
    box-shadow: 0 2px 5px #20183c10;
    transition:
      transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
      width 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
  }
  .filter-indicator {
    left: 4px;
    width: calc((100% - 8px) / 3);
    transform: translateX(calc(var(--active-index) * 100%));
  }
  .view-indicator {
    width: 36px;
    transform: translateX(calc(var(--active-index) * 36px));
  }
  .filters button {
    flex: 1 1 0;
    min-width: 0;
    padding-inline: 8px;
  }
  .filters button {
    position: relative;
    z-index: 1;
  }
  .view-toggle button {
    position: relative;
    z-index: 1;
  }
  .filters {
    isolation: isolate;
  }
  .view-toggle {
    flex: none;
    gap: 0;
    margin-left: 0;
    isolation: isolate;
  }
  .size-picker {
    position: relative;
  }
  .size-trigger {
    border: 1px solid var(--lab-line);
    background: var(--lab-surface);
    color: var(--lab-ink);
    min-height: 40px;
    border-radius: 10px;
    font-size: 12px;
  }
  .size-trigger svg {
    color: var(--lab-muted);
    transition: transform 0.2s;
  }
  .size-trigger svg.rotated {
    transform: rotate(180deg);
  }
  .size-options {
    position: absolute;
    z-index: 20;
    right: 0;
    bottom: calc(100% + 8px);
    min-width: 138px;
    padding: 5px;
    border: 1px solid var(--lab-line);
    border-radius: 12px;
    background: var(--lab-surface);
    box-shadow: 0 8px 24px #17132324;
    transform-origin: bottom right;
  }
  .size-options button {
    width: 100%;
    min-height: 40px;
    display: flex;
    justify-content: space-between;
    border-radius: 8px;
    color: var(--lab-ink);
    font-size: 13px;
  }
  .size-options button:hover,
  .size-options button[aria-selected='true'] {
    background: color-mix(in srgb, var(--lab-accent) 9%, var(--lab-surface));
    color: var(--lab-accent);
  }
  .option-check {
    min-width: 16px;
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
  .lab-collection {
    transition:
      opacity 0.18s,
      transform 0.24s;
  }
  .lab-collection[aria-busy='true'] {
    opacity: 0.55;
    transform: translateY(3px);
  }
  .lab-collection.grid .lab-card {
    animation: card-arrive 0.32s both;
    animation-delay: calc(var(--card-index, 0) * 35ms);
  }
  @keyframes card-arrive {
    from {
      opacity: 0.72;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .view-toggle button {
    padding: 0;
    width: 36px;
    flex: 0 0 36px;
    min-height: 36px;
    color: var(--lab-muted);
  }
  .view-toggle [aria-pressed='true'] {
    color: var(--lab-accent);
  }
  .lab-collection {
    display: grid;
    gap: 24px;
    margin-bottom: 24px;
  }
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
  }
  .list {
    grid-template-columns: 1fr;
  }
  .lab-card {
    position: relative;
    border: 1px solid var(--lab-line);
    border-radius: 18px;
    background: var(--lab-surface);
    min-width: 0;
    transition:
      transform 0.3s cubic-bezier(0.2, 0.7, 0.3, 1),
      box-shadow 0.3s,
      border-color 0.3s;
  }
  .lab-card:hover,
  .lab-card:focus-within {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px #24164518;
    border-color: color-mix(in srgb, var(--lab-accent) 28%, var(--lab-line));
    z-index: 1;
  }
  .cover {
    height: 205px;
    position: relative;
    overflow: hidden;
    border-radius: 17px 17px 0 0;
    background: var(--lab-input);
  }
  .cover > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.65s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .lab-card:hover .cover > img {
    transform: scale(1.045);
  }
  .cover:after {
    content: '';
    position: absolute;
    inset: 50% 0 0;
    background: linear-gradient(transparent, #0006);
    pointer-events: none;
  }
  .code,
  .status-badge,
  .hours {
    position: absolute;
    z-index: 1;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border-radius: 7px;
  }
  .code {
    top: 12px;
    left: 12px;
    background: #fffffff0;
    color: #34323b;
    font-weight: 600;
  }
  .status-badge {
    top: 12px;
    right: 12px;
    background: #eaf7ed;
    color: #216b3b;
    font-weight: 550;
  }
  .status-badge i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .status-badge.closed {
    color: #60616c;
    background: #eeeef2;
  }
  .hours {
    bottom: 12px;
    left: 12px;
    background: #111a;
    color: #fff;
  }
  .card-body {
    padding: 20px;
  }
  .card-body h2 {
    font-size: 17px;
    font-weight: 650;
    line-height: 1.5;
    margin-bottom: 10px;
    overflow-wrap: anywhere;
  }
  .lab-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 14px;
    font-size: 12px;
    color: var(--lab-muted);
  }
  .lab-meta span {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .description {
    color: var(--lab-muted);
    line-height: 1.85;
    font-size: 13px;
    margin: 14px 0 22px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 48px;
  }
  .card-body footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .card-body footer > span {
    font-size: 11px;
    color: var(--lab-muted);
  }
  .card-body .browse-actions {
    gap: 12px;
  }
  .browse-actions button {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    font-size: 13px;
  }
  .card-actions {
    display: flex;
    gap: 8px;
  }
  .card-actions button {
    font-size: 12px;
    min-height: 36px;
    padding: 0 11px;
  }
  .card-actions .icon-button {
    padding: 0;
    width: 36px;
  }
  .more-wrap {
    position: relative;
  }
  .more-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    width: 164px;
    background: var(--lab-surface);
    border: 1px solid var(--lab-line);
    box-shadow: 0 8px 25px #0002;
    border-radius: 12px;
    padding: 5px;
    z-index: 5;
  }
  .more-menu button {
    width: 100%;
    justify-content: flex-start;
    min-height: 42px;
  }
  .more-menu button:hover {
    background: var(--lab-input);
  }
  .danger {
    color: #e05265;
  }
  .list .cover {
    height: 250px;
  }
  .list .description {
    min-height: 0;
    -webkit-line-clamp: 3;
  }
  .no-image {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 9px;
    color: var(--lab-muted);
    font-size: 12px;
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px 24px;
    background: color-mix(in srgb, var(--lab-surface) 65%, var(--lab-input));
  }
  .pagination p {
    color: var(--lab-muted);
    font-size: 12px;
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
    height: 40px;
    min-width: 112px;
    padding: 0 14px;
    border: 1px solid var(--lab-line);
    border-radius: 11px;
    background: var(--lab-surface);
    color: var(--lab-ink);
    font-size: 12px;
    justify-content: space-between;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }
  .size-trigger:hover,
  .size-trigger[aria-expanded='true'] {
    border-color: var(--lab-accent);
    box-shadow: 0 3px 10px rgb(50 35 90 / 6%);
  }
  .size-trigger svg {
    transition: transform 0.2s;
    color: var(--lab-muted);
  }
  .size-trigger svg.rotated {
    transform: rotate(180deg);
  }
  .size-options {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 20;
    min-width: 142px;
    padding: 5px;
    border: 1px solid var(--lab-line);
    border-radius: 13px;
    background: var(--lab-surface);
    box-shadow: 0 8px 30px rgb(35 25 65 / 14%);
    transform-origin: bottom right;
  }
  .size-options button {
    width: 100%;
    min-height: 40px;
    padding: 0 11px;
    border-radius: 8px;
    justify-content: space-between;
    color: var(--lab-ink);
    font-size: 13px;
    transition: background 0.15s;
  }
  .size-options button:hover,
  .size-options button:focus-visible {
    background: var(--lab-input);
    outline-offset: -2px;
  }
  .size-options button[aria-selected='true'] {
    background: color-mix(in srgb, var(--lab-accent) 10%, var(--lab-surface));
    color: var(--lab-accent);
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
    background: var(--lab-input);
    border-radius: 12px;
  }
  .pagination nav button,
  .page-gap {
    display: grid;
    place-items: center;
    min-width: 34px;
    height: 34px;
    border-radius: 9px;
    color: var(--lab-muted);
    font-size: 13px;
    transition:
      background 0.18s,
      color 0.18s;
  }
  .pagination nav button:not(:disabled):hover {
    background: var(--lab-surface);
    color: var(--lab-accent);
  }
  .pagination nav button[aria-current='page'] {
    background: var(--lab-surface);
    color: var(--lab-ink);
    box-shadow: 0 2px 4px #20183108;
    font-weight: 600;
  }
  .empty {
    background: var(--lab-surface);
    border: 1px solid var(--lab-line);
    border-radius: 18px;
    min-height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 30px;
    text-align: center;
  }
  .empty-fill {
    flex: 1;
    min-height: 360px;
  }
  .empty > span {
    background: var(--lab-input);
    color: var(--lab-accent);
    width: 76px;
    height: 76px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    margin-bottom: 22px;
  }
  .empty h2 {
    font-size: 20px;
    font-weight: 600;
  }
  .empty p {
    color: var(--lab-muted);
    margin: 12px 0 24px;
  }
  .notice {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    color: var(--lab-accent);
  }
  .delete-confirm {
    margin: auto;
    background: var(--lab-surface);
    color: var(--lab-ink);
    border: 1px solid var(--lab-line);
    border-radius: 18px;
    padding: 28px;
    width: min(440px, calc(100vw - 32px));
  }
  .delete-confirm::backdrop {
    background: #0008;
    backdrop-filter: blur(3px);
  }
  .delete-confirm h2 {
    font-size: 20px;
    font-weight: 650;
  }
  .delete-confirm p {
    margin: 22px 0;
    line-height: 1.9;
  }
  .delete-confirm footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
  .delete-button {
    background: #c83244;
    color: white;
  }
  ::selection {
    background: #514def30;
  }
  @media (min-width: 1700px) {
    .cover {
      height: 230px;
    }
  }
  @media (max-width: 1100px) {
    .labs-page {
      padding: 28px 24px;
    }
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .toolbar {
      flex-wrap: wrap;
    }
    .search {
      max-width: none;
    }
    .stat-card {
      padding: 16px;
    }
    .stat-number {
      flex-wrap: wrap;
      gap: 3px 8px;
    }
  }
  @media (max-width: 700px) {
    .labs-page {
      padding: 22px 16px;
    }
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .stat-number strong {
      font-size: 30px;
    }
    .stat-title {
      font-size: 12px;
    }
    .stat-title > span {
      width: 30px;
      height: 30px;
    }
    h1 {
      font-size: 22px;
    }
    .primary {
      padding: 0 12px;
      font-size: 13px;
    }
    .toolbar {
      gap: 12px;
      margin-bottom: 20px;
    }
    .search {
      flex-basis: 100%;
    }
    .toolbar-right {
      width: 100%;
      justify-content: space-between;
      gap: 6px;
    }
    .filters button {
      padding: 0 9px;
      font-size: 12px;
    }
    .grid {
      grid-template-columns: 1fr;
    }
    .lab-collection {
      gap: 18px;
    }
    .cover,
    .list .cover {
      height: 210px;
    }
    .pagination {
      align-items: flex-start;
      flex-direction: column;
    }
    .pagination > div {
      width: 100%;
      justify-content: space-between;
    }
    .card-body {
      padding: 18px;
    }
    .stat-card p {
      font-size: 11px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
    .lab-card:hover {
      transform: none;
    }
    .lab-card:hover .cover > img {
      transform: none;
    }
  }
</style>
