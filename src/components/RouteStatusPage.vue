<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ArrowLeft, ArrowUpRight, House, LockKeyhole, Telescope } from 'lucide-vue-next'
  import SnowfallBackground from '@/components/SnowfallBackground.vue'
  import { ACCESS_TOKEN } from '@/utils/constant'
  import { getLocalStorage } from '@/utils/localStorage'
  import { useUserInfo } from '@/composables/useUserInfo'
  import { canAccessRoute } from '@/router/menu'
  import logo from '@/assets/images/lab-agent.png'

  const props = defineProps({ kind: { type: String, required: true } })
  const route = useRoute()
  const router = useRouter()
  const { userInfo } = useUserInfo()
  const heading = ref(null)
  const forbidden = computed(() => props.kind === 'forbidden')
  const title = computed(() => (forbidden.value ? '这里需要访问权限' : '这个页面暂时找不到了'))
  const home = computed(() => (getLocalStorage(ACCESS_TOKEN) ? '/home' : '/login'))
  const back = computed(() => {
    const previous = router.options.history.state.back
    if (typeof previous !== 'string' || !previous.startsWith('/') || previous.startsWith('//'))
      return null
    const target = router.resolve(previous)
    if (
      !target.matched.length ||
      ['not-found', 'unmatched', 'no-permission'].includes(target.name) ||
      target.path === route.path
    )
      return null
    if (target.matched.some(record => !canAccessRoute(record, userInfo.value.role))) return null
    if (!getLocalStorage(ACCESS_TOKEN) && !['login', 'register'].includes(target.name)) return null
    return previous
  })
  function goBack() {
    if (back.value) router.back()
    else router.replace(home.value)
  }
  onMounted(() => heading.value?.focus({ preventScroll: true }))
</script>

<template>
  <main class="route-status" :class="{ forbidden }" aria-labelledby="status-title">
    <SnowfallBackground />
    <header class="status-header">
      <RouterLink :to="home" class="brand" aria-label="智能实验室预约系统首页">
        <img :src="logo" alt="" width="32" height="32" />
        <span>智能实验室预约系统</span>
      </RouterLink>
      <RouterLink :to="home" class="header-link">
        {{ home === '/home' ? '工作台' : '前往登录' }}
        <ArrowUpRight :size="16" />
      </RouterLink>
    </header>
    <section class="status-content">
      <div class="status-art" aria-hidden="true">
        <span class="status-code">{{ forbidden ? '403' : '404' }}</span>
        <div class="icon-seal">
          <LockKeyhole v-if="forbidden" :size="36" :stroke-width="1.5" />
          <Telescope v-else :size="38" :stroke-width="1.5" />
        </div>
        <svg class="art-line" viewBox="0 0 360 180" fill="none">
          <path d="M30 126C92 159 238 166 316 67" />
          <circle cx="30" cy="126" r="3" />
          <circle cx="316" cy="67" r="4" />
        </svg>
      </div>
      <h1 id="status-title" ref="heading" tabindex="-1">{{ title }}</h1>
      <p class="status-description">
        {{ forbidden ? '当前账号没有此页面的访问权限。' : '地址可能有误，或页面已被移动。' }}
        <br />
        {{ forbidden ? '如需使用，请联系系统管理员开通权限。' : '回到熟悉的地方，继续你的工作。' }}
      </p>
      <div class="status-actions">
        <RouterLink :to="home" class="action primary">
          <House :size="17" />
          {{ home === '/home' ? '返回工作台' : '前往登录' }}
        </RouterLink>
        <button v-if="back" type="button" class="action secondary" @click="goBack">
          <ArrowLeft :size="17" />
          返回上一页
        </button>
      </div>
    </section>
    <footer class="status-footer">
      <span>{{ forbidden ? '访问受限' : '页面不存在' }}</span>
      <span class="footer-divider" />
      {{ forbidden ? '403' : '404' }}
    </footer>
  </main>
</template>

<style scoped>
  .route-status {
    --ink: #25232d;
    --muted: #726d82;
    --accent: #514def;
    --line: #e8e5f1;
    --surface: #fff;
    --seal: #efecff;
    position: relative;
    isolation: isolate;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: 0 48px;
    color: var(--ink);
    background: #f7f9fc;
    overflow: hidden;
  }
  :global(.dark .route-status) {
    --ink: #f2f0f8;
    --muted: #b6b1c6;
    --accent: #b3a6ff;
    --line: #35343f;
    --surface: #24252d;
    --seal: #343047;
    background: #000;
  }
  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    min-height: 88px;
    border-bottom: 1px solid var(--line);
  }
  a {
    text-decoration: none;
    color: inherit;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
  }
  .brand img {
    object-fit: contain;
  }
  .header-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
    transition: color 0.2s;
  }
  .header-link:hover {
    color: var(--accent);
  }
  .status-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 52px 0 72px;
    text-align: center;
    animation: content-arrive 0.65s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .status-art {
    position: relative;
    width: 360px;
    height: 180px;
    margin-bottom: 28px;
  }
  .status-code {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 152px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 650;
    color: var(--line);
    user-select: none;
  }
  .icon-seal {
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    place-items: center;
    width: 82px;
    height: 82px;
    margin: -30px 0 0 -41px;
    color: var(--accent);
    background: var(--seal);
    border: 6px solid var(--surface);
    border-radius: 24px;
    box-shadow: 0 8px 24px rgb(50 35 90 / 8%);
    transform: rotate(-8deg);
    animation: seal-arrive 0.85s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .forbidden .icon-seal {
    transform: rotate(8deg);
  }
  .icon-seal svg {
    transform: rotate(8deg);
  }
  .forbidden .icon-seal svg {
    transform: rotate(-8deg);
  }
  .art-line {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    stroke: var(--accent);
    stroke-width: 1;
    opacity: 0.4;
  }
  .art-line path {
    stroke-dasharray: 4 6;
  }
  .art-line circle {
    fill: var(--surface);
  }
  h1 {
    margin: 0;
    font-size: clamp(24px, 3vw, 32px);
    font-weight: 620;
    letter-spacing: -0.02em;
    line-height: 1.4;
    outline: none;
  }
  .status-description {
    margin: 16px 0 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.9;
    text-wrap: balance;
  }
  .status-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 32px;
  }
  .action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 46px;
    border-radius: 12px;
    padding: 0 22px;
    font-size: 13px;
    font-weight: 550;
    cursor: pointer;
    transition:
      transform 0.2s,
      background 0.2s,
      box-shadow 0.2s;
  }
  .primary {
    background: #514def;
    color: #fff;
    border: 1px solid #514def;
    box-shadow: 0 4px 12px rgb(80 60 150 / 10%);
  }
  .primary:hover {
    background: #6555d5;
    box-shadow: 0 7px 18px rgb(80 60 150 / 18%);
    transform: translateY(-2px);
  }
  .secondary {
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--muted);
  }
  .secondary:hover {
    color: var(--ink);
    transform: translateY(-2px);
  }
  .action:active {
    transform: translateY(0) scale(0.98);
  }
  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .status-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 20px 0 28px;
    color: var(--muted);
    font-size: 11px;
  }
  .footer-divider {
    width: 1px;
    height: 10px;
    background: var(--line);
  }
  ::selection {
    background: #514def30;
  }
  @keyframes content-arrive {
    from {
      transform: translateY(12px);
    }
    to {
      transform: translateY(0);
    }
  }
  @keyframes seal-arrive {
    from {
      translate: 0 12px;
      rotate: -12deg;
    }
    to {
      translate: 0 0;
      rotate: 0deg;
    }
  }
  @media (max-width: 600px) {
    .route-status {
      padding: 0 22px;
    }
    .status-header {
      min-height: 72px;
      gap: 12px;
    }
    .brand {
      font-size: 12px;
      gap: 8px;
    }
    .brand img {
      width: 28px;
      height: 28px;
    }
    .header-link {
      font-size: 12px;
    }
    .status-content {
      padding: 40px 0;
    }
    .status-art {
      width: 300px;
      height: 160px;
      margin-bottom: 24px;
    }
    .status-code {
      font-size: 130px;
    }
    .status-description {
      font-size: 13px;
    }
    .action {
      padding: 0 18px;
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
