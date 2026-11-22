<script setup>
  import { onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import Header from './components/Header.vue'

  const route = useRoute()
  const scrollbarVisible = ref(false)
  let hideScrollbarTimer

  function hideScrollbar() {
    clearTimeout(hideScrollbarTimer)
    scrollbarVisible.value = false
  }

  function showScrollbar() {
    if (route.name !== 'home') return
    scrollbarVisible.value = true
    clearTimeout(hideScrollbarTimer)
    hideScrollbarTimer = setTimeout(hideScrollbar, 2000)
  }

  watch(() => route.name, hideScrollbar)
  onBeforeUnmount(hideScrollbar)
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-[#FAF9FF] text-[#1a1b1f] dark:bg-[#000000] dark:text-[#f4f3f8]">
    <Header />
    <main
      id="main-content"
      class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0"
      :class="{ 'home-scroll': route.name === 'home', 'scrollbar-visible': scrollbarVisible }"
      @scroll.passive="showScrollbar"
    >
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
  @property --home-scroll-thumb {
    syntax: '<color>';
    inherits: true;
    initial-value: transparent;
  }

  .home-scroll {
    --home-scroll-thumb: transparent;
    scrollbar-width: thin;
    scrollbar-color: var(--home-scroll-thumb) transparent;
    transition: --home-scroll-thumb 250ms ease;
  }

  .home-scroll.scrollbar-visible {
    --home-scroll-thumb: #69657980;
  }

  :global(.dark .home-scroll.scrollbar-visible) {
    --home-scroll-thumb: #b7b3c280;
  }

  @supports selector(::-webkit-scrollbar) {
    .home-scroll {
      scrollbar-width: auto;
      scrollbar-color: auto;
    }

    .home-scroll::-webkit-scrollbar {
      width: 4px;
    }

    .home-scroll::-webkit-scrollbar-thumb {
      background: var(--home-scroll-thumb);
      border-radius: 999px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home-scroll {
      transition: none;
    }
  }
</style>
