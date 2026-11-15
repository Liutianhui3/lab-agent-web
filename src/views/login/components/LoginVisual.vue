<script setup>
  import loginBackground from '@/assets/images/login-bg.png'
</script>

<template>
  <section
    aria-label="LabOS 智能实验室"
    class="relative isolate flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl bg-[#16252d] p-5 text-white sm:min-h-[280px] sm:p-7 lg:min-h-svh lg:rounded-none lg:p-12 xl:p-14"
  >
    <img
      data-image
      :src="loginBackground"
      alt="明亮、整洁的现代科研实验室"
      class="absolute inset-0 -z-20 h-full w-full object-cover"
    />
    <div
      class="absolute inset-0 -z-10 bg-linear-to-t from-slate-950/80 via-slate-900/40 to-slate-900/20"
    ></div>
    <div
      class="flex flex-1 flex-col items-start justify-end text-left lg:items-center lg:justify-center lg:py-12 lg:text-center"
    >
      <h1
        data-enter
        class="text-[22px] leading-[1.4] font-semibold tracking-tight sm:text-[28px] lg:text-[34px] xl:text-[38px]"
      >
        智能实验室预约系统
      </h1>
      <p data-enter class="mt-2 text-xs leading-5 text-[#e1e7ee] sm:text-sm sm:leading-7 lg:mt-3">
        基于 AI Agent 协同调度的次世代全自动科研中枢
      </p>
    </div>
  </section>
</template>
