<script setup>
  import { computed, nextTick, onBeforeUnmount, reactive, ref } from 'vue'
  import {
    Building2,
    Check,
    ChevronDown,
    ImagePlus,
    LoaderCircle,
    Upload,
    X
  } from 'lucide-vue-next'
  import { gsap } from 'gsap'
  import { saveEquipment } from '@/api/equipment'
  import { uploadAvatar } from '@/api/file'
  import { avatarUrl } from '@/utils/avatar'

  const emit = defineEmits(['saved'])
  const drawer = ref(null)
  const fileInput = ref(null)
  const labPicker = ref(null)
  const visible = ref(false)
  const busy = ref(false)
  const labs = ref([])
  const labQuery = ref('')
  const labMenuOpen = ref(false)
  const form = reactive(initial())
  const errors = ref({})
  const error = ref('')
  const previewFailed = ref(false)
  const editing = ref(false)
  const title = computed(() => (editing.value ? '编辑设备' : '新增设备'))
  const selectedLab = computed(() => labs.value.find(lab => lab.id === form.lab_id))
  const filteredLabs = computed(() => {
    const keyword = labQuery.value.trim().toLowerCase()
    if (!keyword) return labs.value
    return labs.value.filter(lab =>
      [lab.name, lab.lab_code, lab.location].some(value => value?.toLowerCase().includes(keyword))
    )
  })
  const motionEnabled = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let opener
  let animation
  let openingFrame
  let version = 0

  function initial() {
    return {
      code: '',
      name: '',
      lab_id: null,
      description: '',
      img: '',
      sepc: '',
      quantity: 1,
      status: 1
    }
  }

  async function open(equipment, labOptions) {
    const current = ++version
    cancelAnimationFrame(openingFrame)
    animation?.kill()
    opener = document.activeElement
    editing.value = !!equipment
    labs.value = labOptions
    // Remove edit-only fields (especially id) before opening a new form.
    for (const key of Object.keys(form)) delete form[key]
    Object.assign(form, initial(), equipment || {})
    for (const field of ['code', 'name', 'description', 'sepc']) {
      form[field] = form[field] ?? ''
    }
    labQuery.value = ''
    errors.value = {}
    error.value = ''
    previewFailed.value = false
    visible.value = true
    document.body.classList.add('equipment-drawer-open')
    await nextTick()
    if (current !== version || !drawer.value) return
    const panel = drawer.value.querySelector('.drawer-panel')
    const scrim = drawer.value.querySelector('.drawer-scrim')
    gsap.set(panel, { xPercent: 100 })
    gsap.set(scrim, { opacity: 0 })
    openingFrame = requestAnimationFrame(() => {
      openingFrame = requestAnimationFrame(() => {
        if (current !== version) return
        animation = gsap.timeline({
          onComplete: () => panel.querySelector('#equipment-code')?.focus({ preventScroll: true })
        })
        animation.to(
          panel,
          { xPercent: 0, duration: motionEnabled() ? 0.38 : 0, ease: 'power3.inOut' },
          0
        )
        animation.to(scrim, { opacity: 1, duration: motionEnabled() ? 0.26 : 0 }, 0)
      })
    })
  }

  function close() {
    if (busy.value || !visible.value) return
    ++version
    cancelAnimationFrame(openingFrame)
    animation?.kill()
    labMenuOpen.value = false
    const panel = drawer.value.querySelector('.drawer-panel')
    const scrim = drawer.value.querySelector('.drawer-scrim')
    animation = gsap.timeline({
      onComplete: () => {
        visible.value = false
        document.body.classList.remove('equipment-drawer-open')
        opener?.focus({ preventScroll: true })
      }
    })
    animation.to(
      panel,
      { xPercent: 100, duration: motionEnabled() ? 0.38 : 0, ease: 'power3.inOut' },
      0
    )
    animation.to(scrim, { opacity: 0, duration: motionEnabled() ? 0.26 : 0 }, 0)
  }

  function chooseLab(lab) {
    form.lab_id = lab.id
    labMenuOpen.value = false
    labQuery.value = ''
    delete errors.value.lab_id
  }

  function onOutside(event) {
    if (!labPicker.value?.contains(event.target)) labMenuOpen.value = false
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      errors.value.img = '请选择 JPG、PNG 或 WebP 图片'
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      errors.value.img = '图片大小不能超过 5 MB'
      return
    }
    busy.value = true
    delete errors.value.img
    try {
      const response = await uploadAvatar(file)
      if (!response.data?.url) throw new Error('上传接口未返回图片地址')
      form.img = response.data.url
      previewFailed.value = false
    } catch (reason) {
      errors.value.img = reason.message || '图片上传失败，请重试'
    } finally {
      busy.value = false
    }
  }

  function message(reason) {
    if (typeof reason === 'string') return reason
    const data = reason?.response?.data
    if (Array.isArray(data?.detail)) {
      for (const issue of data.detail) {
        const key = issue.loc?.at(-1)
        if (key in form) errors.value[key] = issue.msg.replace(/^Value error, /, '')
      }
      return '请检查填写的信息。'
    }
    return data?.message || data?.detail || reason?.message || '保存失败，请重试。'
  }

  async function submit() {
    if (busy.value) return
    errors.value = {}
    error.value = ''
    if (!form.code.trim()) errors.value.code = '请输入设备编号'
    if (!form.name.trim()) errors.value.name = '请输入设备名称'
    if (!form.lab_id) errors.value.lab_id = '请选择所属实验室'
    if (!Number.isInteger(form.quantity) || form.quantity < 1)
      errors.value.quantity = '数量必须是大于 0 的整数'
    if (Object.keys(errors.value).length) {
      await nextTick()
      drawer.value.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    busy.value = true
    try {
      await saveEquipment({
        ...form,
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description?.trim() || null,
        img: form.img || null,
        sepc: form.sepc?.trim() || null
      })
      busy.value = false
      close()
      emit('saved')
    } catch (reason) {
      error.value = message(reason)
    } finally {
      busy.value = false
    }
  }

  onBeforeUnmount(() => {
    ++version
    cancelAnimationFrame(openingFrame)
    animation?.kill()
    document.body.classList.remove('equipment-drawer-open')
    document.removeEventListener('pointerdown', onOutside)
  })
  document.addEventListener('pointerdown', onOutside)
  defineExpose({ open })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="drawer"
      class="equipment-drawer"
      @click="event => event.target === drawer && close()"
    >
      <span class="drawer-scrim" aria-hidden="true" />
      <section
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-drawer-title"
        @keydown.esc.stop="close"
      >
        <header class="drawer-heading">
          <div>
            <h2 id="equipment-drawer-title">{{ title }}</h2>
          </div>
          <button
            class="icon-button close-button"
            type="button"
            aria-label="关闭抽屉"
            :disabled="busy"
            @click="close"
          >
            <X :size="20" />
          </button>
        </header>
        <form @submit.prevent="submit" :aria-busy="busy">
          <div class="drawer-fields">
            <div class="field-grid">
              <label for="equipment-code">
                <span>
                  设备编号
                  <b>*</b>
                </span>
                <input
                  id="equipment-code"
                  v-model="form.code"
                  maxlength="50"
                  autocomplete="off"
                  placeholder="如 EQ-OPT-001"
                  :disabled="busy"
                  :aria-invalid="!!errors.code"
                />
                <small v-if="errors.code" class="field-error">{{ errors.code }}</small>
              </label>
              <label for="equipment-name">
                <span>
                  设备名称
                  <b>*</b>
                </span>
                <input
                  id="equipment-name"
                  v-model="form.name"
                  maxlength="100"
                  placeholder="输入设备名称"
                  :disabled="busy"
                  :aria-invalid="!!errors.name"
                />
                <small v-if="errors.name" class="field-error">{{ errors.name }}</small>
              </label>
            </div>

            <div class="field-grid lab-field-row" :class="{ 'picker-open': labMenuOpen }">
              <div class="field" ref="labPicker" :class="{ 'picker-open': labMenuOpen }">
                <label for="lab-query">
                  <span>
                    所属实验室
                    <b>*</b>
                  </span>
                </label>
                <button
                  id="lab-query"
                  type="button"
                  class="lab-select"
                  :class="{ invalid: errors.lab_id }"
                  :disabled="busy"
                  :aria-expanded="labMenuOpen"
                  aria-haspopup="listbox"
                  @click="labMenuOpen = !labMenuOpen"
                >
                  <span class="lab-select-copy">
                    <strong>{{ selectedLab?.name || '请选择所属实验室' }}</strong>
                    <small v-if="selectedLab">
                      {{ selectedLab.lab_code }}
                      <template v-if="selectedLab.location">· {{ selectedLab.location }}</template>
                    </small>
                    <small v-else>选择设备所在的实验空间</small>
                  </span>
                  <ChevronDown :size="17" :class="{ rotated: labMenuOpen }" />
                </button>
                <small v-if="errors.lab_id" class="field-error">{{ errors.lab_id }}</small>
                <Transition name="picker-pop">
                  <div
                    v-if="labMenuOpen"
                    class="lab-options"
                    role="listbox"
                    aria-label="所属实验室"
                  >
                    <label class="lab-search" for="lab-search-input">
                      <input
                        id="lab-search-input"
                        v-model="labQuery"
                        placeholder="搜索名称、编号或位置"
                        :disabled="busy"
                      />
                    </label>
                    <button
                      v-for="lab in filteredLabs"
                      :key="lab.id"
                      type="button"
                      role="option"
                      :aria-selected="form.lab_id === lab.id"
                      @click="chooseLab(lab)"
                    >
                      <span class="lab-option-icon"><Building2 :size="17" /></span>
                      <span class="lab-option-copy">
                        <strong>{{ lab.name }}</strong>
                        <small>
                          {{ lab.lab_code }}
                          <template v-if="lab.location">· {{ lab.location }}</template>
                        </small>
                      </span>
                      <Check v-if="form.lab_id === lab.id" :size="16" class="selected-check" />
                    </button>
                    <p v-if="!filteredLabs.length" class="no-options">没有匹配的实验室</p>
                  </div>
                </Transition>
              </div>
              <label for="equipment-spec">
                <span>
                  型号规格
                  <em>选填</em>
                </span>
                <input
                  id="equipment-spec"
                  v-model="form.sepc"
                  maxlength="255"
                  placeholder="厂商型号或规格"
                  :disabled="busy"
                />
              </label>
            </div>

            <div class="field-grid quantity-status">
              <label for="equipment-quantity">
                <span>
                  设备数量
                  <b>*</b>
                </span>
                <input
                  id="equipment-quantity"
                  v-model.number="form.quantity"
                  type="number"
                  min="1"
                  step="1"
                  :disabled="busy"
                  :aria-invalid="!!errors.quantity"
                />
                <small v-if="errors.quantity" class="field-error">{{ errors.quantity }}</small>
              </label>
              <fieldset>
                <legend>设备状态</legend>
                <div class="segmented">
                  <span
                    class="segment-indicator"
                    :class="{ maintenance: form.status === 0 }"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    :aria-pressed="form.status === 1"
                    :disabled="busy"
                    @click="form.status = 1"
                  >
                    <i class="normal-dot" />
                    运行正常
                  </button>
                  <button
                    type="button"
                    :aria-pressed="form.status === 0"
                    :disabled="busy"
                    @click="form.status = 0"
                  >
                    <i class="repair-dot" />
                    维修检修
                  </button>
                </div>
              </fieldset>
            </div>

            <div class="image-field">
              <div class="field-title">
                <span>
                  设备图片
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
                class="image-upload"
                :class="{ filled: form.img && !previewFailed }"
                type="button"
                :disabled="busy"
                @click="fileInput.click()"
              >
                <img
                  v-if="form.img && !previewFailed"
                  :src="avatarUrl(form.img)"
                  alt="设备图片预览"
                  @error="previewFailed = true"
                />
                <span class="image-upload-copy">
                  <LoaderCircle v-if="busy" :size="22" class="spin" />
                  <Upload v-else-if="form.img" :size="22" />
                  <ImagePlus v-else :size="25" />
                  <strong>
                    {{ busy ? '正在上传…' : form.img ? '更换设备图片' : '上传设备图片' }}
                  </strong>
                  <small>JPG、PNG、WebP · 不超过 5 MB</small>
                </span>
              </button>
              <small v-if="errors.img" class="field-error">{{ errors.img }}</small>
            </div>

            <label for="equipment-description">
              <span>
                设备说明
                <em>选填</em>
              </span>
              <textarea
                id="equipment-description"
                v-model="form.description"
                rows="4"
                placeholder="设备用途、配置或维护说明"
                :disabled="busy"
              />
            </label>
            <p v-if="error" class="submit-error" role="alert">{{ error }}</p>
          </div>
          <footer class="drawer-footer">
            <span>
              <b>*</b>
              必填项目
            </span>
            <div>
              <button class="cancel-button" type="button" :disabled="busy" @click="close">
                取消
              </button>
              <button class="save-button" type="submit" :disabled="busy">
                {{ busy ? '正在保存…' : editing ? '保存修改' : '新增设备' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
  .equipment-drawer {
    --ink: #25232d;
    --muted: #716d80;
    --line: #eeecf4;
    --field: #f6f5f9;
    --accent: #514def;
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: flex;
    justify-content: flex-end;
    overflow: hidden;
    color: var(--ink);
  }
  :global(body.equipment-drawer-open) {
    overflow: hidden;
  }
  :global(html.dark .equipment-drawer) {
    --ink: #f2f0f8;
    --muted: #b6b1c6;
    --line: #35343f;
    --field: #101012;
    --accent: #a78bfa;
    color-scheme: dark;
  }
  .drawer-scrim {
    position: absolute;
    inset: 0;
    background: rgb(20 17 30 / 42%);
    backdrop-filter: blur(4px);
    pointer-events: none;
  }
  .drawer-panel {
    position: relative;
    width: min(620px, 100%);
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #fff;
    box-shadow: -16px 0 60px #0002;
    will-change: transform;
  }
  :global(html.dark .drawer-panel) {
    background: #19191b;
  }
  .drawer-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 13px 28px;
    border-bottom: 1px solid var(--line);
  }
  .eyebrow {
    display: none;
  }
  h2 {
    font-size: 21px;
    font-weight: 650;
  }
  .icon-button,
  .cancel-button,
  .save-button {
    min-height: 42px;
    padding: 0 15px;
    border-radius: 9px;
    font: inherit;
    cursor: pointer;
  }
  .close-button {
    width: 40px;
    padding: 0;
    color: var(--muted);
  }
  .drawer-panel form {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }
  .drawer-fields {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 25px;
    overflow-y: auto;
    padding: 26px 28px;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
  }
  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    align-items: start;
  }
  .field-grid.picker-open {
    position: relative;
    z-index: 40;
  }
  label,
  .field {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 9px;
    font-size: 13px;
    font-weight: 550;
  }
  label > span,
  .field > label > span,
  legend,
  .field-title > span {
    font-size: 13px;
    font-weight: 550;
  }
  b {
    color: var(--accent);
    font-weight: 500;
  }
  em {
    margin-left: 6px;
    color: var(--muted);
    font-size: 11px;
    font-style: normal;
    font-weight: 400;
  }
  input,
  textarea {
    width: 100%;
    min-width: 0;
    min-height: 46px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--field);
    color: var(--ink);
    padding: 12px 13px;
    font: inherit;
    outline: none;
  }
  input {
    caret-color: var(--accent);
    transition: border-color 0.2s;
  }
  textarea {
    resize: vertical;
    min-height: 110px;
    line-height: 1.8;
  }
  input:focus,
  textarea:focus,
  .lab-select:focus-visible {
    border-color: var(--accent);
    box-shadow: none;
  }
  [aria-invalid='true'] {
    border-color: #d64b58;
  }
  .field-error {
    color: #c63d4d;
    font-size: 12px;
    font-weight: 400;
  }
  .field {
    position: relative;
  }
  .field.picker-open {
    z-index: 41;
  }
  .lab-select {
    display: flex;
    width: 100%;
    min-height: 46px;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    border: 1px solid transparent;
    border-radius: 10px;
    background: var(--field);
    color: var(--ink);
    padding: 0 13px;
    text-align: left;
    cursor: pointer;
    font: inherit;
  }
  .lab-select.invalid {
    border-color: #d64b58;
  }
  .lab-select-copy,
  .lab-option-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 4px;
  }
  .lab-select-copy strong,
  .lab-option-copy strong {
    overflow: hidden;
    font-size: 13px;
    font-weight: 550;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lab-select-copy small,
  .lab-option-copy small {
    overflow: hidden;
    color: var(--muted);
    font-size: 11px;
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lab-select > svg {
    flex: none;
    color: var(--muted);
    transition: transform 0.18s;
  }
  .lab-select > svg.rotated {
    transform: rotate(180deg);
  }
  .lab-options {
    position: absolute;
    z-index: 42;
    top: calc(100% + 8px);
    right: 0;
    left: 0;
    max-height: min(290px, 45vh);
    overflow: auto;
    scrollbar-width: none;
    padding: 7px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 16px 36px #17132320;
  }
  .lab-options::-webkit-scrollbar {
    display: none;
  }
  :global(html.dark .lab-options) {
    background: #202023;
  }
  .lab-search {
    display: block;
    margin: 0 0 5px;
    background: #fff;
  }
  :global(html.dark .lab-search) {
    background: #202023;
  }
  .lab-search input {
    display: block;
    width: 100%;
    min-height: 38px;
    height: 38px;
    padding: 0 12px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--field);
    font-size: 12px;
  }
  .lab-options > button {
    display: flex;
    width: 100%;
    min-height: 54px;
    align-items: center;
    gap: 10px;
    padding: 7px 9px;
    border-radius: 8px;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .lab-options > button:hover,
  .lab-options > button[aria-selected='true'] {
    background: color-mix(in srgb, var(--accent) 8%, var(--field));
  }
  .lab-option-icon {
    display: grid;
    width: 32px;
    height: 32px;
    flex: none;
    place-items: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--accent) 10%, var(--field));
    color: var(--accent);
  }
  .selected-check {
    margin-left: auto;
    flex: none;
    color: var(--accent);
  }
  .no-options {
    padding: 16px 10px;
    color: var(--muted);
    font-size: 12px;
    text-align: center;
  }
  .picker-pop-enter-active,
  .picker-pop-leave-active {
    transition:
      opacity 0.14s,
      transform 0.14s;
    transform-origin: top;
  }
  .picker-pop-enter-from,
  .picker-pop-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  .quantity-status {
    align-items: end;
  }
  fieldset {
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 8px;
  }
  .segmented {
    position: relative;
    display: flex;
    min-height: 46px;
    gap: 4px;
    padding: 4px;
    border-radius: 9px;
    background: var(--field);
    isolation: isolate;
  }
  .segment-indicator {
    position: absolute;
    z-index: 0;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 12px) / 2);
    border-radius: 7px;
    background: #fff;
    box-shadow: 0 1px 4px #20183112;
    transition: transform 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
  }
  .segment-indicator.maintenance {
    transform: translateX(calc(100% + 4px));
  }
  .segmented button {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border-radius: 7px;
    color: var(--muted);
    font-size: 12px;
    cursor: pointer;
  }
  .segmented button[aria-pressed='true'] {
    color: var(--ink);
  }
  :global(html.dark .segmented button[aria-pressed='true']) {
    color: var(--ink);
  }
  :global(html.dark .segment-indicator) {
    background: #2a2a2e;
  }
  .segmented i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #26834c;
  }
  .segmented .repair-dot {
    background: #ae6909;
  }
  .image-field {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .field-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .text-button {
    color: var(--accent);
    font-size: 12px;
    cursor: pointer;
  }
  .image-upload {
    position: relative;
    display: flex;
    width: 100%;
    height: 170px;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border: 1px dashed var(--line);
    border-radius: 12px;
    background: var(--field);
    color: var(--muted);
    text-align: center;
    cursor: pointer;
  }
  .image-upload > img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .image-upload-copy {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 9px;
    z-index: 1;
    padding: 12px;
    color: var(--accent);
  }
  .image-upload-copy strong {
    color: var(--ink);
    font-size: 13px;
    font-weight: 550;
  }
  .image-upload-copy small {
    color: var(--muted);
    font-size: 11px;
  }
  .image-upload.filled::after {
    content: '';
    position: absolute;
    inset: 0;
    background: #0007;
    pointer-events: none;
  }
  .image-upload.filled .image-upload-copy,
  .image-upload.filled .image-upload-copy strong {
    color: #fff;
  }
  .image-upload.filled .image-upload-copy small {
    color: #f0eef5;
  }
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .submit-error {
    color: #c63d4d;
    font-size: 13px;
  }
  .drawer-footer {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 28px;
    border-top: 1px solid var(--line);
  }
  .drawer-footer > span {
    color: var(--muted);
    font-size: 12px;
  }
  .drawer-footer > div {
    display: flex;
    gap: 9px;
  }
  .cancel-button {
    border: 1px solid var(--line);
    background: transparent;
    color: var(--ink);
  }
  .save-button {
    background: #514def;
    color: #fff;
    font-weight: 550;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  @media (max-width: 540px) {
    .drawer-heading {
      padding: 13px 18px;
    }
    .drawer-fields {
      padding: 22px 18px;
    }
    .field-grid {
      grid-template-columns: 1fr;
    }
    .drawer-footer {
      padding: 16px 18px max(16px, env(safe-area-inset-bottom));
    }
    .drawer-footer > span {
      display: none;
    }
    .drawer-footer > div {
      width: 100%;
    }
    .drawer-footer button {
      flex: 1;
    }
    .image-upload {
      height: 160px;
    }
  }
</style>
