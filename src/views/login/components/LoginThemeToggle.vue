<script setup>
  import { computed } from 'vue'
  import { Moon, Sun } from 'lucide-vue-next'
  import { useTheme } from '@/composables/useTheme'

  const { theme, setTheme } = useTheme()
  const dark = computed(
    () =>
      theme.value === 'dark' ||
      (theme.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )
</script>

<template>
  <header class="absolute top-5 right-5 z-10 lg:top-6 lg:right-6">
    <button
      type="button"
      :aria-label="dark ? '切换浅色外观' : '切换深色外观'"
      @click="setTheme(dark ? 'light' : 'dark')"
      class="flex size-11 cursor-pointer items-center justify-center rounded-full border border-[#e9e7ed] text-[#626775] transition hover:-translate-y-0.5 hover:bg-[#f4f3f8] active:scale-95 dark:border-[#34353e] dark:text-[#c6c8d2] dark:hover:bg-[#272830] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b74f3]"
    >
      <Sun v-if="dark" :size="18" />
      <Moon v-else :size="18" />
    </button>
  </header>
</template>
