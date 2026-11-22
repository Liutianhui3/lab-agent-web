<script setup>
  import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { X } from 'lucide-vue-next'
  import { createReservation } from '@/api/reservation'

  const props = defineProps({
    open: Boolean,
    lab: { type: Object, default: null },
    equipment: { type: Object, default: null }
  })
  const emit = defineEmits(['close', 'success'])
  const dialog = ref(null)
  const date = ref(''),
    startTime = ref(''),
    endTime = ref(''),
    remark = ref('')
  const saving = ref(false),
    error = ref(''),
    errors = ref({})
  let opener
  let previousOverflow

  function restoreScroll() {
    if (previousOverflow !== undefined) {
      document.body.style.overflow = previousOverflow
      previousOverflow = undefined
    }
  }
  function close() {
    if (!saving.value) emit('close')
  }
  watch(
    () => props.open,
    async value => {
      if (value) {
        opener = document.activeElement
        error.value = ''
        errors.value = {}
        date.value = startTime.value = endTime.value = remark.value = ''
        await nextTick()
        if (!props.open) return
        previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialog.value?.showModal()
      } else {
        dialog.value?.close()
        restoreScroll()
        opener?.focus()
      }
    },
    { immediate: true }
  )
  onBeforeUnmount(restoreScroll)

  function clearFeedback(field) {
    errors.value[field] = ''
    if (field === 'startTime') errors.value.endTime = ''
    error.value = ''
  }
  async function submit() {
    if (saving.value) return
    error.value = ''
    const next = {}
    if (!date.value) next.date = '请选择预约日期。'
    if (!startTime.value) next.startTime = '请选择开始时间。'
    if (!endTime.value) next.endTime = '请选择结束时间。'
    else if (startTime.value && startTime.value >= endTime.value)
      next.endTime = '结束时间必须晚于开始时间。'
    errors.value = next
    if (Object.keys(next).length) {
      await nextTick()
      dialog.value?.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    if (!props.lab?.id) {
      error.value = '实验室信息不完整，请关闭弹窗后重试。'
      return
    }
    saving.value = true
    try {
      await createReservation({
        lab_id: Number(props.lab.id),
        equipment_id: props.equipment?.id ? Number(props.equipment.id) : undefined,
        date: date.value,
        start_time: startTime.value,
        end_time: endTime.value,
        remark: remark.value.trim() || undefined
      })
      emit('success')
      emit('close')
    } catch (reason) {
      const data = reason?.response?.data
      error.value =
        (typeof reason === 'string'
          ? reason
          : data?.message || (typeof data?.detail === 'string' ? data.detail : '')) ||
        '预约提交失败，请稍后重试。'
    } finally {
      saving.value = false
    }
  }
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="reservation-dialog"
      aria-labelledby="reservation-title"
      @cancel.prevent="close"
      @click="event => event.target === event.currentTarget && close()"
    >
      <form novalidate :aria-busy="saving" @submit.prevent="submit">
        <header>
          <h2 id="reservation-title">预约实验室</h2>
          <button
            type="button"
            class="close-button"
            aria-label="关闭弹窗"
            :disabled="saving"
            @click="close"
          >
            <X :size="20" />
          </button>
        </header>
        <div class="reservation-context">
          <strong>{{ lab?.name }}</strong>
          <span v-if="equipment">设备：{{ equipment.name }}</span>
        </div>
        <div class="fields">
          <div
            v-for="field in [
              { key: 'date', label: '预约日期', type: 'date' },
              { key: 'startTime', label: '开始时间', type: 'time' },
              { key: 'endTime', label: '结束时间', type: 'time' }
            ]"
            :key="field.key"
            class="field"
            :class="{ 'field-wide': field.key === 'date' }"
          >
            <label :for="`reservation-${field.key}`">
              {{ field.label }}
              <span class="required" aria-hidden="true">*</span>
            </label>
            <input
              :id="`reservation-${field.key}`"
              :value="field.key === 'date' ? date : field.key === 'startTime' ? startTime : endTime"
              :type="field.type"
              required
              :disabled="saving"
              :aria-invalid="!!errors[field.key]"
              :aria-describedby="errors[field.key] ? `reservation-${field.key}-error` : undefined"
              @input="
                event => {
                  if (field.key === 'date') date = event.target.value
                  else if (field.key === 'startTime') startTime = event.target.value
                  else endTime = event.target.value
                  clearFeedback(field.key)
                }
              "
            />
            <p
              v-if="errors[field.key]"
              :id="`reservation-${field.key}-error`"
              role="alert"
              class="field-error"
            >
              {{ errors[field.key] }}
            </p>
          </div>
          <div class="field field-wide">
            <label for="reservation-remark">
              备注
              <span class="optional">选填</span>
            </label>
            <textarea
              id="reservation-remark"
              v-model="remark"
              rows="3"
              maxlength="200"
              :disabled="saving"
              placeholder="补充使用说明"
              @input="error = ''"
            ></textarea>
          </div>
        </div>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <footer>
          <button type="button" class="secondary-button" :disabled="saving" @click="close">
            取消
          </button>
          <button type="submit" class="primary-button" :disabled="saving">
            {{ saving ? '提交中…' : '确定预约' }}
          </button>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
  .reservation-dialog {
    --reservation-surface: #fff;
    --reservation-input: #f5f4f9;
    --reservation-ink: #25232d;
    --reservation-muted: #726d82;
    --reservation-line: #eeecf4;
    --reservation-accent: #514def;
    --reservation-error: #bc2941;
    color-scheme: light;
    position: fixed;
    inset: 0;
    width: min(460px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    margin: auto;
    padding: 0;
    overflow: auto;
    border: 1px solid var(--reservation-line);
    border-radius: 20px;
    background: var(--reservation-surface);
    color: var(--reservation-ink);
    box-shadow: 0 24px 70px #0005;
  }
  :global(html.dark .reservation-dialog) {
    --reservation-surface: #19191b;
    --reservation-input: #0f0f10;
    --reservation-ink: #f2f0f8;
    --reservation-muted: #b6b1c6;
    --reservation-line: #35343f;
    --reservation-error: #ff91a2;
    color-scheme: dark;
  }
  .reservation-dialog::backdrop {
    background: rgb(0 0 0 / 48%);
    backdrop-filter: blur(4px);
  }
  form {
    padding: 24px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 22px;
  }
  h2 {
    margin: 0;
    font-size: 21px;
    font-weight: 650;
  }
  .reservation-context {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    margin-bottom: 24px;
    border-radius: 12px;
    background: var(--reservation-input);
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .reservation-context span {
    color: var(--reservation-muted);
    font-size: 12px;
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 16px;
  }
  .field {
    min-width: 0;
  }
  .field-wide {
    grid-column: 1 / -1;
  }
  label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 9px;
    font-size: 14px;
    font-weight: 550;
  }
  .required {
    color: var(--reservation-error);
  }
  .optional {
    margin-left: auto;
    color: var(--reservation-muted);
    font-size: 11px;
    font-weight: 400;
  }
  input,
  textarea {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 0 16px;
    background: var(--reservation-input);
    color: var(--reservation-ink);
    font: inherit;
    font-size: 15px;
    outline: none;
    caret-color: var(--reservation-accent);
    transition: border-color 0.18s;
  }
  input {
    height: 50px;
  }
  input::-webkit-calendar-picker-indicator {
    cursor: pointer;
  }
  textarea {
    padding: 14px 16px;
    resize: vertical;
    min-height: 96px;
  }
  textarea::placeholder {
    color: var(--reservation-muted);
    font-size: 13px;
  }
  input:focus,
  textarea:focus {
    border-color: var(--reservation-accent);
    box-shadow: none;
    outline: none;
  }
  input[aria-invalid='true'] {
    border-color: var(--reservation-error);
  }
  .field-error,
  .form-error {
    margin-top: 7px;
    color: var(--reservation-error);
    font-size: 12px;
    line-height: 1.5;
  }
  .form-error {
    margin-top: 18px;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 28px;
    padding-top: 22px;
    border-top: 1px solid var(--reservation-line);
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 46px;
    border: 0;
    border-radius: 12px;
    padding: 0 22px;
    font: inherit;
    font-size: 14px;
    font-weight: 550;
    cursor: pointer;
    transition:
      background-color 0.18s,
      transform 0.18s;
  }
  .primary-button {
    background: var(--reservation-accent);
    color: #fff;
  }
  .primary-button:hover:not(:disabled) {
    background: #6555d5;
  }
  .secondary-button {
    background: var(--reservation-input);
    color: var(--reservation-ink);
  }
  .secondary-button:hover:not(:disabled),
  .close-button:hover:not(:disabled) {
    background: var(--reservation-line);
  }
  .close-button {
    width: 36px;
    min-height: 36px;
    padding: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--reservation-muted);
  }
  button:active:not(:disabled) {
    transform: scale(0.98);
  }
  button:focus-visible {
    outline: 2px solid var(--reservation-accent);
    outline-offset: 4px;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  input:disabled,
  textarea:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  @media (max-width: 480px) {
    form {
      padding: 22px 18px;
    }
    footer button {
      flex: 1;
      padding: 0 12px;
    }
    input {
      padding: 0 10px;
      font-size: 16px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button,
    input,
    textarea {
      transition: none;
    }
  }
</style>
