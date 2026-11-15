<script setup>
  import { ref } from 'vue'
  import { Eye, EyeOff, CircleAlert } from 'lucide-vue-next'
  const model = defineModel({ type: String, default: '' })
  const props = defineProps({
    id: String,
    label: String,
    placeholder: String,
    autocomplete: String,
    maxlength: Number,
    type: { type: String, default: 'text' },
    icon: [Object, Function],
    error: String,
    hint: String
  })
  const emit = defineEmits(['clear-error'])
  const visible = ref(false)
</script>
<template>
  <div data-enter>
    <label :for="id" class="mb-2 block text-[13px] font-medium">{{ label }}</label>
    <div class="relative">
      <component
        :is="icon"
        aria-hidden="true"
        :size="19"
        class="pointer-events-none absolute left-3 top-[13px] z-10 text-[#9290a6]"
      />
      <input
        :id="id"
        v-model="model"
        :type="type === 'password' && visible ? 'text' : type"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :style="type === 'password' ? { paddingRight: '44px' } : undefined"
        :placeholder="placeholder"
        :aria-invalid="!!error"
        :aria-describedby="
          [error && id + '-error', hint && id + '-hint'].filter(Boolean).join(' ') || undefined
        "
        autocapitalize="none"
        spellcheck="false"
        @input="emit('clear-error')"
        class="h-[46px] w-full rounded-none border-0 border-b border-[#e2e4ea] bg-transparent pr-3 pl-11 text-sm caret-[#7b74f3] outline-none transition placeholder:text-[#787d89] focus:border-[#7b74f3] focus:bg-white focus:ring-0 focus:border-b-2 dark:border-[#383943] dark:bg-transparent dark:focus:bg-transparent aria-[invalid=true]:border-b-2 aria-[invalid=true]:border-[#f43f66] aria-[invalid=true]:bg-[#fff8fa] aria-[invalid=true]:pl-11 aria-[invalid=true]:focus:border-[#f43f66] aria-[invalid=true]:focus:bg-[#fff8fa] dark:aria-[invalid=true]:border-[#ff839b] dark:aria-[invalid=true]:bg-[#35232d] dark:aria-[invalid=true]:focus:bg-[#35232d]"
      />
      <button
        v-if="type === 'password'"
        type="button"
        :aria-label="visible ? '隐藏密码' : '显示密码'"
        :aria-pressed="visible"
        @click="visible = !visible"
        class="absolute top-0 right-0 flex size-11 cursor-pointer items-center justify-center text-[#787d89] hover:text-[#635bd2] focus-visible:outline-2 focus-visible:outline-[#7b74f3]"
      >
        <EyeOff v-if="visible" :size="18" />
        <Eye v-else :size="18" />
      </button>
    </div>
    <p
      v-if="error"
      :id="id + '-error'"
      role="alert"
      class="flex items-start gap-2 pt-1 text-xs leading-5 text-[#e52e55] dark:text-[#ff839b]"
    >
      <CircleAlert :size="15" class="mt-0.5 shrink-0" />
      {{ error }}
    </p>
    <p
      v-if="hint"
      :id="id + '-hint'"
      class="pt-1 text-xs leading-5 text-[#747984] dark:text-[#a9adb9]"
    >
      {{ hint }}
    </p>
    <slot />
  </div>
</template>
