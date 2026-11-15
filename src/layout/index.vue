<script setup>
  import Header from './components/Header.vue'
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-[#FAF9FF] text-[#1a1b1f] dark:bg-[#000000] dark:text-[#f4f3f8]">
    <Header />
    <main id="main-content" class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
      <RouterView />
    </main>
  </div>
</template>
