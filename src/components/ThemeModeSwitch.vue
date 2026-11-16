<script setup>
  import { computed } from 'vue'
  import { Monitor, Moon, Sun } from 'lucide-vue-next'
  import { useTheme } from '@/composables/useTheme'

  defineProps({
    placement: { type: String, default: 'header' }
  })

  const { theme, setTheme } = useTheme()
  const modes = [
    { value: 'system', label: '跟随系统', icon: Monitor },
    { value: 'light', label: '浅色模式', icon: Sun },
    { value: 'dark', label: '深色模式', icon: Moon }
  ]
  const activeIndex = computed(() => modes.findIndex(mode => mode.value === theme.value))
</script>

<template>
  <div
    class="theme-mode-switch"
    :class="`theme-mode-switch--${placement}`"
    role="group"
    aria-label="外观模式"
    :style="{ '--active-index': activeIndex }"
  >
    <span class="theme-mode-indicator" aria-hidden="true" />
    <button
      v-for="mode in modes"
      :key="mode.value"
      type="button"
      :aria-label="mode.label"
      :aria-pressed="theme === mode.value"
      :title="mode.label"
      @click="setTheme(mode.value)"
    >
      <component :is="mode.icon" :size="15" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
  .theme-mode-switch {
    --switch-ink: #666474;
    --switch-active: #514def;
    --switch-border: rgb(255 255 255 / 90%);
    --switch-selected-top: rgb(255 255 255 / 96%);
    --switch-selected-bottom: rgb(238 235 255 / 70%);
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 148px;
    height: 44px;
    min-width: 0;
    padding: 3px;
    border: 1px solid var(--switch-border);
    border-radius: 999px;
    isolation: isolate;
    background:
      radial-gradient(ellipse at 18% 0%, rgb(255 255 255 / 95%), transparent 60%),
      linear-gradient(115deg, rgb(231 227 247 / 72%), rgb(246 245 252 / 65%) 48%, rgb(224 225 243 / 72%));
    -webkit-backdrop-filter: blur(24px) saturate(165%);
    backdrop-filter: blur(24px) saturate(165%);
    box-shadow:
      inset 0 1px 1px rgb(255 255 255 / 95%),
      inset 0 -1px 2px rgb(128 116 170 / 12%),
      0 4px 14px rgb(67 52 111 / 7%);
  }
  .theme-mode-switch--auth {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 20;
  }
  .theme-mode-indicator {
    position: absolute;
    z-index: -1;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px) / 3);
    border-radius: 999px;
    transform: translateX(calc(var(--active-index) * 100%));
    transition: transform 0.28s cubic-bezier(0.22, 0.8, 0.2, 1);
    pointer-events: none;
  }
  .theme-mode-indicator::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 34px;
    height: 34px;
    border: 1px solid rgb(255 255 255 / 95%);
    border-radius: 50%;
    background: linear-gradient(155deg, var(--switch-selected-top), var(--switch-selected-bottom));
    box-shadow:
      inset 0 2px 2px rgb(255 255 255 / 95%),
      inset 0 -1px 2px rgb(166 151 217 / 18%),
      0 3px 8px rgb(75 56 136 / 12%);
    transform: translate(-50%, -50%);
  }
  .theme-mode-switch button {
    position: relative;
    z-index: 1;
    display: flex;
    min-width: 0;
    min-height: 36px;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: 0 4px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--switch-ink);
    font-size: 11px;
    white-space: nowrap;
    cursor: pointer;
    transition: color 0.2s;
  }
  .theme-mode-switch button[aria-pressed='true'] {
    color: var(--switch-active);
    font-weight: 600;
  }
  .theme-mode-switch button:focus-visible {
    outline: 2px solid var(--switch-active);
    outline-offset: 1px;
  }
  :global(html.dark .theme-mode-switch) {
    --switch-ink: #b5b4c0;
    --switch-active: #f5f4fa;
    --switch-border: rgb(218 216 255 / 27%);
    --switch-selected-top: rgb(213 207 246 / 42%);
    --switch-selected-bottom: rgb(151 143 185 / 30%);
    background:
      radial-gradient(ellipse at 20% 0%, rgb(192 184 245 / 24%), transparent 58%),
      linear-gradient(115deg, rgb(71 68 92 / 78%), rgb(38 39 51 / 72%) 50%, rgb(63 68 88 / 72%));
    box-shadow:
      inset 0 1px 1px rgb(255 255 255 / 28%),
      inset 0 -1px 2px rgb(174 182 230 / 14%),
      0 6px 18px rgb(0 0 0 / 28%);
  }
  :global(html.dark .theme-mode-indicator::before) {
    border-color: rgb(236 233 255 / 53%);
    box-shadow:
      inset 0 2px 2px rgb(255 255 255 / 48%),
      inset 0 -2px 3px rgb(204 215 255 / 28%),
      0 4px 12px rgb(0 0 0 / 32%);
  }
  @media (max-width: 390px) {
    .theme-mode-switch--header {
      width: 140px;
    }
    .theme-mode-switch--auth {
      top: 14px;
      right: 14px;
      width: 140px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .theme-mode-indicator,
    .theme-mode-switch button {
      transition: none;
    }
  }
</style>
