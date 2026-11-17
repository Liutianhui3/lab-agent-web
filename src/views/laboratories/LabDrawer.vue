<script setup>
  import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
  import { X, Upload, ImagePlus, Minus, Plus, Clock3, ChevronDown, Check } from 'lucide-vue-next'
  import { gsap } from 'gsap'
  import { saveLab } from '@/api/lab'
  import { uploadAvatar } from '@/api/file'
  const emit = defineEmits(['saved'])
  const drawer = ref(null),
    fileInput = ref(null),
    editing = ref(false),
    busy = ref(false),
    error = ref(''),
    fields = ref({}),
    previewFailed = ref(false)
  const visible = ref(false),
    timePicker = ref(null),
    timeHours = ref(8),
    timeMinutes = ref(30),
    activeTimeField = ref('open_time')
  const initial = () => ({
    lab_code: '',
    name: '',
    location: '',
    capacity: 0,
    description: '',
    img: '',
    open_time: '',
    close_time: '',
    status: 1
  })
  const form = reactive(initial())
  const title = computed(() => (editing.value ? '编辑实验室' : '新增实验室'))
  let opener
  let animation
  let openingFrame
  let operation = 0
  const motionEnabled = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  async function open(lab) {
    const current = ++operation
    cancelAnimationFrame(openingFrame)
    animation?.kill()
    opener = document.activeElement
    editing.value = !!lab
    // Remove edit-only fields (especially id) before opening a new form.
    for (const key of Object.keys(form)) delete form[key]
    Object.assign(form, initial(), lab || {})
    error.value = ''
    fields.value = {}
    previewFailed.value = false
    timePicker.value = null
    visible.value = true
    document.body.classList.add('lab-drawer-open')
    await nextTick()
    if (current !== operation || !drawer.value) return
    const panel = drawer.value.querySelector('.drawer-panel')
    const scrim = drawer.value.querySelector('.drawer-scrim')
    gsap.set(panel, { xPercent: 100 })
    gsap.set(scrim, { opacity: 0 })
    // Paint the offscreen state before starting either animation. Focus only
    // after arrival: focusing an offscreen input can scroll its overflow parent.
    openingFrame = requestAnimationFrame(() => {
      openingFrame = requestAnimationFrame(() => {
        if (current !== operation) return
        animation = gsap.timeline({
          onComplete: () => panel.querySelector('#lab-code')?.focus({ preventScroll: true })
        })
        animation.to(
          panel,
          {
            xPercent: 0,
            duration: motionEnabled() ? 0.4 : 0,
            ease: 'power3.inOut'
          },
          0
        )
        animation.to(scrim, { opacity: 1, duration: motionEnabled() ? 0.28 : 0 }, 0)
      })
    })
  }
  function close() {
    if (busy.value || !visible.value) return
    ++operation
    cancelAnimationFrame(openingFrame)
    animation?.kill()
    timePicker.value = null
    const panel = drawer.value.querySelector('.drawer-panel')
    const scrim = drawer.value.querySelector('.drawer-scrim')
    animation = gsap.timeline({
      onComplete: () => {
        visible.value = false
        document.body.classList.remove('lab-drawer-open')
        opener?.focus({ preventScroll: true })
      }
    })
    animation.to(
      panel,
      {
        xPercent: 100,
        duration: motionEnabled() ? 0.4 : 0,
        ease: 'power3.inOut'
      },
      0
    )
    animation.to(scrim, { opacity: 0, duration: motionEnabled() ? 0.28 : 0 }, 0)
  }
  function handleDrawerClick(event) {
    if (event.target === drawer.value) {
      close()
      return
    }
    if (timePicker.value && !event.target.closest('.time-popover, .time-trigger')) {
      timePicker.value = null
    }
  }
  function openTimePicker(field) {
    if (timePicker.value === field) {
      timePicker.value = null
      return
    }
    activeTimeField.value = field
    const [hour, minute] = (form[field] || '08:30').split(':').map(Number)
    timeHours.value = Number.isFinite(hour) ? hour : 8
    timeMinutes.value = Number.isFinite(minute) ? minute : 30
    timePicker.value = field
  }
  function setTime(hour = timeHours.value, minute = timeMinutes.value) {
    timeHours.value = (hour + 24) % 24
    timeMinutes.value = (minute + 60) % 60
  }
  function commitTime() {
    form[activeTimeField.value] =
      `${String(timeHours.value).padStart(2, '0')}:${String(timeMinutes.value).padStart(2, '0')}`
    timePicker.value = null
  }
  function handleWheelKey(event, unit) {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const step = event.key === 'ArrowUp' ? 1 : -1
    setTime(
      timeHours.value + (unit === 'hour' ? step : 0),
      timeMinutes.value + (unit === 'minute' ? step * 5 : 0)
    )
  }
  function clearTime() {
    form[activeTimeField.value] = ''
    timePicker.value = null
  }
  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      fields.value.img = '请选择 JPG、PNG 或 WebP 图片'
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      fields.value.img = '图片大小不能超过 5 MB'
      return
    }
    fields.value.img = ''
    busy.value = true
    try {
      const response = await uploadAvatar(file)
      if (!response.data?.url) throw new Error('上传接口未返回图片地址')
      form.img = response.data.url
      previewFailed.value = false
    } catch (reason) {
      fields.value.img = reason.message || '图片上传失败，请重试'
    } finally {
      busy.value = false
    }
    event.target.value = ''
  }
  async function submit() {
    if (busy.value) return
    fields.value = {}
    error.value = ''
    if (!form.lab_code.trim()) fields.value.lab_code = '请输入实验室编号'
    if (!form.name.trim()) fields.value.name = '请输入实验室名称'
    if (!Number.isInteger(form.capacity) || form.capacity < 0)
      fields.value.capacity = '请输入大于或等于 0 的整数'
    if ((form.open_time && !form.close_time) || (!form.open_time && form.close_time))
      fields.value.time = '请同时填写开始和结束时间，或同时留空'
    if (Object.keys(fields.value).length) {
      await nextTick()
      drawer.value.querySelector('[aria-invalid=true]')?.focus()
      return
    }
    busy.value = true
    try {
      await saveLab({
        ...form,
        lab_code: form.lab_code.trim(),
        name: form.name.trim(),
        location: form.location?.trim() || null,
        description: form.description?.trim() || null,
        img: form.img || null,
        open_time: form.open_time || null,
        close_time: form.close_time || null
      })
      busy.value = false
      close()
      emit('saved')
    } catch (reason) {
      error.value = reason.message
    } finally {
      busy.value = false
    }
  }
  onBeforeUnmount(() => {
    ++operation
    cancelAnimationFrame(openingFrame)
    animation?.kill()
    document.body.classList.remove('lab-drawer-open')
  })
  defineExpose({ open })
</script>
<template>
  <Teleport to="body">
    <div v-if="visible" ref="drawer" class="lab-drawer" @click="handleDrawerClick">
      <span class="drawer-scrim" aria-hidden="true" />
      <section
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-drawer-title"
        @keydown.esc.stop="close"
      >
        <header>
          <div>
            <h2 id="lab-drawer-title">{{ title }}</h2>
          </div>
          <button type="button" class="close" aria-label="关闭抽屉" :disabled="busy" @click="close">
            <X :size="21" />
          </button>
        </header>
        <form novalidate @submit.prevent="submit" :aria-busy="busy">
          <div class="drawer-fields">
            <div class="split code-row">
              <label for="lab-code">
                <span>
                  实验室编号
                  <b>*</b>
                </span>
                <input
                  id="lab-code"
                  v-model="form.lab_code"
                  maxlength="50"
                  autocomplete="off"
                  placeholder="如 LAB-OPT-204"
                  :aria-invalid="!!fields.lab_code"
                  :disabled="busy"
                />
                <small v-if="fields.lab_code" class="error">{{ fields.lab_code }}</small>
                <small v-else>唯一业务编号，不可与已有实验室重复</small>
              </label>
              <div class="status-control">
                <span>开放状态</span>
                <button
                  type="button"
                  role="switch"
                  :aria-checked="form.status === 1"
                  aria-label="实验室开放状态"
                  :disabled="busy"
                  @click="form.status = form.status === 1 ? 0 : 1"
                >
                  <span>{{ form.status === 1 ? '开放中' : '已关闭' }}</span>
                  <i :class="{ on: form.status === 1 }" />
                </button>
              </div>
            </div>
            <label for="lab-name">
              <span>
                实验室名称
                <b>*</b>
              </span>
              <input
                id="lab-name"
                v-model="form.name"
                maxlength="100"
                placeholder="输入实验室全称"
                :aria-invalid="!!fields.name"
                :disabled="busy"
              />
              <small v-if="fields.name" class="error">{{ fields.name }}</small>
            </label>
            <div class="split">
              <label for="lab-location">
                <span>
                  位置
                  <em>选填</em>
                </span>
                <input
                  id="lab-location"
                  v-model="form.location"
                  maxlength="255"
                  placeholder="楼宇、楼层或房间号"
                  :disabled="busy"
                />
              </label>
              <label for="lab-capacity">
                <span>额定容量</span>
                <div class="stepper">
                  <button
                    type="button"
                    aria-label="减少容量"
                    :disabled="busy || form.capacity <= 0"
                    @click="form.capacity = Math.max(0, form.capacity - 1)"
                  >
                    <Minus :size="16" />
                  </button>
                  <input
                    id="lab-capacity"
                    v-model.number="form.capacity"
                    type="number"
                    min="0"
                    step="1"
                    :disabled="busy"
                    :aria-invalid="!!fields.capacity"
                  />
                  <button
                    type="button"
                    aria-label="增加容量"
                    :disabled="busy"
                    @click="form.capacity++"
                  >
                    <Plus :size="16" />
                  </button>
                </div>
                <small v-if="fields.capacity" class="error">{{ fields.capacity }}</small>
                <small v-else>单位：人，未设置时为 0</small>
              </label>
            </div>
            <fieldset :class="{ 'time-picker-end': activeTimeField === 'close_time' }">
              <legend>
                开放时间
                <em>选填</em>
              </legend>
              <div class="split">
                <label for="lab-open">
                  <span class="time-label">开始时间</span>
                  <button
                    id="lab-open"
                    type="button"
                    class="time-trigger"
                    :aria-invalid="!!fields.time"
                    :aria-expanded="timePicker === 'open_time'"
                    aria-controls="lab-time-picker"
                    :disabled="busy"
                    @click="openTimePicker('open_time')"
                  >
                    <Clock3 :size="17" />
                    <span>{{ form.open_time || '选择开始时间' }}</span>
                    <ChevronDown :size="15" />
                  </button>
                </label>
                <label for="lab-close">
                  <span class="time-label">结束时间</span>
                  <button
                    id="lab-close"
                    type="button"
                    class="time-trigger"
                    :aria-invalid="!!fields.time"
                    :aria-expanded="timePicker === 'close_time'"
                    aria-controls="lab-time-picker"
                    :disabled="busy"
                    @click="openTimePicker('close_time')"
                  >
                    <Clock3 :size="17" />
                    <span>{{ form.close_time || '选择结束时间' }}</span>
                    <ChevronDown :size="15" />
                  </button>
                </label>
              </div>
              <small v-if="fields.time" class="error">{{ fields.time }}</small>
              <small v-else>可同时留空；结束时间早于开始时间表示跨日开放</small>
              <Transition name="time-picker">
                <div
                  v-if="timePicker"
                  id="lab-time-picker"
                  class="time-popover"
                  role="dialog"
                  aria-label="选择开放时间"
                  @keydown.esc.stop="timePicker = null"
                  @click.stop
                >
                  <div class="time-wheels">
                    <div class="wheel" aria-label="小时" @keydown="handleWheelKey($event, 'hour')">
                      <button
                        v-for="offset in [-2, -1, 0, 1, 2]"
                        :key="`h${offset}`"
                        type="button"
                        :class="{ selected: offset === 0 }"
                        @click="setTime(timeHours + offset, timeMinutes)"
                      >
                        {{ String((timeHours + offset + 24) % 24).padStart(2, '0') }}
                      </button>
                    </div>
                    <span class="time-colon">:</span>
                    <div
                      class="wheel"
                      aria-label="分钟"
                      @keydown="handleWheelKey($event, 'minute')"
                    >
                      <button
                        v-for="offset in [-2, -1, 0, 1, 2]"
                        :key="`m${offset}`"
                        type="button"
                        :class="{ selected: offset === 0 }"
                        @click="setTime(timeHours, timeMinutes + offset * 5)"
                      >
                        {{ String((timeMinutes + offset * 5 + 60) % 60).padStart(2, '0') }}
                      </button>
                    </div>
                  </div>
                  <div class="time-popover-footer">
                    <button type="button" class="text-button" @click="clearTime">清除</button>
                    <button type="button" class="time-done" @click="commitTime">
                      <Check :size="15" />
                      确定
                    </button>
                  </div>
                </div>
              </Transition>
            </fieldset>
            <div class="cover-field">
              <div class="field-title">
                <span>
                  封面图片
                  <em>选填</em>
                </span>
                <button
                  v-if="form.img"
                  type="button"
                  class="text-button"
                  :disabled="busy"
                  @click="form.img = ''"
                >
                  移除图片
                </button>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                @change="upload"
              />
              <button
                class="upload"
                :class="{ filled: form.img && !previewFailed }"
                type="button"
                :disabled="busy"
                @click="fileInput.click()"
              >
                <img
                  v-if="form.img && !previewFailed"
                  :src="form.img"
                  alt="实验室封面预览"
                  @error="previewFailed = true"
                />
                <span>
                  <Upload v-if="form.img && !previewFailed" :size="24" />
                  <ImagePlus v-else :size="28" />
                  <strong>{{ form.img ? '更换封面图片' : '点击上传封面图片' }}</strong>
                  <small>JPG、PNG、WebP · 不超过 5 MB</small>
                </span>
              </button>
              <small v-if="fields.img" class="error">{{ fields.img }}</small>
            </div>
            <label for="lab-description">
              <span>
                实验室描述
                <em>选填</em>
              </span>
              <textarea
                id="lab-description"
                v-model="form.description"
                rows="4"
                placeholder="介绍科研方向、实验环境与主要仪器…"
                :disabled="busy"
              />
            </label>
            <p v-if="error" class="error submit-error" role="alert">{{ error }}</p>
          </div>
          <footer>
            <span>带 * 的项目为必填项</span>
            <div>
              <button type="button" class="cancel" :disabled="busy" @click="close">取消</button>
              <button type="submit" class="primary" :disabled="busy">
                {{ busy ? '正在保存…' : editing ? '保存修改' : '新增实验室' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
  .lab-drawer {
    --d-bg: #fff;
    --d-input: #f5f4f9;
    --d-ink: #25232d;
    --d-muted: #716d80;
    --d-line: #eeecf4;
    --d-accent: #514def;
    position: fixed;
    z-index: 1000;
    inset: 0;
    margin: 0;
    padding: 0;
    border: 0;
    max-width: none;
    max-height: none;
    width: 100%;
    height: 100dvh;
    display: flex;
    justify-content: flex-end;
    color: var(--d-ink);
    overflow: hidden;
    isolation: isolate;
  }
  :global(body.lab-drawer-open) {
    overflow: hidden;
  }
  .drawer-scrim {
    position: absolute;
    z-index: 0;
    inset: 0;
    background: rgb(20 17 30 / 40%);
    backdrop-filter: blur(4px);
    pointer-events: none;
  }
  .drawer-panel {
    position: relative;
    z-index: 1;
    will-change: transform;
  }
  :global(html.dark .lab-drawer) {
    --d-bg: #19191b;
    --d-input: #0f0f10;
    --d-ink: #f2f0f8;
    --d-muted: #b6b1c6;
    --d-line: #35343f;
    --d-accent: #a78bfa;
    color-scheme: dark;
  }
  .drawer-panel {
    width: min(620px, 100%);
    height: 100%;
    background: var(--d-bg);
    box-shadow: -16px 0 60px #0002;
    display: flex;
    flex-direction: column;
  }
  .drawer-panel > header {
    padding: 13px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    border-bottom: 1px solid var(--d-line);
    flex-shrink: 0;
  }
  h2 {
    font-size: 21px;
    font-weight: 650;
  }
  .drawer-panel > header p {
    font-size: 12px;
    color: var(--d-muted);
    margin-top: 7px;
  }
  button {
    cursor: pointer;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 9px;
    padding: 0 15px;
    font: inherit;
    transition:
      background 0.2s,
      box-shadow 0.2s,
      transform 0.2s;
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button:active:not(:disabled) {
    transform: scale(0.98);
  }
  button:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
  }
  .close {
    width: 36px;
    height: 36px;
    min-height: 36px;
    flex-shrink: 0;
    padding: 0;
    border-radius: 50%;
    color: var(--d-muted);
  }
  .close:hover {
    background: var(--d-input);
    box-shadow: 0 3px 10px #0002;
  }
  .drawer-panel > form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .drawer-fields {
    overflow-y: auto;
    flex: 1;
    padding: 26px 28px;
    display: flex;
    flex-direction: column;
    gap: 25px;
    scrollbar-width: thin;
    scrollbar-color: var(--d-line) transparent;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 9px;
    min-width: 0;
    font-size: 13px;
    font-weight: 550;
  }
  em {
    font-style: normal;
    font-size: 11px;
    font-weight: 400;
    color: var(--d-muted);
    margin-left: 5px;
  }
  b {
    font-weight: 500;
    color: var(--d-accent);
  }
  input:not([type='file']),
  textarea {
    width: 100%;
    background: var(--d-input);
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 12px 13px;
    color: var(--d-ink);
    font: inherit;
    outline: none;
    caret-color: var(--d-accent);
    transition: border-color 0.2s;
  }
  input {
    min-height: 46px;
  }
  .time-trigger {
    width: 100%;
    min-height: 46px;
    justify-content: flex-start;
    border: 1px solid transparent;
    background: var(--d-input);
    color: var(--d-ink);
    border-radius: 10px;
    padding: 0 13px;
    font-size: 13px;
  }
  .time-trigger svg:first-child {
    color: var(--d-muted);
  }
  .time-trigger span {
    flex: 1;
    text-align: left;
  }
  .time-trigger svg:last-child {
    color: var(--d-muted);
    transition: transform 0.2s;
  }
  .time-trigger:hover {
    background: color-mix(in srgb, var(--d-accent) 7%, var(--d-input));
  }
  .time-trigger[aria-invalid='true'] {
    border-color: #e05265;
  }
  .time-popover {
    position: relative;
    z-index: 4;
    width: min(100%, 360px);
    margin-top: 10px;
    padding: 14px;
    background: var(--d-bg);
    border: 1px solid var(--d-line);
    border-radius: 14px;
    box-shadow: 0 12px 32px #0002;
    transform: translateY(0) scale(1);
  }
  .time-picker-end .time-popover {
    margin-left: auto;
  }
  .time-picker-enter-active,
  .time-picker-leave-active {
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }
  .time-picker-enter-from,
  .time-picker-leave-to {
    opacity: 0;
    transform: translateY(-5px) scale(0.98);
  }
  .time-wheels {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .wheel {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 90px;
    padding: 4px;
    border-radius: 10px;
    background: var(--d-input);
  }
  .wheel button {
    min-height: 34px;
    padding: 0;
    color: var(--d-muted);
    background: transparent;
    font-variant-numeric: tabular-nums;
  }
  .wheel button.selected {
    color: var(--d-accent);
    background: var(--d-bg);
    font-size: 16px;
    font-weight: 650;
    box-shadow: 0 1px 4px #0001;
  }
  .time-colon {
    font-size: 20px;
    font-weight: 650;
    color: var(--d-muted);
  }
  .time-popover-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--d-line);
  }
  .time-popover-footer .text-button {
    min-height: 36px;
  }
  .time-done {
    min-height: 36px;
    color: #fff;
    background: #514def;
    font-size: 12px;
  }
  input:focus,
  textarea:focus {
    border-color: var(--d-accent);
    box-shadow: none;
  }
  input[aria-invalid='true'] {
    border-color: #e05265;
  }
  input::placeholder,
  textarea::placeholder {
    color: var(--d-muted);
    font-weight: 400;
  }
  textarea {
    resize: vertical;
    min-height: 110px;
    line-height: 1.8;
  }
  .split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  small {
    font-size: 11px;
    color: var(--d-muted);
    font-weight: 400;
    line-height: 1.7;
  }
  .code-row {
    grid-template-columns: 1.4fr 1fr;
  }
  .status-control {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 9px;
    font-size: 13px;
    font-weight: 550;
  }
  .status-control button {
    background: var(--d-input);
    font-size: 12px;
  }
  .status-control i {
    position: relative;
    width: 36px;
    height: 22px;
    border-radius: 20px;
    background: #7a7c88;
    transition: background 0.2s;
  }
  .status-control i:after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    top: 3px;
    left: 3px;
    transition: transform 0.2s;
  }
  .status-control i.on {
    background: #23864b;
  }
  .status-control i.on:after {
    transform: translateX(14px);
  }
  .stepper {
    display: flex;
    align-items: center;
    background: var(--d-input);
    border: 1px solid transparent;
    border-radius: 10px;
  }
  .stepper:focus-within {
    border-color: var(--d-accent);
  }
  .stepper button {
    padding: 0;
    width: 40px;
    flex-shrink: 0;
    color: var(--d-muted);
  }
  .stepper input {
    background: transparent;
    border: 0;
    text-align: center;
    padding: 0;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .stepper input::-webkit-inner-spin-button {
    appearance: none;
  }
  .stepper input:focus {
    border: 0;
  }
  .stepper:has(input[aria-invalid='true']) {
    border-color: #e05265;
  }
  fieldset {
    position: relative;
    padding: 0;
    margin: 0;
    border: 0;
    min-width: 0;
  }
  legend,
  .field-title {
    font-size: 13px;
    font-weight: 550;
    margin-bottom: 10px;
  }
  .time-label {
    font-size: 11px;
    font-weight: 400;
    color: var(--d-muted);
  }
  fieldset > small {
    display: block;
    margin-top: 8px;
  }
  .field-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .text-button {
    min-height: 24px;
    padding: 0;
    color: var(--d-accent);
    font-size: 11px;
  }
  .upload {
    width: 100%;
    height: 170px;
    position: relative;
    overflow: hidden;
    border: 1px dashed var(--d-line);
    background: var(--d-input);
    color: var(--d-muted);
    padding: 0;
    border-radius: 12px;
  }
  .upload > span {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    z-index: 1;
  }
  .upload strong {
    font-size: 13px;
    font-weight: 550;
  }
  .upload > img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s;
  }
  .upload.filled:after {
    content: '';
    position: absolute;
    inset: 0;
    background: #0007;
  }
  .upload.filled {
    color: white;
  }
  .upload.filled small {
    color: #f0eef5;
  }
  .upload:hover > img {
    transform: scale(1.03);
  }
  .error {
    color: #e05265;
  }
  .submit-error {
    padding: 12px;
    background: #e0526510;
    border-radius: 9px;
    font-size: 13px;
  }
  form > footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 18px 28px;
    border-top: 1px solid var(--d-line);
    background: var(--d-bg);
    flex-shrink: 0;
  }
  form > footer > span {
    font-size: 11px;
    color: var(--d-muted);
  }
  form > footer > div {
    display: flex;
    gap: 10px;
  }
  .primary {
    background: #514def;
    color: #fff;
    font-weight: 550;
  }
  .primary:hover {
    background: #4540d9;
  }
  .cancel {
    border: 1px solid var(--d-line);
  }
  .cancel:hover {
    background: var(--d-input);
  }
  @media (max-width: 540px) {
    .drawer-panel > header {
      padding: 13px 18px;
    }
    .drawer-fields {
      padding: 22px 18px;
    }
    .split,
    .code-row {
      grid-template-columns: 1fr;
    }
    .status-control {
      align-items: flex-start;
    }
    .code-row {
      grid-template-columns: 1fr;
    }
    .status-control {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
    form > footer {
      padding: 16px 18px;
      padding-bottom: max(16px, env(safe-area-inset-bottom));
    }
    form > footer > span {
      display: none;
    }
    form > footer > div {
      width: 100%;
    }
    form > footer button {
      flex: 1;
    }
    .upload {
      height: 160px;
    }
  }
</style>
