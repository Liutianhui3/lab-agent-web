<script setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
  import { ArrowUp, Brain, Maximize2, Minimize2, Square } from 'lucide-vue-next'

  const props = defineProps({
    placeholder: { type: String, default: '输入消息' },
    ariaLabel: { type: String, default: '消息输入框' },
    disabled: Boolean,
    busy: Boolean,
    showThinking: { type: Boolean, default: true },
    maxLength: { type: Number, default: 20000 },
    availableHeight: { type: Number, default: 0 }
  })
  const draft = defineModel({ type: String, default: '' })
  const enableThinking = defineModel('thinking', { type: Boolean, default: false })
  const expanded = defineModel('expanded', { type: Boolean, default: false })
  const emit = defineEmits(['send', 'stop'])
  const tooltipId = useId()
  const textarea = ref()
  const mirror = ref()
  const root = ref()
  const tall = ref(false)
  const wraps = ref(false)
  const inputHeight = ref(26)
  const expandedHeight = ref(500)
  const multiline = computed(() => wraps.value || expanded.value)
  const composerHeight = computed(() =>
    expanded.value ? expandedHeight.value : multiline.value ? inputHeight.value + 82 : 60
  )
  let observer
  const inputScrollbarVisible = ref(false)
  let inputScrollbarTimer
  function updateInputScrollbar() {
    clearTimeout(inputScrollbarTimer)
    const input = textarea.value
    if (!input || input.scrollHeight <= input.clientHeight + 1) {
      inputScrollbarVisible.value = false
      return
    }
    inputScrollbarVisible.value = true
    const atEdge =
      input.scrollTop <= 1 || input.scrollTop + input.clientHeight >= input.scrollHeight - 1
    if (atEdge)
      inputScrollbarTimer = setTimeout(() => {
        inputScrollbarVisible.value = false
      }, 2000)
  }
  function measure() {
    if (!mirror.value || !textarea.value) return
    expandedHeight.value = Math.max(
      180,
      (props.availableHeight || window.innerHeight) - (window.innerWidth > 800 ? 114 : 106)
    )
    const composer = textarea.value.closest('.composer')
    if (!composer) return
    const inputStyle = getComputedStyle(textarea.value)
    mirror.value.style.font = inputStyle.font
    // Decide layout at the fixed single-line width, not the animated textarea width.
    // Otherwise widening the multiline input makes it one line again and toggles forever.
    mirror.value.style.width = `${Math.max(1, composer.clientWidth - 22 - (props.showThinking ? 158 : 60))}px`
    mirror.value.style.lineHeight = inputStyle.lineHeight
    mirror.value.textContent = draft.value.endsWith('\n') ? draft.value + ' ' : draft.value || ' '
    wraps.value = mirror.value.scrollHeight > 26
    if (multiline.value) {
      mirror.value.style.width = `${Math.max(1, composer.clientWidth - 22 - 18)}px`
      if (mirror.value.scrollHeight > 104 || expanded.value) {
        mirror.value.style.width = `${Math.max(1, composer.clientWidth - 22 - 18 - 42)}px`
      }
    }
    const height = Math.max(26, mirror.value.scrollHeight)
    tall.value = height > 104
    inputHeight.value = Math.min(height, 130)
  }

  function submit() {
    if (
      props.busy ||
      props.disabled ||
      !draft.value.trim() ||
      (props.maxLength > 0 && draft.value.length > props.maxLength)
    )
      return
    emit('send', draft.value)
  }
  function keydown(event) {
    if (event.key === 'Escape') expanded.value = false
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault()
      submit()
    }
  }
  function focus(options = { preventScroll: true }) {
    textarea.value?.focus(options)
  }
  watch([draft, expanded, () => props.availableHeight, () => props.showThinking], async () => {
    await nextTick()
    measure()
  })
  onMounted(() => {
    observer = new ResizeObserver(measure)
    observer.observe(root.value)
    window.addEventListener('resize', measure)
    measure()
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    window.removeEventListener('resize', measure)
    clearTimeout(inputScrollbarTimer)
  })
  defineExpose({ focus })
</script>

<template>
  <div ref="root" class="chat-composer" :class="{ 'without-thinking': !showThinking }">
    <form
      class="composer"
      :class="{ multiline, expanded, 'has-expand': tall || expanded }"
      :style="{ height: `${composerHeight}px` }"
      @submit.prevent="submit"
    >
      <button
        v-if="tall || expanded"
        type="button"
        class="expand-button icon-button"
        :aria-label="expanded ? '收起输入框' : '展开输入框'"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <Minimize2 v-if="expanded" :size="18" />
        <Maximize2 v-else :size="18" />
      </button>
      <textarea
        ref="textarea"
        v-model="draft"
        :aria-label="ariaLabel"
        :placeholder="placeholder"
        rows="1"
        :style="{ height: expanded ? `${expandedHeight - 84}px` : `${inputHeight}px` }"
        :disabled="disabled"
        :class="{ 'scrollbar-visible': inputScrollbarVisible }"
        @scroll="updateInputScrollbar"
        @wheel.passive="updateInputScrollbar"
        @touchmove.passive="updateInputScrollbar"
        @input="updateInputScrollbar"
        @keydown="keydown"
      />
      <div class="composer-toolbar">
        <button
          type="button"
          v-if="showThinking"
          class="thinking-toggle"
          :class="{ active: enableThinking }"
          :aria-pressed="enableThinking"
          :aria-describedby="tooltipId"
          @click="enableThinking = !enableThinking"
        >
          <Brain :size="19" aria-hidden="true" />
          <span>思考</span>
          <span :id="tooltipId" class="thinking-tooltip" role="tooltip">获取更智能的回答</span>
        </button>
        <span
          v-if="maxLength > 0 && draft.length > maxLength * 0.9"
          class="character-count"
          :class="{ exceeded: maxLength > 0 && draft.length > maxLength }"
        >
          {{ draft.length }} / {{ maxLength }}
        </span>
        <button
          v-if="busy"
          type="button"
          class="send-button"
          aria-label="停止生成"
          @click="emit('stop')"
        >
          <Square :size="16" fill="currentColor" />
        </button>
        <button
          v-else
          type="submit"
          class="send-button"
          aria-label="发送消息"
          :disabled="!draft.trim() || disabled || (maxLength > 0 && draft.length > maxLength)"
        >
          <ArrowUp :size="22" />
        </button>
      </div>
    </form>
    <div ref="mirror" class="text-mirror" aria-hidden="true" />
  </div>
</template>
<style scoped>
  .chat-composer {
    --cc-input-bg: var(--composer-background, #f3f3f5);
    --cc-line: var(--composer-border, #e7e7eb);
    --cc-accent: var(--composer-accent, #7b74f3);
    --cc-accent-hover: var(--composer-accent, #7b74f3);
    --cc-chat-text: var(--composer-text, #242428);
    --cc-chat-bg: var(--composer-surface, #fff);
    --cc-muted: var(--composer-muted, #818187);
    --cc-hover: var(--composer-hover, #eaeaec);
    --cc-input-scrollbar: var(--composer-scrollbar, #b9b9c2);
    --cc-input-scrollbar-hover: var(--composer-scrollbar, #b9b9c2);
    position: relative;
    color: var(--cc-chat-text);
    font-family: inherit;
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  button,
  textarea {
    font: inherit;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
  }
  button:focus-visible {
    outline: 2px solid var(--cc-accent);
    outline-offset: 3px;
  }
  .icon-button {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border: 0;
    background: transparent;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition: none !important;
    }
  }
  .composer {
    background: var(--cc-input-bg);
    border: 1px solid var(--cc-line);
    border-radius: 30px;
    position: relative;
    padding: 14px 158px 14px 22px;
    display: flex;
    align-items: center;
    min-height: 60px;
    transition:
      height 0.38s cubic-bezier(0.22, 0.7, 0.25, 1),
      border-radius 0.3s,
      border-color 0.25s ease,
      box-shadow 0.25s ease;
    box-shadow: 0 2px 6px #00000003;
  }
  .without-thinking .composer:not(.multiline) {
    padding-right: 60px;
  }
  .composer:focus-within {
    border-color: var(--cc-accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--cc-accent) 18%, transparent);
  }
  .composer textarea,
  .text-mirror {
    font-size: 15px;
    line-height: 26px;
    letter-spacing: normal;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    padding: 0;
    border: 0;
  }
  .composer textarea {
    display: block;
    resize: none;
    width: 100%;
    background: none;
    color: inherit;
    outline: 0;
    min-height: 26px;
    overflow-y: auto;
  }
  .composer textarea {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
  }
  @supports selector(::-webkit-scrollbar) {
    .composer textarea {
      scrollbar-width: auto;
      scrollbar-color: auto;
    }
  }
  .composer textarea::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .composer textarea::-webkit-scrollbar-track {
    background: transparent;
    margin-block: 32px 4px;
  }
  .composer textarea::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
  }
  .composer textarea.scrollbar-visible {
    scrollbar-color: var(--cc-input-scrollbar) transparent;
  }
  @supports selector(::-webkit-scrollbar) {
    .composer textarea.scrollbar-visible {
      scrollbar-color: auto;
    }
  }
  .composer textarea.scrollbar-visible::-webkit-scrollbar-thumb {
    background: var(--cc-input-scrollbar);
  }
  .composer textarea.scrollbar-visible::-webkit-scrollbar-thumb:hover {
    background: var(--cc-input-scrollbar-hover);
  }
  .composer textarea::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
  .composer textarea::-webkit-scrollbar-corner {
    background: transparent;
  }
  .composer textarea::placeholder {
    color: var(--cc-muted);
  }
  .composer-toolbar {
    position: absolute;
    right: 10px;
    bottom: 10px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .send-button {
    height: 38px;
    width: 38px;
    border-radius: 50%;
    background: var(--cc-accent);
    color: #fff;
    border: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thinking-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 38px;
    padding: 0 13px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--cc-muted);
    font-size: 14px;
    white-space: nowrap;
    transition:
      color 0.2s ease,
      background-color 0.2s ease;
  }
  .thinking-toggle:hover {
    background: var(--cc-hover);
  }
  .thinking-toggle.active {
    background: color-mix(in srgb, var(--cc-accent) 13%, var(--cc-input-bg));
    color: var(--cc-accent);
  }
  .thinking-tooltip {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    padding: 8px 14px;
    border-radius: 999px;
    background: #111;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
    box-shadow: 0 8px 24px #0003;
    pointer-events: none;
    visibility: hidden;
    opacity: 0;
    transition:
      opacity 0.15s ease,
      visibility 0.15s ease;
  }
  .thinking-toggle:hover .thinking-tooltip,
  .thinking-toggle:focus-visible .thinking-tooltip {
    visibility: visible;
    opacity: 1;
  }
  .send-button:hover:not(:disabled) {
    background: var(--cc-accent-hover);
  }
  .send-button:disabled {
    background: var(--cc-chat-text);
    color: var(--cc-chat-bg);
    opacity: 0.2;
  }
  .composer.multiline {
    display: block;
    padding: 18px 18px 62px 22px;
    border-radius: 24px;
  }
  .multiline .composer-toolbar {
    left: 20px;
    right: 10px;
    justify-content: flex-end;
  }
  .input-hint {
    font-size: 11px;
    color: var(--cc-muted);
    margin-right: auto;
  }
  .multiline.has-expand textarea {
    padding-right: 42px;
  }
  .expand-button {
    border-radius: 50%;
    position: absolute;
    right: 10px;
    top: 8px;
    z-index: 1;
    color: var(--cc-muted);
  }
  .character-count {
    font-size: 10px;
    color: var(--cc-muted);
  }
  .exceeded {
    color: #c65c58;
  }

  .composer.expanded {
    padding-bottom: 64px;
  }

  .text-mirror {
    position: absolute;
    left: -100000px;
    top: 0;
    visibility: hidden;
    height: auto;
    pointer-events: none;
  }
  @media (max-width: 800px) {
    .composer textarea {
      font-size: 16px;
    }
  }
</style>
