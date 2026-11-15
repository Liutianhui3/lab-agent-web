<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import {
    Moon,
    Sun,
    UserRound,
    PanelsTopLeft,
    Bot,
    FlaskConical,
    Microscope,
    ClipboardCheck,
    Users
  } from 'lucide-vue-next'
  import logo from '@/assets/images/lab-agent.png'
  import gsap from 'gsap'
  import { useTheme } from '@/composables/useTheme'
  import AccountMenu from './AccountMenu.vue'
  import { menuRoutes } from '@/router/menu'

  const route = useRoute()
  const { theme, setTheme } = useTheme()
  const nav = ref(null)
  const indicator = ref(null)
  const activePath = computed(() => route.path)
  const dark = computed(
    () =>
      theme.value === 'dark' ||
      (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
  const mobileItems = {
    home: { icon: PanelsTopLeft, label: '工作台' },
    assistant: { icon: Bot, label: 'AI助手' },
    laboratories: { icon: FlaskConical, label: '实验室' },
    equipment: { icon: Microscope, label: '设备' },
    reviews: { icon: ClipboardCheck, label: '预约审核' },
    users: { icon: Users, label: '用户管理' }
  }
  const items = menuRoutes.map(({ path, name, meta }) => ({
    path,
    label: meta.title,
    mobile: mobileItems[name]
  }))

  function updateIndicator(animate = true) {
    if (!indicator.value || !nav.value) return
    const active = nav.value.querySelector('[aria-current="page"]')
    indicator.value.style.visibility = active ? 'visible' : 'hidden'
    if (!active) return
    const target = {
      x: active.offsetLeft,
      y: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight
    }
    gsap.to(indicator.value, {
      ...target,
      duration:
        animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.32 : 0,
      ease: 'power3.out',
      overwrite: true
    })
  }

  function handleResize() {
    updateIndicator(false)
  }

  watch(activePath, async () => {
    await nextTick()
    nav.value?.querySelector('[aria-current="page"]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'instant'
    })
    updateIndicator()
  })

  onMounted(() => {
    updateIndicator(false)
    window.addEventListener('resize', handleResize)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    if (indicator.value) gsap.killTweensOf(indicator.value)
  })

  function toggleTheme() {
    setTheme(dark.value ? 'light' : 'dark')
  }


</script>

<template>
  <header
    class="relative z-30 shrink-0 border-b border-[#e9e8ef] bg-white dark:border-[#34353e] dark:bg-[#202127]"
  >
    <div
      class="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
    >
      <RouterLink
        to="/home"
        class="flex min-w-fit items-center justify-self-start gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#514def]"
        aria-label="智能实验室预约系统 首页工作台"
      >
        <img :src="logo" alt="" class="size-10 shrink-0 object-contain" />
        <span
          class="platform-title hidden text-[19px] leading-6 font-semibold whitespace-nowrap sm:block"
        >
          智能实验室预约系统
        </span>
      </RouterLink>

      <nav
        ref="nav"
        aria-label="主导航"
        class="header-nav relative isolate mx-auto flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-full p-1"
      >
        <span
          ref="indicator"
          aria-hidden="true"
          class="tab-indicator pointer-events-none absolute top-0 left-0 rounded-full"
        />
        <RouterLink
          v-for="item in items"
          :key="item.path"
          :to="item.path"
          :aria-label="item.label"
          :aria-current="activePath === item.path ? 'page' : undefined"
          class="nav-item relative z-10 flex h-10 shrink-0 items-center justify-center rounded-full px-3 text-[13px] font-medium text-[#52515f] transition-colors hover:text-[#6457df] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7b6cf0] aria-[current=page]:font-semibold aria-[current=page]:text-[#7061e8] dark:text-[#b5b4c0] dark:hover:text-white dark:aria-[current=page]:text-[#f5f4fa] sm:px-5 sm:text-sm"
        >
          <component
            :is="item.mobile.icon"
            :size="22"
            :stroke-width="1.8"
            aria-hidden="true"
            class="md:hidden"
          />
          <span class="md:hidden">{{ item.mobile.label }}</span>
          <span class="hidden md:inline">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="flex shrink-0 items-center justify-self-end gap-2 sm:gap-3">
        <button
          type="button"
          :aria-label="dark ? '切换浅色主题' : '切换深色主题'"
          @click="toggleTheme"
          class="flex size-10 cursor-pointer items-center justify-center rounded-lg bg-transparent text-[#525665] transition-colors hover:text-[#514def] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#514def] dark:text-[#d0d1da] dark:hover:text-[#aaa8ff]"
        >
          <Sun v-if="dark" :size="18" aria-hidden="true" />
          <Moon v-else :size="18" aria-hidden="true" />
        </button>
        <AccountMenu />
      </div>
    </div>
  </header>
</template>

<style scoped>
  .header-nav {
    scrollbar-width: none;
    border: 1px solid rgb(255 255 255 / 90%);
    background:
      radial-gradient(ellipse at 15% 0%, rgb(255 255 255 / 95%), transparent 55%),
      linear-gradient(115deg, rgb(231 227 247 / 65%), rgb(246 245 252 / 42%) 48%, rgb(224 225 243 / 58%));
    -webkit-backdrop-filter: blur(24px) saturate(165%);
    backdrop-filter: blur(24px) saturate(165%);
    box-shadow:
      inset 0 1px 1px rgb(255 255 255 / 95%),
      inset 0 -1px 2px rgb(128 116 170 / 12%),
      0 4px 14px rgb(67 52 111 / 7%);
  }

  .tab-indicator {
    border: 1px solid rgb(255 255 255 / 95%);
    background: linear-gradient(155deg, rgb(255 255 255 / 95%), rgb(255 255 255 / 48%) 55%, rgb(238 235 255 / 65%));
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    backdrop-filter: blur(16px) saturate(180%);
    box-shadow:
      inset 0 2px 2px rgb(255 255 255 / 95%),
      inset 0 -1px 2px rgb(166 151 217 / 18%),
      0 3px 8px rgb(75 56 136 / 12%);
    overflow: hidden;
  }

  .tab-indicator::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(115deg, transparent 12%, rgb(255 255 255 / 65%) 35%, transparent 58%);
    opacity: .55;
  }

  .nav-item { -webkit-tap-highlight-color: transparent; }
  .nav-item:hover { background: rgb(255 255 255 / 22%); }

  :global(.dark .header-nav) {
    border-color: rgb(218 216 255 / 27%);
    background:
      radial-gradient(ellipse at 20% 0%, rgb(192 184 245 / 24%), transparent 58%),
      linear-gradient(115deg, rgb(71 68 92 / 78%), rgb(38 39 51 / 72%) 50%, rgb(63 68 88 / 72%));
    box-shadow:
      inset 0 1px 1px rgb(255 255 255 / 28%),
      inset 0 -1px 2px rgb(174 182 230 / 14%),
      0 6px 18px rgb(0 0 0 / 28%);
  }

  :global(.dark .tab-indicator) {
    border-color: rgb(236 233 255 / 53%);
    background: linear-gradient(155deg, rgb(213 207 246 / 42%), rgb(151 143 185 / 30%) 48%, rgb(181 190 230 / 40%));
    box-shadow:
      inset 0 2px 2px rgb(255 255 255 / 48%),
      inset 0 -2px 3px rgb(204 215 255 / 28%),
      0 4px 12px rgb(0 0 0 / 32%);
  }
  :global(.dark .tab-indicator)::after { opacity: .36; }
  :global(.dark .nav-item:hover) { background: rgb(255 255 255 / 5%); }

  @media (prefers-reduced-transparency: reduce) {
    .header-nav {
      background: #efedf5;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    .tab-indicator {
      background: #fff;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
    :global(.dark .header-nav) {
      background: #19191d;
    }
    :global(.dark .tab-indicator) {
      background: #36353d;
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .tab-indicator::after { display: none; }
  }

  .header-nav::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 767px) {
    .header-nav {
      position: fixed;
      inset: auto 0 0;
      z-index: 40;
      width: 100%;
      max-width: none;
      gap: 0;
      border-radius: 0;
      border-width: 1px 0 0;
      padding: 8px max(4px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom))
        max(4px, env(safe-area-inset-left));
      background: rgb(250 249 255 / 85%);
      box-shadow: 0 -4px 20px rgb(66 48 112 / 5%);
    }

    .header-nav .nav-item {
      flex: 1 1 0;
      min-width: 0;
      height: 56px;
      flex-direction: column;
      gap: 5px;
      padding: 4px 0;
      border-radius: 12px;
      font-size: 11px;
      line-height: 16px;
      white-space: nowrap;
    }

    .tab-indicator {
      display: none;
    }

    :global(.dark .header-nav) {
      background: rgb(24 24 29 / 88%);
      box-shadow: 0 -4px 20px rgb(0 0 0 / 15%);
    }
  }
  .platform-title {
    /* 使用有现代感的字体组合 */
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.5px;
    /* 核心代码：负值向右倾斜（最符合阅读习惯），-10deg 到 -12deg 视觉最舒服 */
    transform: skewX(-10deg);
    /* 渐变文字效果 */
    background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;

    /* 微微的立体感阴影 */
    filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.15));
  }
  /* ==========================================
   暗黑模式定制（推荐：星辰冰蓝渐变，契合左侧实验室图标）
   ========================================== */
  html.dark .platform-title,
  .dark .platform-title {
    /* 提亮明度：从高饱和浅青色过渡到亮天蓝，再带一点淡紫光晕 */
    background: linear-gradient(135deg, #2ecfb7 0%, #2fd7b5 50%, #33ff66 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    /* 暗黑模式下用微弱的同色系外发光替代阴影，增强通透感 */
    filter: drop-shadow(0 2 4px rgba(96, 165, 250, 0.35));
  }
</style>
