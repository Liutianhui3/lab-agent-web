<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import {
    ArrowLeft,
    MapPin,
    Clock3,
    Building2,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    LayoutGrid,
    List,
    LoaderCircle,
    Microscope,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    SearchX,
    Trash2,
    UsersRound,
    Wrench,
    X
  } from 'lucide-vue-next'
  import { queryEquipment, removeEquipment, updateEquipment } from '@/api/equipment'
  import { queryLabInfo, queryLabs } from '@/api/lab'
  import EquipmentDrawer from './EquipmentDrawer.vue'
  import ReservationDialog from '@/components/ReservationDialog.vue'
  import { avatarUrl } from '@/utils/avatar'

  const props = defineProps({
    readOnly: { type: Boolean, default: false },
    labCode: { type: String, default: '' }
  })
  const labInfo = ref(null)
  const labExpanded = ref(false)
  const detailLoading = ref(false)
  const detailError = ref('')
  let detailVersion = 0

  async function loadDetail() {
    const current = ++detailVersion
    requestVersion++
    items.value = []
    total.value = 0
    labInfo.value = null
    labExpanded.value = false
    detailError.value = ''
    detailLoading.value = true
    try {
      if (!props.labCode.trim()) throw new Error('缺少实验室编号，请返回实验室列表重新选择。')
      const lab = await queryLabInfo(props.labCode)
      if (!active || current !== detailVersion) return
      if (!Number.isInteger(Number(lab.id)) || Number(lab.id) <= 0)
        throw new Error('实验室信息不完整，请稍后重试。')
      labInfo.value = lab
      labs.value = [lab]
      await load()
    } catch (reason) {
      if (active && current === detailVersion)
        detailError.value = message(reason, '实验室信息加载失败')
    } finally {
      if (active && current === detailVersion) {
        detailLoading.value = false
        loading.value = false
      }
    }
  }

  const items = ref([])
  const labs = ref([])
  const total = ref(0)
  const page = ref(1)
  const size = ref(6)
  const keyword = ref('')
  const status = ref('')
  const labId = ref('')
  const view = ref('grid')
  const loading = ref(true)
  const labsLoading = ref(true)
  const error = ref('')
  const labsError = ref('')
  const stats = ref({ total: 0, normal: 0, maintenance: 0, quantity: 0 })
  const drawer = ref(null)
  const menu = ref(null)
  const labPicker = ref(null)
  const labMenuOpen = ref(false)
  const deletion = ref(null)
  const deleting = ref(false)
  const confirmDialog = ref(null)
  const notice = ref('')
  const actionError = ref('')
  const reservationOpen = ref(false)
  const reservationEquipment = ref(null)
  function openReservation(equipment = null) {
    reservationEquipment.value = equipment
    reservationOpen.value = true
  }
  const sizeMenuOpen = ref(false)
  const statusControl = ref(null)
  const statusIndicator = ref({})
  const viewControl = ref(null)
  const viewIndicator = ref({})
  let requestVersion = 0
  let labsVersion = 0
  let searchTimer
  let active = true
  let controlsResizeObserver
  const pages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
  const pageNumbers = computed(() => {
    const values = [...new Set([1, page.value - 1, page.value, page.value + 1, pages.value])]
      .filter(value => value > 0 && value <= pages.value)
      .sort((a, b) => a - b)
    return values.flatMap((value, index) =>
      index && value - values[index - 1] > 1 ? [`gap-${value}`, value] : [value]
    )
  })
  const selectedLab = computed(() => labs.value.find(lab => String(lab.id) === labId.value))
  const statusFilters = computed(() => [
    { value: '', label: '全部', count: stats.value.total, tone: '' },
    { value: '1', label: '运行正常', count: stats.value.normal, tone: 'normal' },
    { value: '0', label: '维修检修', count: stats.value.maintenance, tone: 'repair' }
  ])

  function syncIndicator(container, target) {
    const selected = container?.querySelector('button[aria-pressed="true"]')
    if (!selected) return
    target.value = {
      width: `${selected.offsetWidth}px`,
      height: `${selected.offsetHeight}px`,
      transform: `translate(${selected.offsetLeft - 4}px, ${selected.offsetTop - 4}px)`
    }
  }

  function syncControls() {
    syncIndicator(statusControl.value, statusIndicator)
    syncIndicator(viewControl.value, viewIndicator)
  }

  async function loadLabs() {
    const current = ++labsVersion
    labsLoading.value = true
    labsError.value = ''
    try {
      const firstPage = await queryLabs({ page: 1, size: 100 })
      if (!active || current !== labsVersion) return
      const all = [...firstPage.items]
      const pagesCount = Math.ceil(firstPage.total / 100)
      if (pagesCount > 1) {
        const remaining = await Promise.all(
          Array.from({ length: pagesCount - 1 }, (_, index) =>
            queryLabs({ page: index + 2, size: 100 })
          )
        )
        if (!active || current !== labsVersion) return
        for (const result of remaining) all.push(...result.items)
      }
      labs.value = all
    } catch (reason) {
      if (!active || current !== labsVersion) return
      labs.value = []
      labsError.value = message(reason, '实验室列表加载失败')
    } finally {
      if (active && current === labsVersion) labsLoading.value = false
    }
  }

  async function load() {
    if (props.readOnly && !labInfo.value) return
    const current = ++requestVersion
    loading.value = true
    error.value = ''
    try {
      const result = await queryEquipment({
        page: page.value,
        size: size.value,
        keyword: keyword.value.trim(),
        lab_id: props.readOnly
          ? Number(labInfo.value.id)
          : labId.value
            ? Number(labId.value)
            : undefined,
        status: status.value === '' ? undefined : Number(status.value)
      })
      if (!active || current !== requestVersion) return
      items.value = result.items
      total.value = result.total
      stats.value = result.stats
      if (page.value > pages.value) {
        page.value = pages.value
        return
      }
    } catch (reason) {
      if (!active || current !== requestVersion) return
      items.value = []
      total.value = 0
      stats.value = { total: 0, normal: 0, maintenance: 0, quantity: 0 }
      error.value = message(reason, '设备列表加载失败')
    } finally {
      if (active && current === requestVersion) loading.value = false
    }
  }

  function message(reason, fallback) {
    if (typeof reason === 'string') return reason
    const data = reason?.response?.data
    return (
      reason?.message ||
      data?.message ||
      (typeof data?.detail === 'string' ? data.detail : '') ||
      fallback
    )
  }

  function search() {
    page.value = 1
    load()
  }

  watch(keyword, () => {
    requestVersion++
    clearTimeout(searchTimer)
    searchTimer = setTimeout(search, 300)
  })
  watch([status, labId, size], search)
  watch(page, load)
  watch([status, view, statusFilters], () => nextTick(syncControls), { flush: 'post' })

  function openCreate() {
    if (props.readOnly) return
    drawer.value.open(null, labs.value)
  }
  function openEdit(equipment) {
    if (props.readOnly) return
    drawer.value.open(equipment, labs.value)
  }
  function saved() {
    notice.value = '设备信息已保存'
    actionError.value = ''
    load()
  }
  function chooseLab(value) {
    labId.value = value
    labMenuOpen.value = false
  }
  function outsideMenu(event) {
    if (!labPicker.value?.contains(event.target)) labMenuOpen.value = false
    if (!event.target.closest('.equipment-more')) menu.value = null
    if (!event.target.closest('.size-picker')) sizeMenuOpen.value = false
  }
  async function toggleStatus(equipment) {
    if (props.readOnly) return
    menu.value = null
    actionError.value = ''
    try {
      await updateEquipment(equipment.id, { ...equipment, status: equipment.status === 1 ? 0 : 1 })
      notice.value = equipment.status === 1 ? '设备已标记为维修检修' : '设备已恢复正常'
      load()
    } catch (reason) {
      actionError.value = message(reason, '设备状态更新失败')
    }
  }
  async function askDelete(equipment) {
    if (props.readOnly) return
    menu.value = null
    deletion.value = equipment
    await nextTick()
    confirmDialog.value.showModal()
  }
  async function destroy() {
    if (props.readOnly) return
    if (!deletion.value || deleting.value) return
    deleting.value = true
    try {
      await removeEquipment(deletion.value.id)
      confirmDialog.value.close()
      deletion.value = null
      notice.value = '设备已删除'
      load()
    } catch (reason) {
      actionError.value = message(reason, '设备删除失败')
    } finally {
      deleting.value = false
    }
  }
  function clearFilters() {
    keyword.value = ''
    labId.value = ''
    status.value = ''
  }
  function setSize(value) {
    size.value = value
    sizeMenuOpen.value = false
  }
  onMounted(() => {
    if (props.readOnly) loadDetail()
    else {
      load()
      loadLabs()
    }
    controlsResizeObserver = new ResizeObserver(syncControls)
    if (statusControl.value) controlsResizeObserver.observe(statusControl.value)
    if (viewControl.value) controlsResizeObserver.observe(viewControl.value)
    nextTick(syncControls)
    document.addEventListener('pointerdown', outsideMenu)
  })
  onBeforeUnmount(() => {
    active = false
    detailVersion++
    controlsResizeObserver?.disconnect()
    requestVersion++
    labsVersion++
    clearTimeout(searchTimer)
    document.removeEventListener('pointerdown', outsideMenu)
  })
</script>

<template>
  <main class="equipment-page">
    <div class="equipment-wrap">
      <header class="page-heading" v-if="!readOnly">
        <div>
          <h1>设备管理</h1>
        </div>
        <button class="primary-button" :disabled="labsLoading || !!labsError" @click="openCreate">
          <Plus :size="18" />
          新增设备
        </button>
      </header>

      <section v-if="!readOnly" class="stats-grid" aria-label="设备统计">
        <article class="stat-card">
          <span class="stat-icon total"><Microscope :size="19" /></span>
          <div>
            <p>设备总数</p>
            <strong>{{ stats.total }}</strong>
            <small>项设备档案</small>
          </div>
        </article>
        <article class="stat-card">
          <span class="stat-icon normal"><Check :size="19" /></span>
          <div>
            <p>运行正常</p>
            <strong>{{ stats.normal }}</strong>
            <small>项可正常使用</small>
          </div>
        </article>
        <article class="stat-card">
          <span class="stat-icon repair"><Wrench :size="19" /></span>
          <div>
            <p>维修检修</p>
            <strong>{{ stats.maintenance }}</strong>
            <small>项暂停使用</small>
          </div>
        </article>
        <article class="stat-card">
          <span class="stat-icon quantity"><UsersRound :size="19" /></span>
          <div>
            <p>设备总数量</p>
            <strong>{{ stats.quantity }}</strong>
            <small>台 / 套</small>
          </div>
        </article>
      </section>

      <template v-if="readOnly">
        <header class="detail-heading">
          <RouterLink :to="{ name: 'laboratory-list' }" class="secondary-button">
            <ArrowLeft :size="17" />
            返回实验室列表
          </RouterLink>
          <h1>实验室设备</h1>
        </header>
        <div v-if="detailLoading" class="detail-feedback" role="status">
          <LoaderCircle :size="20" class="spin" />
          正在加载实验室信息…
        </div>
        <div v-else-if="detailError" class="inline-error" role="alert">
          <CircleAlert :size="18" />
          <span>{{ detailError }}</span>
          <button @click="loadDetail">重试</button>
        </div>
        <section v-else-if="labInfo" class="lab-summary">
          <button
            class="lab-summary-trigger"
            :aria-expanded="labExpanded"
            aria-controls="lab-detail-info"
            @click="labExpanded = !labExpanded"
          >
            <Building2 :size="22" />
            <h2>{{ labInfo.name }}</h2>
            <ChevronDown :size="20" :class="{ rotated: labExpanded }" />
          </button>
          <div
            id="lab-detail-info"
            class="lab-detail-collapse"
            :class="{ expanded: labExpanded }"
            :inert="!labExpanded"
            :aria-hidden="!labExpanded"
          >
            <div class="lab-detail-overflow">
              <div class="lab-detail-content">
                <img
                  v-if="labInfo.img"
                  :src="avatarUrl(labInfo.img)"
                  :alt="labInfo.name"
                  @error="labInfo.img = null"
                />
                <div class="lab-detail-copy">
                  <dl>
                    <div>
                      <dt>实验室编号</dt>
                      <dd>{{ labInfo.lab_code }}</dd>
                    </div>
                    <div>
                      <dt>
                        <MapPin :size="14" />
                        位置
                      </dt>
                      <dd>{{ labInfo.location || '暂无位置信息' }}</dd>
                    </div>
                    <div>
                      <dt>
                        <UsersRound :size="14" />
                        容纳人数
                      </dt>
                      <dd>{{ labInfo.capacity }} 人</dd>
                    </div>
                    <div>
                      <dt>
                        <Clock3 :size="14" />
                        开放时间
                      </dt>
                      <dd>
                        {{
                          labInfo.open_time && labInfo.close_time
                            ? `${labInfo.open_time}–${labInfo.close_time}`
                            : '暂未设置'
                        }}
                      </dd>
                    </div>
                    <div>
                      <dt>状态</dt>
                      <dd>{{ labInfo.status === 1 ? '开放中' : '已关闭' }}</dd>
                    </div>
                  </dl>
                  <p>{{ labInfo.description || '暂无实验室描述' }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template v-if="!readOnly || labInfo">
        <section class="equipment-toolbar" aria-label="设备筛选">
          <label class="search-field">
            <Search :size="18" />
            <input
              v-model="keyword"
              placeholder="搜索设备名称或编号"
              aria-label="搜索设备名称或编号"
            />
            <button v-if="keyword" type="button" aria-label="清空搜索" @click="keyword = ''">
              <X :size="15" />
            </button>
          </label>
          <div class="toolbar-actions">
            <div ref="statusControl" class="status-filters" role="group" aria-label="设备状态">
              <span class="status-indicator" :style="statusIndicator" aria-hidden="true" />
              <button
                v-for="filter in statusFilters"
                :key="filter.value"
                :aria-pressed="status === filter.value"
                @click="status = filter.value"
              >
                <i v-if="filter.tone" :class="filter.tone" />
                {{ filter.label }}
                <span v-if="!readOnly">{{ filter.count }}</span>
              </button>
            </div>
            <div v-if="!readOnly" ref="labPicker" class="lab-filter">
              <button
                class="lab-filter-trigger"
                type="button"
                :aria-expanded="labMenuOpen"
                aria-haspopup="listbox"
                :disabled="labsLoading || !!labsError"
                @click="labMenuOpen = !labMenuOpen"
              >
                <Building2 :size="18" />
                <span>
                  <strong>所属实验室：</strong>
                  {{ selectedLab ? selectedLab.name : '全部实验室' }}
                </span>
                <ChevronDown :size="16" :class="{ rotated: labMenuOpen }" />
              </button>
              <Transition name="dropdown">
                <div
                  v-if="labMenuOpen"
                  class="lab-filter-menu"
                  role="listbox"
                  aria-label="按所属实验室筛选"
                >
                  <button
                    type="button"
                    role="option"
                    :aria-selected="!labId"
                    @click="chooseLab('')"
                  >
                    <span class="lab-option-icon"><Building2 :size="16" /></span>
                    <span class="lab-option-copy">
                      <strong>全部实验室</strong>
                      <small>查看所有实验室的设备</small>
                    </span>
                    <Check v-if="!labId" :size="16" class="selected-check" />
                  </button>
                  <button
                    v-for="lab in labs"
                    :key="lab.id"
                    type="button"
                    role="option"
                    :aria-selected="labId === String(lab.id)"
                    @click="chooseLab(String(lab.id))"
                  >
                    <span class="lab-option-icon"><Building2 :size="16" /></span>
                    <span class="lab-option-copy">
                      <strong>{{ lab.name }}</strong>
                      <small>
                        {{ lab.lab_code }}
                        <template v-if="lab.location">· {{ lab.location }}</template>
                      </small>
                    </span>
                    <Check v-if="labId === String(lab.id)" :size="16" class="selected-check" />
                  </button>
                  <p v-if="!labs.length && !labsLoading" class="menu-empty">暂无实验室</p>
                </div>
              </Transition>
            </div>
            <div ref="viewControl" class="view-toggle" role="group" aria-label="显示方式">
              <span class="view-indicator" :style="viewIndicator" aria-hidden="true" />
              <button
                type="button"
                :aria-pressed="view === 'grid'"
                aria-label="卡片视图"
                @click="view = 'grid'"
              >
                <LayoutGrid :size="18" />
              </button>
              <button
                type="button"
                :aria-pressed="view === 'list'"
                aria-label="列表视图"
                @click="view = 'list'"
              >
                <List :size="18" />
              </button>
            </div>
          </div>
        </section>

        <div v-if="labsError" class="inline-error" role="alert">
          <CircleAlert :size="18" />
          <span>{{ labsError }}</span>
          <button @click="loadLabs">重试</button>
        </div>
        <div v-if="actionError" class="inline-error" role="alert">
          <CircleAlert :size="18" />
          <span>{{ actionError }}</span>
          <button @click="actionError = ''">关闭</button>
        </div>
        <p v-if="notice" class="notice" role="status">
          {{ notice }}
          <button aria-label="关闭提示" @click="notice = ''"><X :size="15" /></button>
        </p>

        <section v-if="loading && !items.length" class="loading-state" aria-live="polite">
          <LoaderCircle class="spin" :size="24" />
          <span>正在加载设备…</span>
        </section>
        <section v-else-if="error" class="empty-state">
          <CircleAlert :size="30" />
          <h2>设备列表加载失败</h2>
          <p>{{ error }}</p>
          <button class="secondary-button" @click="load">重试</button>
        </section>
        <section v-else-if="!items.length" class="empty-state empty-fill">
          <span class="empty-icon"><SearchX :size="28" /></span>
          <h2>{{ keyword || status || labId ? '没有匹配的设备' : '还没有设备' }}</h2>
          <p>
            {{
              keyword || status || labId
                ? '尝试调整搜索词或筛选条件。'
                : readOnly
                  ? '该实验室暂无设备。'
                  : '新增第一项设备档案，开始管理实验室仪器。'
            }}
          </p>
          <button v-if="keyword || status || labId" class="secondary-button" @click="clearFilters">
            清除筛选
          </button>
          <button
            v-else-if="!readOnly"
            class="primary-button"
            :disabled="labsLoading || !!labsError"
            @click="openCreate"
          >
            <Plus :size="17" />
            新增设备
          </button>
        </section>

        <section v-else class="equipment-grid" :class="view" :aria-busy="loading">
          <article v-for="equipment in items" :key="equipment.id" class="equipment-card">
            <div class="equipment-cover">
              <img
                v-if="equipment.img"
                :src="avatarUrl(equipment.img)"
                :alt="equipment.name"
                loading="lazy"
                @error="equipment.img = null"
              />
              <div v-else class="cover-placeholder">
                <Microscope :size="34" />
                <span>暂无设备图片</span>
              </div>
              <span class="equipment-code">{{ equipment.code }}</span>
              <span class="equipment-status" :class="{ repair: equipment.status === 0 }">
                <i />
                {{ equipment.status === 1 ? '运行正常' : '维修检修' }}
              </span>
            </div>
            <div class="equipment-body">
              <div class="equipment-title-row">
                <div>
                  <h2>{{ equipment.name }}</h2>
                  <p v-if="equipment.sepc" class="specification">{{ equipment.sepc }}</p>
                </div>
              </div>
              <div class="equipment-lab">
                <Building2 :size="16" />
                <span>
                  {{
                    labs.find(lab => lab.id === equipment.lab_id)?.name ||
                    `实验室 ${equipment.lab_id}`
                  }}
                </span>
              </div>
              <p class="equipment-description">{{ equipment.description || '暂无设备说明' }}</p>
              <footer>
                <span>
                  数量
                  <strong>{{ equipment.quantity }}</strong>
                </span>
                <div v-if="readOnly && equipment.status === 1" class="equipment-actions">
                  <button class="primary-button" type="button" @click="openReservation(equipment)">预约</button>
                </div>
                <div v-else-if="!readOnly" class="equipment-actions">
                  <button class="edit-button" @click="openEdit(equipment)">
                    <Pencil :size="15" />
                    编辑
                  </button>
                  <div class="equipment-more">
                    <button
                      class="icon-action"
                      type="button"
                      :aria-label="`${equipment.name}更多操作`"
                      :aria-expanded="menu === equipment.id"
                      @click.stop="menu = menu === equipment.id ? null : equipment.id"
                    >
                      <MoreHorizontal :size="19" />
                    </button>
                    <div v-if="menu === equipment.id" class="more-menu">
                      <button @click="toggleStatus(equipment)">
                        <Wrench :size="15" />
                        {{ equipment.status === 1 ? '标记为维修' : '恢复正常' }}
                      </button>
                      <button class="danger" @click="askDelete(equipment)">
                        <Trash2 :size="15" />
                        删除设备
                      </button>
                    </div>
                  </div>
                </div>
              </footer>
            </div>
          </article>
        </section>

        <footer v-if="total && !error" class="pagination">
          <p>
            显示 {{ (page - 1) * size + 1 }}–{{ Math.min(page * size, total) }} 条，共
            {{ total }} 项设备
          </p>
          <div class="pagination-controls">
            <div class="size-picker">
              <button
                class="size-trigger"
                type="button"
                :aria-expanded="sizeMenuOpen"
                @click="sizeMenuOpen = !sizeMenuOpen"
              >
                {{ size }} 条/页
                <ChevronDown :size="16" />
              </button>
              <div v-if="sizeMenuOpen" class="size-options">
                <button
                  v-for="option in [6, 12, 24]"
                  :key="option"
                  type="button"
                  :aria-selected="size === option"
                  @click="setSize(option)"
                >
                  {{ option }} 条/页
                  <Check v-if="size === option" :size="15" />
                </button>
              </div>
            </div>
            <nav aria-label="设备分页">
              <button aria-label="上一页" :disabled="page <= 1 || loading" @click="page--">
                <ChevronLeft :size="17" />
              </button>
              <template v-for="number in pageNumbers" :key="number">
                <span v-if="String(number).startsWith('gap-')" class="page-gap">…</span>
                <button
                  v-else
                  :aria-current="page === number ? 'page' : undefined"
                  :disabled="loading"
                  @click="page = number"
                >
                  {{ number }}
                </button>
              </template>
              <button aria-label="下一页" :disabled="page >= pages || loading" @click="page++">
                <ChevronRight :size="17" />
              </button>
            </nav>
          </div>
        </footer>
      </template>
    </div>

    <EquipmentDrawer v-if="!readOnly" ref="drawer" :key="labs.length" @saved="saved" />
    <ReservationDialog v-if="readOnly && labInfo" :open="reservationOpen" :lab="labInfo" :equipment="reservationEquipment" @close="reservationOpen = false" @success="notice = '预约提交成功，等待审核'" />
    <dialog
      v-if="!readOnly"
      ref="confirmDialog"
      class="delete-dialog"
      @click="event => event.target === confirmDialog && confirmDialog.close()"
    >
      <h2>删除设备</h2>
      <p>
        确定删除「{{ deletion?.name }}」吗？
        <br />
        删除后无法恢复。
      </p>
      <footer>
        <button class="secondary-button" @click="confirmDialog.close()">取消</button>
        <button class="delete-button" :disabled="deleting" @click="destroy">
          {{ deleting ? '正在删除…' : '确认删除' }}
        </button>
      </footer>
    </dialog>
  </main>
</template>

<style scoped>
  .detail-heading {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 22px;
    flex-wrap: wrap;
  }
  .detail-heading h1 {
    margin: 0;
  }
  .detail-heading a {
    text-decoration: none;
  }
  .detail-feedback {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--muted);
    padding: 24px 0;
  }
  .lab-summary {
    margin-bottom: 22px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  .lab-summary-trigger {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 14px;
    padding: 20px 24px;
    text-align: left;
    color: var(--ink);
    border-radius: 14px;
  }
  .lab-summary-trigger > svg:first-child {
    color: var(--accent);
    flex: none;
  }
  .lab-summary-trigger h2 {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 19px;
    font-weight: 650;
  }
  .lab-summary-trigger > svg:last-child {
    flex: none;
    transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .lab-summary-trigger .rotated {
    transform: rotate(180deg);
  }
  .lab-detail-collapse {
    display: grid;
    grid-template-rows: 0fr;
    visibility: hidden;
    transition:
      grid-template-rows 300ms cubic-bezier(0.16, 1, 0.3, 1),
      visibility 300ms;
  }
  .lab-detail-collapse.expanded {
    grid-template-rows: 1fr;
    visibility: visible;
  }
  .lab-detail-overflow {
    min-height: 0;
    overflow: hidden;
  }
  .lab-detail-content {
    display: flex;
    gap: 24px;
    padding: 0 24px 24px;
  }
  .lab-detail-content > img {
    width: 220px;
    height: 155px;
    object-fit: cover;
    border-radius: 10px;
    flex: none;
  }
  .lab-detail-copy {
    flex: 1;
    min-width: 0;
  }
  .lab-detail-copy dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 24px;
  }
  .lab-detail-copy dt {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 5px;
  }
  .lab-detail-copy dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .lab-detail-copy p {
    margin-top: 18px;
    color: var(--muted);
    line-height: 1.8;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  @media (max-width: 640px) {
    .lab-summary-trigger {
      padding: 18px;
    }
    .lab-detail-content {
      flex-direction: column;
      padding: 0 18px 18px;
      gap: 18px;
    }
    .lab-detail-content > img {
      width: 100%;
      height: 180px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lab-detail-collapse,
    .lab-summary-trigger > svg:last-child {
      transition-duration: 0.01ms;
    }
  }

  .equipment-page {
    --bg: #f8f9fc;
    --surface: #fff;
    --field: #f5f4f9;
    --ink: #25232d;
    --muted: #716d80;
    --line: #e9e7f0;
    --accent: #514def;
    min-height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 30px 36px 42px;
    background: var(--bg);
    color: var(--ink);
    font-size: 14px;
  }
  :global(#main-content:has(.equipment-page)) {
    scrollbar-width: none;
  }
  :global(#main-content:has(.equipment-page)::-webkit-scrollbar) {
    display: none;
  }
  :global(html.dark .equipment-page) {
    --bg: #000;
    --surface: #19191b;
    --field: #101012;
    --ink: #f2f0f8;
    --muted: #b6b1c6;
    --line: #35343f;
    --accent: #a78bfa;
  }
  .equipment-wrap {
    width: min(100%, 1440px);
    flex: 1;
    display: flex;
    flex-direction: column;
    margin: 0 auto;
  }
  .page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 22px;
  }
  .eyebrow {
    color: var(--accent);
    font-size: 11px;
    font-weight: 650;
  }
  h1 {
    margin-top: 4px;
    font-size: 25px;
    font-weight: 650;
  }
  button {
    font: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .primary-button,
  .secondary-button {
    display: inline-flex;
    min-height: 42px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 15px;
    border-radius: 9px;
    font-weight: 550;
  }
  .primary-button {
    background: #514def;
    color: #fff;
  }
  .equipment-actions .primary-button {
    min-height: 32px;
    min-width: 104px;
    padding: 0 20px;
    font-size: 11px;
  }
  .primary-button:hover:not(:disabled) {
    background: #4540d9;
  }
  .secondary-button {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink);
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 22px;
  }
  .stat-card {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 13px;
    padding: 17px 19px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
  }
  .stat-icon {
    display: grid;
    width: 40px;
    height: 40px;
    flex: none;
    place-items: center;
    border-radius: 10px;
  }
  .stat-icon.total {
    background: #eef0ff;
    color: #514def;
  }
  .stat-icon.normal {
    background: #e9f6ed;
    color: #27804b;
  }
  .stat-icon.repair {
    background: #fff2df;
    color: #a96400;
  }
  .stat-icon.quantity {
    background: #eaf5f5;
    color: #267878;
  }
  .stat-card p {
    color: var(--muted);
    font-size: 12px;
  }
  .stat-card strong {
    display: inline-block;
    margin: 3px 7px 1px 0;
    font-size: 25px;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }
  .stat-card small {
    color: var(--muted);
    font-size: 11px;
  }
  .equipment-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 20px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--surface);
  }
  .search-field {
    display: flex;
    min-width: 210px;
    max-width: 360px;
    height: 42px;
    flex: 1;
    align-items: center;
    gap: 9px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: var(--field);
    color: var(--muted);
  }
  .search-field:focus-within {
    border-color: var(--accent);
  }
  .search-field input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--ink);
  }
  .search-field button {
    display: grid;
    width: 28px;
    height: 28px;
    flex: none;
    place-items: center;
    color: var(--muted);
  }
  .toolbar-actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 9px;
  }
  .status-filters,
  .view-toggle {
    position: relative;
    display: flex;
    flex: none;
    align-items: center;
    gap: 3px;
    padding: 4px;
    border-radius: 10px;
    background: var(--field);
    isolation: isolate;
  }
  .status-indicator,
  .view-indicator {
    position: absolute;
    z-index: 0;
    top: 4px;
    left: 4px;
    border-radius: 8px;
    background: var(--surface);
    box-shadow: 0 2px 5px #20183c10;
    pointer-events: none;
    transition:
      transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
      width 0.32s cubic-bezier(0.2, 0.8, 0.2, 1),
      height 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .status-filters button,
  .view-toggle button {
    position: relative;
    z-index: 1;
  }
  .status-filters button {
    display: flex;
    min-height: 34px;
    align-items: center;
    gap: 6px;
    padding: 0 9px;
    border-radius: 7px;
    color: var(--muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .status-filters button[aria-pressed='true'] {
    color: var(--ink);
  }
  .status-filters button span {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .status-filters i,
  .equipment-status i {
    width: 7px;
    height: 7px;
    flex: none;
    border-radius: 50%;
    background: #29804b;
  }
  .status-filters i.repair {
    background: #a96400;
  }
  .lab-filter {
    position: relative;
    flex: none;
  }
  .lab-filter-trigger {
    display: flex;
    min-height: 42px;
    max-width: 320px;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface);
    color: var(--ink);
    font-size: 13px;
  }
  .lab-filter-trigger > span {
    overflow: hidden;
    color: var(--ink);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lab-filter-trigger strong {
    font-weight: 550;
  }
  .lab-filter-trigger > svg:first-child {
    flex: none;
    color: #52515f;
  }
  .lab-filter-trigger > svg:last-child {
    flex: none;
    color: var(--muted);
    transition: transform 0.18s;
  }
  .lab-filter-trigger > svg.rotated {
    transform: rotate(180deg);
  }
  .lab-filter-menu,
  .size-options {
    position: absolute;
    z-index: 40;
    top: calc(100% + 8px);
    right: 0;
    width: min(360px, calc(100vw - 36px));
    max-height: 340px;
    overflow: auto;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: var(--surface);
    box-shadow: 0 14px 34px #17132320;
  }
  .lab-filter-menu button {
    display: flex;
    width: 100%;
    min-height: 52px;
    align-items: center;
    gap: 9px;
    padding: 7px;
    border-radius: 8px;
    color: var(--ink);
    text-align: left;
  }
  .lab-filter-menu button:hover,
  .lab-filter-menu button[aria-selected='true'] {
    background: var(--field);
  }
  .lab-option-icon {
    display: grid;
    width: 32px;
    height: 32px;
    flex: none;
    place-items: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 10%, var(--field));
    color: var(--accent);
  }
  .lab-option-copy {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 3px;
  }
  .lab-option-copy strong {
    overflow: hidden;
    font-size: 12px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lab-option-copy small {
    overflow: hidden;
    color: var(--muted);
    font-size: 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .selected-check {
    flex: none;
    color: var(--accent);
  }
  .menu-empty {
    padding: 14px;
    color: var(--muted);
    font-size: 12px;
    text-align: center;
  }
  .dropdown-enter-active,
  .dropdown-leave-active {
    transition:
      opacity 0.14s,
      transform 0.14s;
  }
  .dropdown-enter-from,
  .dropdown-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
  .view-toggle button {
    display: grid;
    width: 34px;
    height: 34px;
    flex: none;
    place-items: center;
    border-radius: 7px;
    color: var(--muted);
  }
  .view-toggle button[aria-pressed='true'] {
    color: var(--accent);
  }
  .inline-error,
  .notice {
    display: flex;
    align-items: center;
    gap: 9px;
    margin: 0 0 14px;
    padding: 11px 13px;
    border-radius: 9px;
    font-size: 12px;
  }
  .inline-error {
    background: #fff1f1;
    color: #a8303e;
  }
  .inline-error span {
    flex: 1;
  }
  .inline-error button {
    color: inherit;
    text-decoration: underline;
  }
  .notice {
    justify-content: space-between;
    background: color-mix(in srgb, var(--accent) 8%, var(--surface));
    color: var(--accent);
  }
  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 22px;
    transition: opacity 0.16s;
  }
  .equipment-grid[aria-busy='true'] {
    opacity: 0.58;
  }
  .equipment-card {
    position: relative;
    min-width: 0;
    overflow: visible;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }
  .equipment-cover {
    position: relative;
    height: 190px;
    overflow: hidden;
    border-radius: 13px 13px 0 0;
    background: var(--field);
  }
  .equipment-cover > img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.65s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .equipment-card:hover .equipment-cover > img {
    transform: scale(1.045);
  }
  .cover-placeholder {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 8px;
    color: var(--muted);
    font-size: 12px;
  }
  .equipment-code,
  .equipment-status {
    position: absolute;
    top: 11px;
    display: flex;
    min-height: 28px;
    align-items: center;
    gap: 6px;
    padding: 0 9px;
    border-radius: 7px;
    background: #ffffffed;
    color: #34323b;
    font-size: 10px;
    font-weight: 600;
  }
  .equipment-code {
    left: 11px;
  }
  .equipment-status {
    right: 11px;
    background: #e9f6ed;
    color: #267444;
  }
  .equipment-status.repair {
    background: #fff1dc;
    color: #9c5e00;
  }
  .equipment-status.repair i {
    background: currentColor;
  }
  .equipment-body {
    padding: 17px;
  }
  .equipment-title-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .equipment-title-row h2 {
    overflow-wrap: anywhere;
    font-size: 16px;
    font-weight: 650;
    line-height: 1.45;
  }
  .specification {
    margin-top: 4px;
    color: var(--muted);
    font-size: 11px;
  }
  .equipment-more {
    position: relative;
    flex: none;
  }
  .icon-action {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: 8px;
    background: var(--field);
    color: var(--ink);
  }
  .more-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 5px);
    right: 0;
    width: 152px;
    padding: 5px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--surface);
    box-shadow: 0 8px 24px #17132320;
  }
  .more-menu button {
    display: flex;
    width: 100%;
    min-height: 37px;
    align-items: center;
    gap: 8px;
    padding: 0 9px;
    border-radius: 6px;
    color: var(--ink);
    text-align: left;
    font-size: 11px;
  }
  .more-menu button:hover {
    background: var(--field);
  }
  .more-menu button.danger {
    color: #c63d4d;
  }
  .equipment-lab {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 11px;
    color: var(--muted);
    font-size: 11px;
  }
  .equipment-lab span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .equipment-description {
    min-height: 41px;
    margin: 14px 0 16px;
    overflow: hidden;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.7;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .equipment-body footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 13px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 11px;
  }
  .equipment-body footer strong {
    margin-left: 4px;
    color: var(--ink);
    font-size: 14px;
  }
  .equipment-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .edit-button {
    display: flex;
    min-height: 32px;
    align-items: center;
    gap: 6px;
    padding: 0 9px;
    border-radius: 7px;
    background: var(--field);
    color: var(--ink);
    font-size: 11px;
  }
  .equipment-grid.list {
    grid-template-columns: 1fr;
  }
  .equipment-grid.list .equipment-card {
    display: grid;
    grid-template-columns: minmax(200px, 280px) minmax(0, 1fr);
  }
  @media (prefers-reduced-motion: reduce) {
    .equipment-card,
    .equipment-cover > img {
      transition: none;
    }
    .equipment-card:hover,
    .equipment-card:hover .equipment-cover > img {
      transform: none;
    }
  }
  .equipment-grid.list .equipment-cover {
    height: 100%;
    min-height: 200px;
    border-radius: 13px 0 0 13px;
  }
  .equipment-grid.list .equipment-body {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }
  .equipment-grid.list .equipment-description {
    flex: 1;
  }
  .empty-state,
  .loading-state {
    display: flex;
    min-height: 320px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 28px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    text-align: center;
  }
  .empty-fill {
    flex: 1;
    min-height: 320px;
    margin-bottom: 0;
  }
  .empty-icon {
    display: grid;
    width: 58px;
    height: 58px;
    place-items: center;
    border-radius: 16px;
    background: var(--field);
    color: var(--accent);
  }
  .empty-state h2 {
    margin-top: 15px;
    font-size: 17px;
    font-weight: 600;
  }
  .empty-state p {
    margin: 8px 0 17px;
    color: var(--muted);
    font-size: 12px;
  }
  .empty-state > svg {
    color: #bd4552;
  }
  .loading-state {
    flex-direction: row;
    gap: 10px;
    color: var(--muted);
  }
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .pagination {
    display: flex;
    min-height: 76px;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 15px 20px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
  }
  .pagination > p {
    color: var(--muted);
    font-size: 11px;
  }
  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 13px;
  }
  .size-picker {
    position: relative;
  }
  .size-trigger {
    display: flex;
    min-width: 102px;
    min-height: 36px;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    color: var(--ink);
    font-size: 11px;
  }
  .size-options {
    top: auto;
    bottom: calc(100% + 6px);
    width: 120px;
  }
  .size-options button {
    display: flex;
    width: 100%;
    min-height: 34px;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 11px;
  }
  .size-options button:hover {
    background: var(--field);
  }
  .pagination nav {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 3px;
    border-radius: 8px;
    background: var(--field);
  }
  .pagination nav button {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 6px;
    color: var(--muted);
    font-size: 11px;
  }
  .pagination nav button[aria-current='page'] {
    background: var(--surface);
    color: var(--accent);
    box-shadow: 0 1px 3px #17132312;
  }
  .page-gap {
    padding: 0 4px;
    color: var(--muted);
  }
  .delete-dialog {
    width: min(420px, calc(100vw - 32px));
    margin: auto;
    padding: 24px;
    border: 1px solid var(--line);
    border-radius: 13px;
    background: var(--surface);
    color: var(--ink);
  }
  .delete-dialog::backdrop {
    background: #0008;
    backdrop-filter: blur(3px);
  }
  .delete-dialog h2 {
    font-size: 18px;
    font-weight: 650;
  }
  .delete-dialog p {
    margin: 17px 0;
    line-height: 1.8;
    font-size: 13px;
  }
  .delete-dialog footer {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
  }
  .delete-button {
    min-height: 40px;
    padding: 0 14px;
    border-radius: 8px;
    background: #c83244;
    color: #fff;
  }
  @media (max-width: 1200px) {
    .equipment-page {
      padding: 26px 24px;
    }
    .stats-grid {
      gap: 10px;
    }
    .stat-card {
      padding: 14px;
    }
    .equipment-toolbar {
      align-items: flex-start;
      flex-direction: column;
    }
    .search-field {
      max-width: none;
      width: 100%;
    }
    .toolbar-actions {
      width: 100%;
      justify-content: space-between;
    }
    .equipment-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 700px) {
    .equipment-page {
      padding: 20px 15px 30px;
    }
    .page-heading {
      margin-bottom: 17px;
    }
    .page-heading h1 {
      font-size: 22px;
    }
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }
    .stat-card {
      gap: 9px;
      padding: 12px 10px;
    }
    .stat-icon {
      width: 34px;
      height: 34px;
    }
    .stat-card strong {
      font-size: 21px;
    }
    .stat-card small {
      display: block;
    }
    .equipment-toolbar {
      gap: 9px;
      padding: 9px;
      margin-bottom: 15px;
    }
    .toolbar-actions {
      flex-wrap: wrap;
      gap: 7px;
    }
    .status-filters {
      flex: 1;
      justify-content: space-between;
    }
    .status-filters button {
      gap: 4px;
      padding: 0 6px;
      font-size: 10px;
    }
    .lab-filter {
      order: 3;
      flex: 1;
    }
    .lab-filter-trigger {
      width: 100%;
      max-width: none;
      min-height: 38px;
      font-size: 13px;
    }
    .view-toggle {
      margin-left: auto;
    }
    .equipment-grid {
      grid-template-columns: 1fr;
      gap: 14px;
    }
    .equipment-cover {
      height: 190px;
    }
    .equipment-grid.list .equipment-card {
      display: block;
    }
    .equipment-grid.list .equipment-cover {
      height: 190px;
      border-radius: 13px 13px 0 0;
    }
    .pagination {
      align-items: flex-start;
      flex-direction: column;
      padding: 14px;
    }
    .pagination-controls {
      width: 100%;
      justify-content: space-between;
    }
    .pagination nav {
      gap: 1px;
    }
    .pagination nav button {
      width: 29px;
      height: 30px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
</style>
