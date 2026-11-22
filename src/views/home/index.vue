<script setup>
  import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
  import {
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    CalendarDays,
    Clock3,
    FlaskConical,
    Microscope,
    RefreshCw,
    Sparkles
  } from 'lucide-vue-next'
  import { queryLabs } from '@/api/lab'
  import { queryEquipment } from '@/api/equipment'
  import { queryReservations } from '@/api/reservation'
  import SnowfallBackground from '@/components/SnowfallBackground.vue'
  import ReservationDialog from '@/components/ReservationDialog.vue'
  import { useUserInfo } from '@/composables/useUserInfo'
  import ResourceCard from './components/ResourceCard.vue'
  import ReservationTrend from './components/ReservationTrend.vue'
  import { useLiquidGlass } from './composables/useLiquidGlass'

  const { map, track } = useLiquidGlass()

  const { userInfo } = useUserInfo()
  const account = computed(() => userInfo.value.name || '')
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      hourCycle: 'h23'
    }).format(new Date())
  )
  const salutation =
    hour >= 5 && hour < 11 ? '早上好' : hour >= 11 && hour < 18 ? '中午好' : '晚上好'
  const greeting = computed(() => (account.value ? `${salutation}，${account.value}` : salutation))
  const visibleGreeting = ref(null)
  let greetingTimer
  watch(
    greeting,
    title => {
      clearInterval(greetingTimer)
      visibleGreeting.value = null
      if (!account.value) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const characters = Array.from(title)
      let count = 1
      visibleGreeting.value = characters[0]
      greetingTimer = setInterval(
        () => {
          visibleGreeting.value = characters.slice(0, ++count).join('')
          if (count >= characters.length) {
            clearInterval(greetingTimer)
            visibleGreeting.value = null
          }
        },
        Math.min(70, 1500 / characters.length)
      )
    },
    { immediate: true }
  )
  onBeforeUnmount(() => clearInterval(greetingTimer))

  const admin = computed(() => userInfo.value.role === 'admin')
  const labPath = computed(() => (admin.value ? '/laboratories' : '/laboratory-list'))
  const date = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  }).format(new Date())
  const labData = shallowRef()
  const equipmentData = shallowRef()
  const reservations = shallowRef()
  const failures = ref([])
  const loading = ref(true)
  const resource = ref('labs')
  const period = ref(7)
  const trend = shallowRef()
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
  const fullRange = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today + 'T00:00:00Z')
    date.setUTCDate(date.getUTCDate() - (29 - index))
    return date.toISOString().slice(0, 10)
  })
  const trendDays = computed(() => trend.value?.slice(-period.value))

  async function readTrend(firstPage) {
    const counts = new Map(fullRange.map(date => [date, { date, total: 0, approved: 0 }]))
    let result = firstPage
    let page = 1
    while (!disposed) {
      for (const reservation of result.items) {
        const day = counts.get(reservation.date)
        if (!day) continue
        day.total++
        if (Number(reservation.status) === 1) day.approved++
      }
      if (
        !result.items.length ||
        page * 100 >= result.total ||
        result.items.at(-1).date < fullRange[0]
      )
        break
      result = await queryReservations({ size: 100, page: ++page })
    }
    if (!disposed) trend.value = [...counts.values()]
  }
  const selected = shallowRef(null)
  const notice = ref('')
  let disposed = false

  const sources = [
    { label: '实验室', target: labData, read: () => queryLabs({ size: 4 }) },
    { label: '设备', target: equipmentData, read: () => queryEquipment({ size: 4 }) },
    { label: '预约', target: reservations, read: () => queryReservations({ size: 100 }) }
  ]
  async function refresh() {
    loading.value = true
    const failed = []
    await Promise.all(
      sources.map(async ({ label, target, read }) => {
        try {
          const result = await read()
          if (disposed) return
          target.value = result
          if (target === reservations) {
            try {
              await readTrend(result)
            } catch {
              failed.push('预约趋势')
            }
          }
        } catch {
          failed.push(label)
        }
      })
    )
    if (!disposed) {
      failures.value = failed
      loading.value = false
    }
  }
  onMounted(refresh)
  onBeforeUnmount(() => {
    disposed = true
  })

  const metrics = computed(() => [
    {
      label: '实验室',
      value: labData.value?.stats.total,
      detail: labData.value && `开放 ${labData.value.stats.open} 间`,
      icon: FlaskConical,
      tone: 'violet'
    },
    {
      label: '设备档案',
      value: equipmentData.value?.stats.total,
      detail: equipmentData.value && `正常 ${equipmentData.value.stats.normal} 项`,
      icon: Microscope,
      tone: 'teal'
    },
    {
      label: admin.value ? '全部预约' : '我的预约',
      value: reservations.value?.total,
      detail: reservations.value && `已通过 ${reservations.value.approved_count} 项`,
      icon: CalendarDays,
      tone: 'blue'
    },
    {
      label: '待审核',
      value: reservations.value?.pending_count,
      detail: '预约申请',
      icon: Clock3,
      tone: 'amber'
    }
  ])
  const statuses = [
    { label: '待审核', color: 'var(--amber)', key: 'pending_count' },
    { label: '已通过', color: 'var(--teal)', key: 'approved_count' },
    { label: '未通过', color: 'var(--rose)', key: 'rejected_count' },
    { label: '已取消', color: 'var(--muted)', key: 'cancelled_count' }
  ]
  const recent = computed(() => reservations.value?.items.slice(0, 5) ?? [])
  const resources = computed(
    () => (resource.value === 'labs' ? labData.value : equipmentData.value)?.items
  )
  const displayCount = value => (value == null ? '—' : Number(value).toLocaleString('zh-CN'))
  const animatedCounts = ref([])
  let countFrame
  watch(
    () => metrics.value.map(metric => metric.value),
    (values, previous) => {
      if (values.every((value, index) => value === previous?.[index])) return
      cancelAnimationFrame(countFrame)
      const start = values.map((value, index) =>
        value == null ? null : (animatedCounts.value[index] ?? 0)
      )
      if (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        values.every((value, index) => value == null || value === start[index])
      ) {
        animatedCounts.value = values
        return
      }
      animatedCounts.value = start
      const began = performance.now()
      function tick(now) {
        const progress = Math.min(1, (now - began) / 850)
        const eased = 1 - (1 - progress) ** 3
        animatedCounts.value = values.map((value, index) =>
          value == null ? null : Math.round(start[index] + (value - start[index]) * eased)
        )
        if (progress < 1) countFrame = requestAnimationFrame(tick)
      }
      countFrame = requestAnimationFrame(tick)
    }
  )
  onBeforeUnmount(() => cancelAnimationFrame(countFrame))
  const time = value => value?.slice(0, 5) || '—'

  function submitted() {
    notice.value = '预约已提交，等待审核。'
    refresh()
  }
</script>

<template>
  <div class="workbench" @pointermove.passive="track">
    <svg class="glass-filters" aria-hidden="true">
      <defs>
        <filter
          id="workbench-refraction"
          x="0"
          y="0"
          width="100%"
          height="100%"
          color-interpolation-filters="sRGB"
        >
          <feImage
            v-if="map"
            :href="map"
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="rim"
          />
          <feDisplacementMap
            v-if="map"
            in="SourceGraphic"
            in2="rim"
            scale="22"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
    <div class="snow"><SnowfallBackground /></div>
    <div class="dashboard">
      <section class="glass-panel liquid-card overview" aria-labelledby="workbench-title">
        <div class="overview-top">
          <div>
            <p class="date">
              <span></span>
              {{ date }}
            </p>
            <h1 id="workbench-title" :aria-label="greeting">
              <span v-if="visibleGreeting !== null" class="greeting-measure" aria-hidden="true">
                {{ greeting }}
              </span>
              <span aria-hidden="true">{{ visibleGreeting ?? greeting }}</span>
            </h1>
            <p class="welcome">查看实验资源和预约进度。</p>
          </div>
          <nav class="actions" aria-label="工作台快捷入口">
            <RouterLink :to="admin ? '/reviews' : labPath" class="action primary">
              <CalendarDays :size="17" />
              {{ admin ? '处理预约' : '发起预约' }}
              <ArrowUpRight :size="15" />
            </RouterLink>
            <RouterLink to="/assistant" class="action">
              <Sparkles :size="17" />
              咨询 AI 助手
            </RouterLink>
          </nav>
        </div>

        <p v-if="failures.length" class="message" role="status">
          {{ failures.join('、') }}数据暂未更新，可刷新重试。
        </p>
        <p v-else-if="notice" class="message" role="status">{{ notice }}</p>
      </section>

      <dl class="metrics">
        <div v-for="(metric, index) in metrics" :key="metric.label" class="metric liquid-card">
          <component
            :is="metric.icon"
            :size="21"
            class="metric-icon"
            :class="metric.tone"
            aria-hidden="true"
          />
          <div>
            <dt>{{ metric.label }}</dt>
            <dd>
              <span aria-hidden="true">{{ displayCount(animatedCounts[index]) }}</span>
              <span class="sr-only">{{ displayCount(metric.value) }}</span>
              <small v-if="metric.detail">{{ metric.detail }}</small>
            </dd>
          </div>
        </div>
      </dl>
      <div class="operations">
        <section class="glass-panel liquid-card chart" aria-labelledby="chart-title">
          <header class="panel-head">
            <div>
              <p class="section-mark">
                <ArrowDownRight :size="13" />
                数据总览
              </p>
              <h2 id="chart-title">预约趋势</h2>
            </div>
            <div class="switcher" role="group" aria-label="统计时间范围">
              <button
                v-for="days in [7, 30]"
                :key="days"
                type="button"
                :aria-pressed="period === days"
                @click="period = days"
              >
                近{{ days }}天
              </button>
            </div>
          </header>
          <ReservationTrend v-if="trendDays" :key="period" :days="trendDays" />
          <p v-else class="placeholder">{{ loading ? '正在读取趋势…' : '暂时无法读取趋势' }}</p>
          <footer class="panel-foot">{{ admin ? '全部用户' : '当前账号' }} · 按预约日期统计</footer>
        </section>

        <section class="glass-panel liquid-card activity" aria-labelledby="activity-title">
          <header class="panel-head">
            <div>
              <p class="section-mark">
                <Clock3 :size="13" />
                预约记录
              </p>
              <h2 id="activity-title">近期排期</h2>
            </div>
            <RouterLink to="/reviews" class="text-link">
              查看全部
              <ArrowRight :size="15" />
            </RouterLink>
          </header>
          <ul v-if="recent.length" class="agenda">
            <li v-for="item in recent" :key="item.id">
              <span class="agenda-date">{{ item.date?.slice(5).replace('-', '/') || '—' }}</span>
              <div class="agenda-name">
                <strong>{{ item.equipmentName || item.labName || '预约记录' }}</strong>
                <small>
                  {{ time(item.startTime) }}–{{ time(item.endTime) }}
                  <template v-if="admin && item.userName">· {{ item.userName }}</template>
                </small>
              </div>
              <span class="status" :style="{ '--status-color': statuses[item.status]?.color }">
                {{ statuses[item.status]?.label || '未知' }}
              </span>
            </li>
          </ul>
          <p v-else class="placeholder">
            {{ loading ? '正在读取预约…' : reservations ? '暂无预约记录' : '暂时无法读取预约' }}
          </p>
        </section>
      </div>

      <section class="glass-panel liquid-card resources" aria-labelledby="resources-title">
        <header class="panel-head">
          <div>
            <p class="section-mark">
              <FlaskConical :size="13" />
              实验资源
            </p>
            <h2 id="resources-title">资源看板</h2>
          </div>
          <div class="switcher" role="group" aria-label="资源类型">
            <button type="button" :aria-pressed="resource === 'labs'" @click="resource = 'labs'">
              实验室
            </button>
            <button
              type="button"
              :aria-pressed="resource === 'equipment'"
              @click="resource = 'equipment'"
            >
              设备
            </button>
          </div>
        </header>
        <ul v-if="resources?.length" class="resource-grid">
          <ResourceCard
            v-for="item in resources"
            :key="resource + ':' + item.id"
            :item="item"
            :equipment="resource === 'equipment'"
            :lab-name="labData?.items.find(lab => lab.id === item.lab_id)?.name"
            :can-reserve="!admin && resource === 'labs'"
            @reserve="selected = item"
          />
        </ul>
        <p v-else class="placeholder">
          {{ loading ? '正在读取资源…' : resources ? '暂未登记资源' : '暂时无法读取资源' }}
        </p>
        <footer class="panel-foot">
          <RouterLink
            v-if="resource === 'labs' || admin"
            :to="resource === 'labs' ? labPath : '/equipment'"
            class="text-link"
          >
            查看全部{{ resource === 'labs' ? '实验室' : '设备' }}
            <ArrowRight :size="15" />
          </RouterLink>
          <RouterLink v-else to="/assistant" class="text-link">
            向助手查询设备
            <ArrowRight :size="15" />
          </RouterLink>
        </footer>
      </section>
    </div>
    <ReservationDialog
      :open="!!selected"
      :lab="selected"
      @close="selected = null"
      @success="submitted"
    />
  </div>
</template>

<style scoped>
  .workbench {
    --ink: #201e2b;
    --muted: #625e73;
    --border: #69618a26;
    --pane-color: #fff;
    --glass-blur: 3px;
    --glass-tint: 30%;
    --glass-shine: 0.2;
    --soft: #6b55940b;
    --accent: #5946be;
    --accent-soft: #795bdb19;
    --teal: #087c6d;
    --amber: #945300;
    --rose: #af3e65;
    position: relative;
    isolation: isolate;
    min-height: 100%;
    overflow: clip;
    color: var(--ink);
  }
  :global(.dark .workbench) {
    --ink: #f6f3ff;
    --muted: #b4adc5;
    --border: #c4b2ed30;
    --pane-color: #211d34;
    --soft: #e7dbff0b;
    --accent: #c4b1ff;
    --accent-soft: #b297ff25;
    --teal: #6ddac2;
    --amber: #f2b76a;
    --rose: #f69fba;
  }
  .snow {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    isolation: isolate;
  }
  .dashboard {
    position: relative;
    display: grid;
    gap: 22px;
    grid-template-columns: minmax(0, 1fr);
    padding: clamp(16px, 2vw, 30px) clamp(12px, 1.9vw, 36px) 42px;
  }
  .glass-filters {
    position: absolute;
    width: 0;
    height: 0;
    pointer-events: none;
  }
  .liquid-card {
    --glass-radius: 20px;
    position: relative;
    border-radius: var(--glass-radius);
    translate: var(--slide-x, 0px) var(--slide-y, 0px);
    scale: 1;
    transition:
      translate 0.24s ease,
      scale 0.2s ease;
  }
  .liquid-card::before,
  .liquid-card::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
  }
  .liquid-card::before {
    z-index: -1;
    background: color-mix(in srgb, var(--pane-color) var(--glass-tint), transparent);
    -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.22);
    backdrop-filter: blur(var(--glass-blur)) saturate(1.22);
    box-shadow:
      0 10px 28px #28213f15,
      inset 0 -1px 2px #42365d28;
  }
  @supports (backdrop-filter: url('#workbench-refraction')) {
    .liquid-card::before {
      backdrop-filter: url(#workbench-refraction) blur(var(--glass-blur)) saturate(1.22);
    }
  }
  .liquid-card::after {
    padding: 2px;
    background:
      radial-gradient(
        ellipse at var(--light-x, 12%) var(--light-y, 4%),
        #fff,
        #ffffff80 28%,
        transparent 64%
      ),
      linear-gradient(145deg, #ffffff84 4%, #ffffff15 42%, var(--border) 70%, #ffffff60);
    opacity: var(--glass-shine);
    mask:
      linear-gradient(#000 0 0) content-box exclude,
      linear-gradient(#000 0 0);
  }
  .glass-panel {
    z-index: 0;
    padding: clamp(16px, 2.2vw, 27px);
    animation: arrive 0.44s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .overview-top,
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .date,
  .section-mark,
  .welcome,
  h1,
  h2,
  h3 {
    margin: 0;
  }
  .date,
  .section-mark {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 650;
  }
  .date span {
    width: 7px;
    height: 7px;
    background: var(--accent);
    border-radius: 50%;
  }
  h1 {
    margin-top: 5px;
    font-size: clamp(30px, 4.5vw, 48px);
    line-height: 1.15;
    letter-spacing: -0.04em;
    font-weight: 750;
  }
  h1 {
    display: grid;
    overflow-wrap: anywhere;
  }
  h1 span {
    grid-area: 1 / 1;
  }
  .greeting-measure {
    visibility: hidden;
  }
  h2 {
    font-size: 21px;
    line-height: 1.25;
    font-weight: 700;
  }
  .section-mark {
    margin-bottom: 6px;
  }
  .welcome,
  .message,
  .panel-foot,
  .placeholder {
    color: var(--muted);
    font-size: 13px;
  }
  .welcome {
    margin-top: 10px;
  }
  .message {
    margin: 12px 0 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .action,
  .text-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    text-decoration: none;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 650;
  }
  .action {
    min-height: 38px;
    padding: 7px 11px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--soft);
    color: var(--ink);
    transition:
      background 0.2s ease,
      transform 0.16s ease;
  }
  .action:hover {
    background: var(--accent-soft);
  }
  .action:active {
    transform: scale(0.97);
  }
  .primary {
    color: white;
    background: #6049cc;
    border-color: transparent;
  }
  .primary:hover {
    background: #5038b4;
  }
  .refresh {
    width: 38px;
  }
  .metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0;
    gap: 14px;
  }
  .metric {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: clamp(12px, 1.5vw, 22px);
    min-width: 0;
    z-index: 0;
  }
  .metric-icon {
    flex: none;
    color: var(--accent);
  }
  .metric-icon.teal {
    color: var(--teal);
  }
  .metric-icon.amber {
    color: var(--amber);
  }
  .metric dt {
    color: var(--muted);
    font-size: 12px;
  }
  .metric dd {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 7px;
    margin: 1px 0 0;
    font-size: 26px;
    line-height: 1.12;
    font-weight: 720;
    font-variant-numeric: tabular-nums;
  }
  .metric small {
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
  }
  .operations {
    display: grid;
    grid-template-columns: minmax(0, 1.42fr) minmax(0, 1fr);
    gap: 22px;
  }
  .operations > * {
    animation-delay: 65ms;
  }
  .switcher {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: 9px;
    background: var(--soft);
    border: 1px solid var(--border);
  }
  .switcher button {
    padding: 5px 8px;
    border: 0;
    border-radius: 6px;
    color: var(--muted);
    background: transparent;
    font-size: 12px;
    white-space: nowrap;
    transition:
      background 0.18s ease,
      color 0.18s ease;
  }
  .switcher button[aria-pressed='true'] {
    color: var(--accent);
    background: var(--accent-soft);
    font-weight: 650;
  }
  .panel-foot {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
    padding-top: 11px;
    border-top: 1px solid var(--border);
  }
  .chart .panel-foot {
    justify-content: flex-start;
  }
  .text-link {
    color: var(--accent);
    background: none;
    border: 0;
    padding: 0;
  }
  .text-link:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .agenda,
  .resource-grid {
    list-style: none;
    margin: 13px 0 0;
    padding: 0;
  }
  .agenda li {
    display: flex;
    gap: 9px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }
  .agenda li:last-child {
    border-bottom: 0;
  }
  .agenda-date {
    color: var(--muted);
    min-width: 3.2em;
    font-variant-numeric: tabular-nums;
  }
  .agenda-name {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .agenda-name strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .agenda-name small {
    color: var(--muted);
    font-size: 11px;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--status-color, var(--muted)) 11%, transparent);
    color: var(--status-color, var(--muted));
    font-size: 11px;
    white-space: nowrap;
  }
  .status::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }
  .resource-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  .placeholder {
    padding-block: 24px;
    text-align: center;
  }
  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .spinning {
    animation: rotate 0.9s linear infinite;
  }
  @keyframes rotate {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 850px) {
    .operations {
      grid-template-columns: 1fr;
    }
    .resource-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 620px) {
    .overview-top {
      align-items: flex-start;
      flex-direction: column;
    }
    .dashboard,
    .operations {
      gap: 14px;
    }
    .metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 13px 0;
    }
    .metric {
      padding-inline: 8px;
    }
    .section-mark {
      font-size: 11px;
    }
    .resource-grid {
      gap: 8px;
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
