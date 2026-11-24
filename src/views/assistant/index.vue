<script setup>
  import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    PanelLeft,
    SquarePen,
    Search,
    Trash2,
    Ellipsis,
    ArrowDown,
    Copy,
    Volume2,
    VolumeX,
    ChevronDown,
    ThumbsUp,
    ThumbsDown,
    Check,
    Download,
    X,
    MessageSquare,
    MessagesSquare
  } from 'lucide-vue-next'
  import MarkdownIt from 'markdown-it'
  import claudeLogo from '@/assets/images/claude.svg'
  import aiLogo from '@/assets/images/ai-logo.svg'
  import SnowfallBackground from '@/components/SnowfallBackground.vue'
  import ChatComposer from '@/components/ChatComposer.vue'
  import StreamingMarkdown from '@/components/StreamingMarkdown.vue'
  import ThinkingIndicator from '@/components/ThinkingIndicator.vue'
  import AdminActionCard from './components/AdminActionCard.vue'
  import ReservationCard from './components/ReservationCard.vue'
  import { useUserInfo } from '@/composables/useUserInfo'
  import {
    listConversations,
    getMessages,
    deleteConversation,
    streamChat,
    setMessageFeedback
  } from '@/api/chat'

  const { userInfo } = useUserInfo()
  const displayName = computed(() => userInfo.value.name || userInfo.value.username || '')
  const welcomeIndex = ref(0)
  const welcomeMessages = computed(() => [
    '今天想聊点什么？',
    displayName.value ? `嗨，${displayName.value}，准备好开始了吗？` : '嗨，准备好开始了吗？',
    displayName.value ? `很高兴见到你，${displayName.value}。` : '很高兴见到你。',
    '今天有什么安排？',
    '有什么我可以帮忙的？',
    '从一个问题开始吧。'
  ])
  welcomeIndex.value = Math.floor(Math.random() * welcomeMessages.value.length)
  const welcomeMessage = computed(() => welcomeMessages.value[welcomeIndex.value])
  const md = new MarkdownIt({ html: false, breaks: true, linkify: true })
  // 保留表格语义，仅让外层容器滚动，避免宽表格撑开聊天区域。
  md.renderer.rules.table_open = () => '<div class="markdown-table"><table>\n'
  md.renderer.rules.table_close = () => '</table></div>\n'
  md.core.ruler.after('inline', 'resource_match', state => {
    for (const { children } of state.tokens) {
      if (!children) continue
      let isResourceMatch = false
      for (const token of children) {
        if (token.type === 'link_open' && token.attrGet('href') === '#resource-match') {
          token.type = 'resource_match_open'
          isResourceMatch = true
        } else if (token.type === 'link_close' && isResourceMatch) {
          token.type = 'resource_match_close'
          isResourceMatch = false
        }
      }
    }
  })
  md.renderer.rules.resource_match_open = () => '<mark class="resource-match">'
  md.renderer.rules.resource_match_close = () => '</mark>'
  const route = useRoute(),
    router = useRouter()
  const showSearch = ref(false),
    searchInput = ref(),
    railToggle = ref(),
    sidebarToggle = ref()
  async function toggleSidebar(open) {
    sidebar.value = open
    await nextTick()
    ;(open ? sidebarToggle.value : railToggle.value)?.focus()
  }
  async function openSearch() {
    sidebar.value = true
    showSearch.value = true
    await nextTick()
    searchInput.value?.focus()
  }
  function toggleSearch() {
    if (showSearch.value) {
      showSearch.value = false
      search.value = ''
    } else openSearch()
  }
  const conversations = ref([]),
    messages = ref([]),
    draft = ref(''),
    enableThinking = ref(false),
    search = ref('')
  const sidebar = ref(window.innerWidth > 800),
    expanded = ref(false)
  const loading = ref(false),
    busy = ref(false),
    listLoading = ref(false),
    error = ref(''),
    listError = ref(''),
    copied = ref('')
  let copiedTimer
  const composer = ref(),
    scroller = ref(),
    shell = ref()
  const historyScrollbarVisible = ref(false)
  let historyScrollbarTimer
  function updateHistoryScrollbar() {
    historyScrollbarVisible.value = true
    clearTimeout(historyScrollbarTimer)
    historyScrollbarTimer = setTimeout(() => {
      historyScrollbarVisible.value = false
    }, 800)
  }
  const availableHeight = ref(0)
  const pendingDelete = ref(null),
    deleteDialog = ref(),
    deleting = ref(false)
  const activeId = computed(() => (typeof route.query.c === 'string' ? route.query.c : ''))
  const title = computed(
    () => conversations.value.find(c => c.id === activeId.value)?.title || 'Lab Agent'
  )
  const filtered = computed(() =>
    conversations.value.filter(c => c.title.toLowerCase().includes(search.value.toLowerCase()))
  )
  const listPage = ref(1),
    listTotal = ref(0)
  let controller,
    observer,
    loadVersion = 0
  const cache = new Map()
  const errorText = e =>
    e?.response?.data?.message || e?.message || (typeof e === 'string' ? e : '请求失败，请稍后重试')
  const isReservationCard = content => {
    try {
      return [
        'reservation_application',
        'reservation_approval',
        'reservation_cancellation'
      ].includes(JSON.parse(content)?.type)
    } catch {
      return false
    }
  }
  const isAdminAction = content => {
    if (typeof content !== 'string') return false
    try {
      const type = JSON.parse(content)?.type
      return (
        type === 'user_profile_edit' ||
        (userInfo.value.role === 'admin' && type?.startsWith('admin_user_') === true)
      )
    } catch {
      return false
    }
  }
  const historyList = ref()
  let listExhausted = false
  function loadAtBottom() {
    const list = historyList.value
    if (
      !list ||
      listLoading.value ||
      listError.value ||
      listExhausted ||
      conversations.value.length >= listTotal.value ||
      search.value.trim()
    )
      return
    if (list.scrollHeight - list.scrollTop - list.clientHeight <= 64) refreshList(true)
  }
  function onHistoryScroll() {
    updateHistoryScrollbar()
    loadAtBottom()
  }
  async function refreshList(more = false) {
    if (listLoading.value) return
    if (!more) listExhausted = false
    listLoading.value = true
    listError.value = ''
    try {
      const page = more ? listPage.value + 1 : 1
      const data = await listConversations(page)
      const existing = new Set(more ? conversations.value.map(item => item.id) : [])
      const added = data.items.filter(item => !existing.has(item.id))
      listExhausted = added.length === 0
      conversations.value = more ? [...conversations.value, ...added] : added
      listPage.value = page
      listTotal.value = data.total
    } catch (e) {
      listError.value = errorText(e)
    } finally {
      listLoading.value = false
      await nextTick()
      loadAtBottom()
    }
  }
  watch([sidebar, search], async () => {
    await nextTick()
    loadAtBottom()
  })
  async function loadHistory() {
    cancelScroll()
    messageEntrances.forEach(entrance => entrance.disconnect())
    messageEntrances.clear()
    const version = ++loadVersion,
      id = activeId.value
    error.value = ''
    expanded.value = false
    draft.value = ''
    if (!id) {
      messages.value = []
      loading.value = false
      await nextTick()
      if (version === loadVersion && !activeId.value) {
        composer.value?.focus()
      }
      return
    }
    messages.value = cache.get(id) || []
    loading.value = true
    try {
      let page = 1,
        all = [],
        data
      do {
        data = await getMessages(id, page++)
        all.push(...data.items)
      } while (all.length < data.total && data.items.length)
      if (version !== loadVersion) return
      messages.value = all
        .filter(m => ['user', 'assistant'].includes(m.role))
        .map(message => {
          if (message.role !== 'assistant' || !message.thinking_steps?.length) return message
          return {
            ...message,
            thinking: message.thinking_steps,
            thinkingVisible: message.thinking_steps,
            thinkingOpen: false,
            thinkingTouched: false,
            thinkingDuration: message.thinking_duration || 1
          }
        })
      cache.set(id, messages.value)
      await scrollBottom()
    } catch (e) {
      if (version === loadVersion) error.value = errorText(e)
    } finally {
      if (version === loadVersion) {
        loading.value = false
        await nextTick()
        if (version === loadVersion) {
          composer.value?.focus()
        }
      }
    }
  }
  function toggleThinking(message) {
    message.thinkingTouched = true
    message.thinkingOpen = !message.thinkingOpen
  }
  function select(id = '') {
    if (busy.value) return
    if (!id) {
      const count = welcomeMessages.value.length
      welcomeIndex.value =
        (welcomeIndex.value + 1 + Math.floor(Math.random() * (count - 1))) % count
    }
    router.replace({ path: '/assistant', query: id ? { c: id } : {} })
    if (!id && !activeId.value) {
      messages.value = []
      draft.value = ''
      expanded.value = false
      error.value = ''
    }
    if (window.innerWidth <= 800) sidebar.value = false
  }
  const showScrollBottom = ref(false)
  function updateScrollPosition() {
    const el = scroller.value
    showScrollBottom.value = !!el && el.scrollHeight - el.scrollTop - el.clientHeight > 80
  }
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let scrollFrame = 0,
    finishScroll
  function cancelScroll() {
    cancelAnimationFrame(scrollFrame)
    scrollFrame = 0
    finishScroll?.()
    finishScroll = undefined
  }
  function jumpToBottom() {
    scrollBottom(true, true)
  }
  async function scrollBottom(force = true, smooth = false) {
    await nextTick()
    const el = scroller.value
    // Streaming must not interrupt the send animation or pull readers back down.
    if (!el || (!force && (scrollFrame || el.scrollHeight - el.scrollTop - el.clientHeight >= 160)))
      return
    if (!smooth || reducedMotion()) {
      if (force) cancelScroll()
      el.scrollTop = el.scrollHeight
      updateScrollPosition()
      return
    }
    cancelScroll()
    const start = el.scrollTop
    const distance = el.scrollHeight - el.clientHeight - start
    if (distance <= 1) return
    const duration = Math.min(650, Math.max(320, distance * 0.18))
    const started = performance.now()
    await new Promise(resolve => {
      finishScroll = resolve
      function step(now) {
        const progress = Math.min(1, (now - started) / duration)
        // Re-read the destination as streamed text changes the document height.
        const destination = el.scrollHeight - el.clientHeight
        el.scrollTop = start + (destination - start) * (1 - Math.pow(1 - progress, 3))
        if (progress < 1) scrollFrame = requestAnimationFrame(step)
        else cancelScroll()
        updateScrollPosition()
      }
      scrollFrame = requestAnimationFrame(step)
    })
  }
  async function animateSend(userId, composerRect) {
    await nextTick()
    const composer = shell.value?.querySelector('.composer-zone')
    if (composerRect && composer && !reducedMotion()) {
      const offset = composerRect.top - composer.getBoundingClientRect().top
      composer.animate([{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }], {
        duration: 420,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
      })
    }
    const bubble = scroller.value?.querySelector(`[data-message-id="${userId}"] .user-bubble`)
    if (!bubble) return
    // Start the bubble arrival when it enters the viewport, even on long conversations.
    const entrance = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return
        entrance.disconnect()
        messageEntrances.delete(entrance)
        bubble.animate(
          reducedMotion()
            ? [{ opacity: 0.65 }, { opacity: 1 }]
            : [
                { opacity: 0.3, transform: 'translateY(16px) scale(0.96)' },
                { opacity: 1, transform: 'translateY(0) scale(1)' }
              ],
          { duration: reducedMotion() ? 120 : 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
        )
      },
      { root: scroller.value, threshold: 0.1 }
    )
    messageEntrances.add(entrance)
    entrance.observe(bubble)
  }
  const messageEntrances = new Set()
  async function send() {
    if (busy.value || loading.value || !draft.value.trim() || draft.value.length > 20000) return
    const content = draft.value,
      previousId = activeId.value
    const composerRect = !messages.value.length
      ? shell.value?.querySelector('.composer-zone')?.getBoundingClientRect()
      : null
    error.value = ''
    draft.value = ''
    expanded.value = false
    busy.value = true
    const user = { id: crypto.randomUUID(), role: 'user', content }
    const assistant = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      pending: true,
      thinking: [],
      thinkingVisible: [],
      thinkingRevealIndex: 0,
      thinkingRevealTimer: null,
      thinkingOpen: false,
      thinkingTouched: false,
      thinkingStartedAt: null,
      thinkingDuration: 0
    }
    messages.value.push(user, assistant)
    controller = new AbortController()
    let complete = false,
      streamId = previousId
    animateSend(user.id, composerRect)
    scrollBottom(true, true)
    try {
      await streamChat(
        {
          content,
          enable_thinking: enableThinking.value,
          ...(previousId ? { conversation_id: previousId } : {})
        },
        controller.signal,
        (event, data) => {
          const target = messages.value.find(m => m.id === assistant.id)
          if (event === 'start') streamId = data.conversation_id
          if (event === 'thinking' && target) {
            if (!target.thinkingStartedAt) {
              target.thinkingStartedAt = Date.now()
              if (!target.thinkingTouched) target.thinkingOpen = true
            }
            const current = target.thinking.find(step => step.stage === data.stage)
            if (current) Object.assign(current, data)
            else target.thinking.push({ ...data })
            if (!target.thinkingRevealTimer) {
              const revealNext = () => {
                if (target.thinkingRevealIndex >= target.thinking.length) {
                  target.thinkingRevealTimer = null
                  return
                }
                target.thinkingVisible.push(target.thinking[target.thinkingRevealIndex++])
                target.thinkingRevealTimer = setTimeout(revealNext, 360)
              }
              revealNext()
            }
            if (data.status === 'complete')
              target.thinkingDuration = Math.max(
                1,
                Math.round((Date.now() - target.thinkingStartedAt) / 1000)
              )
          }
          if (event === 'delta' && target) {
            target.thinkingDuration = Math.max(
              1,
              Math.round((Date.now() - target.thinkingStartedAt) / 1000)
            )
            if (!target.thinkingTouched) target.thinkingOpen = false
            target.content += data.content
          }
          if (event === 'done') {
            complete = true
            const thinkingState = target
              ? {
                  thinking: target.thinking,
                  thinkingVisible: target.thinkingVisible,
                  thinkingRevealIndex: target.thinkingRevealIndex,
                  thinkingOpen: target.thinkingOpen,
                  thinkingTouched: target.thinkingTouched,
                  thinkingStartedAt: target.thinkingStartedAt,
                  thinkingDuration: target.thinkingDuration || 1
                }
              : {}
            messages.value.splice(
              messages.value.length - 2,
              2,
              { ...data.user_message, clientId: user.id },
              { ...data.assistant_message, clientId: assistant.id, ...thinkingState }
            )
            cache.set(data.conversation_id, [...messages.value])
          }
        }
      )
    } catch (e) {
      const target = messages.value.find(m => m.id === assistant.id)
      if (target) {
        target.pending = false
        target.failed = true
      }
      error.value =
        e.name === 'AbortError' ? '已停止生成，本次问答未保存。可编辑后重新发送。' : errorText(e)
      draft.value = content
    } finally {
      const target = messages.value.find(m => (m.clientId || m.id) === assistant.id)
      if (target) target.pending = false
      busy.value = false
      controller = undefined
      if (complete) {
        if (streamId !== activeId.value) {
          skipHistory = streamId
          await router.replace({ path: '/assistant', query: { c: streamId } })
        }
        await refreshList()
      }
      await scrollBottom(false)
      composer.value?.focus()
    }
  }
  let skipHistory = ''
  watch(activeId, id => {
    if (skipHistory && id === skipHistory) {
      skipHistory = ''
      return
    }
    loadHistory()
  })
  const feedbackOptions = [
    { value: 'positive', label: '回复优秀', icon: ThumbsUp },
    { value: 'negative', label: '回复不佳', icon: ThumbsDown }
  ]
  const savingFeedback = ref(new Set())

  function closeFeedback(control) {
    control.open = false
    control.querySelector('summary')?.focus()
  }

  async function rateReply(message, rating, control) {
    if (savingFeedback.value.has(message.id)) return
    closeFeedback(control)
    savingFeedback.value.add(message.id)
    try {
      const result = await setMessageFeedback(
        message.conversation_id,
        message.id,
        message.feedback === rating ? null : rating
      )
      const current = messages.value.find(item => item.id === message.id)
      if (current) current.feedback = result.feedback
    } catch {
      error.value = '评价保存失败，请重试'
    } finally {
      savingFeedback.value.delete(message.id)
    }
  }
  const speakingId = ref(null)
  const speech = window.speechSynthesis
  const canReadAloud = !!speech && typeof window.SpeechSynthesisUtterance === 'function'
  let speechRun = 0

  function stopReading() {
    if (speakingId.value === null) return
    speechRun++
    speakingId.value = null
    speech.cancel()
  }

  function toggleReading(message) {
    const wasSpeaking = speakingId.value === message.id
    stopReading()
    if (wasSpeaking || !canReadAloud) return

    const template = document.createElement('template')
    template.innerHTML = md.render(message.content)
    const text = Array.from(template.content.children, block => block.textContent.trim())
      .filter(Boolean)
      .join('。')
    const chunks = text.match(/[^。！？!?\n]{1,120}[。！？!?]?|[。！？!?]+/gu) || []
    if (!chunks.length) return

    const run = ++speechRun
    speakingId.value = message.id
    const lang = /\p{Script=Han}/u.test(text) ? 'zh-CN' : navigator.language
    function speakChunk(index) {
      if (run !== speechRun) return
      if (index === chunks.length) {
        speakingId.value = null
        return
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index])
      utterance.lang = lang
      utterance.onend = () => speakChunk(index + 1)
      utterance.onerror = () => {
        if (run !== speechRun) return
        speakingId.value = null
        error.value = '朗读失败，请重试'
      }
      speech.speak(utterance)
    }
    speakChunk(0)
  }

  watch(activeId, stopReading)

  async function copy(message) {
    try {
      await navigator.clipboard.writeText(message.content)
      clearTimeout(copiedTimer)
      copied.value = message.id
      copiedTimer = setTimeout(() => {
        copied.value = ''
      }, 2000)
    } catch {
      error.value = '复制失败，请手动选择文本复制'
    }
  }
  function exportChat() {
    const blob = new Blob(
      [
        messages.value
          .map(m => `## ${m.role === 'user' ? '你' : 'Lab Agent'}\n\n${m.content}`)
          .join('\n\n')
      ],
      { type: 'text/markdown;charset=utf-8' }
    )
    const url = URL.createObjectURL(blob),
      a = document.createElement('a')
    a.href = url
    a.download = `${title.value.replace(/[/\\:*?"<>|]/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }
  const menuConversation = ref(null),
    menuPosition = ref({}),
    menuAction = ref()
  let menuTrigger
  function closeMenu(restoreFocus = true) {
    menuConversation.value = null
    if (restoreFocus && menuTrigger?.isConnected) menuTrigger.focus()
  }
  async function openMenu(item, event) {
    if (menuConversation.value?.id === item.id) {
      closeMenu()
      return
    }
    menuTrigger = event.currentTarget
    const rect = menuTrigger.getBoundingClientRect()
    menuPosition.value = {
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 184))}px`,
      top: `${rect.bottom + 82 > window.innerHeight ? rect.top - 74 : rect.bottom + 6}px`
    }
    menuConversation.value = item
    await nextTick()
    menuAction.value?.focus()
  }
  function dismissMenu(event) {
    if (!event.target.closest('.conversation-menu, .conversation-menu-trigger')) closeMenu(false)
  }
  function menuEscape(event) {
    if (event.key === 'Escape' && menuConversation.value) {
      event.preventDefault()
      closeMenu()
    }
  }
  async function closeDeleteDialog() {
    if (!deleteDialog.value?.open) return
    const dialog = deleteDialog.value
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      await dialog.animate(
        [
          { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
          { opacity: 0, transform: 'translate(-50%, calc(-50% + 6px)) scale(.97)' }
        ],
        { duration: 140, easing: 'ease-in', fill: 'forwards' }
      ).finished
    }
    dialog.close()
    dialog.getAnimations().forEach(animation => animation.cancel())
    menuTrigger?.focus()
  }
  function cancelDelete(event) {
    event.preventDefault()
    if (!deleting.value) closeDeleteDialog()
  }
  async function askDelete(item) {
    closeMenu(false)
    pendingDelete.value = item
    await nextTick()
    deleteDialog.value.showModal()
  }
  async function remove() {
    deleting.value = true
    try {
      const id = pendingDelete.value.id
      await deleteConversation(id)
      cache.delete(id)
      if (activeId.value === id) select()
      await closeDeleteDialog()
      await refreshList()
    } catch (e) {
      error.value = errorText(e)
      await closeDeleteDialog()
    } finally {
      deleting.value = false
    }
  }
  onMounted(() => {
    document.addEventListener('pointerdown', dismissMenu)
    document.addEventListener('keydown', menuEscape)
    window.addEventListener('resize', closeMenu)
    shell.value.addEventListener('scroll', dismissMenu, true)
    refreshList()
    loadHistory()
    observer = new ResizeObserver(() => {
      availableHeight.value = shell.value.clientHeight
    })
    observer.observe(shell.value)
    availableHeight.value = shell.value.clientHeight
  })
  onBeforeUnmount(() => {
    stopReading()
    clearTimeout(copiedTimer)
    clearTimeout(historyScrollbarTimer)
    cancelScroll()
    messageEntrances.forEach(entrance => entrance.disconnect())
    document.removeEventListener('pointerdown', dismissMenu)
    document.removeEventListener('keydown', menuEscape)
    window.removeEventListener('resize', closeMenu)
    shell.value?.removeEventListener('scroll', dismissMenu, true)
    controller?.abort()
    observer?.disconnect()
    loadVersion++
  })
</script>

<template>
  <section ref="shell" class="assistant-shell">
    <button
      v-if="sidebar"
      class="sidebar-backdrop"
      aria-label="关闭会话侧栏"
      @click="toggleSidebar(false)"
    />
    <aside class="chat-sidebar" :class="{ open: sidebar }" aria-label="会话导航">
      <nav class="sidebar-rail" :inert="sidebar" :aria-hidden="sidebar" aria-label="快捷导航">
        <button
          ref="railToggle"
          class="icon-button rail-toggle"
          aria-label="展开会话侧栏"
          title="展开侧栏"
          aria-controls="assistant-sidebar-content"
          :aria-expanded="sidebar"
          @click="toggleSidebar(true)"
        >
          <img class="rail-logo" :src="aiLogo" alt="" />
          <PanelLeft class="rail-expand-icon" :size="21" />
        </button>
        <button
          class="icon-button rail-new"
          :class="{ selected: !activeId }"
          :aria-current="!activeId ? 'page' : undefined"
          aria-label="新对话"
          title="新对话"
          :disabled="busy"
          @click="select()"
        >
          <SquarePen :size="21" />
        </button>
        <button class="icon-button" aria-label="搜索对话" title="搜索对话" @click="openSearch">
          <Search :size="21" />
        </button>
        <button
          class="icon-button"
          aria-label="查看最近对话"
          title="最近对话"
          @click="toggleSidebar(true)"
        >
          <MessageSquare :size="21" />
        </button>
      </nav>
      <div
        id="assistant-sidebar-content"
        class="sidebar-content"
        :inert="!sidebar"
        :aria-hidden="!sidebar"
      >
        <div class="sidebar-heading">
          <div class="sidebar-brand">
            <img :src="aiLogo" alt="Claude" v-if="!sidebar" />
            <span>AI助手</span>
          </div>
          <button
            class="icon-button"
            aria-label="搜索对话"
            title="搜索对话"
            :aria-expanded="showSearch"
            @click="toggleSearch"
          >
            <Search :size="19" />
          </button>
          <button
            ref="sidebarToggle"
            class="icon-button"
            aria-label="收起侧栏"
            title="收起侧栏"
            aria-controls="assistant-sidebar-content"
            :aria-expanded="sidebar"
            @click="toggleSidebar(false)"
          >
            <PanelLeft :size="20" />
          </button>
        </div>
        <button
          class="new-chat"
          :class="{ selected: !activeId }"
          :aria-current="!activeId ? 'page' : undefined"
          :disabled="busy"
          @click="select()"
        >
          <SquarePen :size="18" />
          新对话
        </button>
        <Transition name="sidebar-search">
          <div v-show="showSearch" class="sidebar-search" :inert="!showSearch">
            <div class="sidebar-search-content">
              <label class="search-box">
                <Search :size="16" />
                <input
                  ref="searchInput"
                  v-model="search"
                  aria-label="搜索对话"
                  placeholder="搜索对话"
                />
              </label>
            </div>
          </div>
        </Transition>
        <div class="history-heading">最近</div>
        <div
          ref="historyList"
          class="history-list"
          :aria-busy="listLoading"
          :class="{ 'scrollbar-visible': historyScrollbarVisible }"
          @scroll.passive="onHistoryScroll"
        >
          <p v-if="listError" class="list-error">
            {{ listError }}
            <button @click="refreshList(conversations.length > 0)">重新加载</button>
          </p>
          <div v-else-if="!listLoading && !conversations.length" class="history-empty-state">
            <div class="history-empty-icon" aria-hidden="true">
              <MessagesSquare :size="28" :stroke-width="1.5" />
            </div>
            <p class="history-empty-title">暂无历史会话</p>
            <p class="history-empty-description">点击上方「新对话」，开始与AI助手交流。</p>
          </div>
          <TransitionGroup name="history-item">
            <div
              v-for="item in filtered"
              :key="item.id"
              class="history-row"
              :class="{
                active: activeId === item.id,
                'menu-open': menuConversation?.id === item.id
              }"
            >
              <button
                class="history-title"
                :disabled="busy"
                :aria-current="activeId === item.id ? 'page' : undefined"
                @click="select(item.id)"
              >
                <span>{{ item.title }}</span>
              </button>
              <button
                class="delete-button icon-button conversation-menu-trigger"
                :disabled="busy"
                :aria-label="`对话选项：${item.title}`"
                aria-haspopup="menu"
                :aria-expanded="menuConversation?.id === item.id"
                @click="openMenu(item, $event)"
              >
                <Ellipsis :size="18" />
              </button>
            </div>
          </TransitionGroup>
          <div v-if="listLoading" class="history-skeleton" role="status" aria-label="正在加载会话">
            <span v-for="index in 3" :key="index" aria-hidden="true"></span>
          </div>
          <div
            v-if="search && conversations.length && !filtered.length"
            class="history-search-empty"
          >
            <Search :size="30" :stroke-width="1.7" aria-hidden="true" />
            <span>无结果</span>
          </div>
        </div>
      </div>
    </aside>
    <div class="chat-main">
      <div class="chat-body" :class="{ welcome: !messages.length && !loading, expanded }">
        <SnowfallBackground v-if="!messages.length && !loading" />
        <div
          v-if="loading || messages.length"
          ref="scroller"
          class="message-scroll"
          @scroll.passive="updateScrollPosition"
          @wheel.passive="cancelScroll"
          @touchstart.passive="cancelScroll"
          @keydown="cancelScroll"
          tabindex="0"
          aria-label="聊天消息"
        >
          <div class="message-list">
            <div v-if="loading && !messages.length" class="conversation-skeleton" role="status">
              <span class="sr-only">正在加载对话…</span>
              <span class="conversation-skeleton-line" aria-hidden="true"></span>
              <span class="conversation-skeleton-line" aria-hidden="true"></span>
            </div>
            <article
              v-for="message in messages"
              :key="message.clientId || message.id"
              :data-message-id="message.clientId || message.id"
              class="message"
              :class="message.role"
            >
              <template v-if="message.role === 'assistant'">
                <div class="assistant-label">
                  <img class="assistant-avatar" :src="aiLogo" alt="" aria-hidden="true" />
                  <span>AI助手</span>
                </div>
                <div
                  v-if="message.thinking?.length"
                  class="thinking-panel"
                  :class="{ open: message.thinkingOpen }"
                >
                  <button
                    type="button"
                    class="thinking-toggle"
                    :aria-expanded="message.thinkingOpen"
                    @click="toggleThinking(message)"
                  >
                    <ThinkingIndicator v-if="message.pending" label="正在思考…" />
                    <span v-else>思考了 {{ message.thinkingDuration || 1 }} 秒</span>
                    <ChevronDown :size="16" class="thinking-chevron" aria-hidden="true" />
                  </button>
                  <Transition name="thinking-collapse">
                    <div v-show="message.thinkingOpen" class="thinking-details">
                      <TransitionGroup name="thinking-step" tag="ol" class="thinking-steps">
                        <li
                          v-for="step in message.thinkingVisible || message.thinking"
                          :key="step.stage"
                          :class="step.status"
                        >
                          <span class="thinking-dot" aria-hidden="true" />
                          {{ step.label }}
                        </li>
                      </TransitionGroup>
                    </div>
                  </Transition>
                </div>
                <Transition name="admin-card">
                  <AdminActionCard
                    v-if="isAdminAction(message.content)"
                    :content="message.content"
                  />
                </Transition>
                <ReservationCard
                  v-if="isReservationCard(message.content)"
                  :content="message.content"
                />
                <template
                  v-if="!isAdminAction(message.content) && !isReservationCard(message.content)"
                >
                  <StreamingMarkdown
                    v-if="message.content || message.pending"
                    :content="message.content"
                    :pending="!!message.pending"
                    :render-markdown="text => md.render(text)"
                    @progress="scrollBottom(false)"
                    @settled="scrollBottom(false)"
                  />
                </template>
                <ThinkingIndicator
                  v-if="!message.content && message.pending && !message.thinking?.length"
                />
                <p v-if="message.failed" class="failed">本次回复未保存</p>
                <div v-if="message.content && !message.pending" class="reply-actions">
                  <button
                    class="icon-button copy-button"
                    :aria-label="copied === message.id ? '已复制' : '复制回复'"
                    @click="copy(message)"
                  >
                    <Check v-if="copied === message.id" :size="16" />
                    <Copy v-else :size="16" />
                  </button>
                  <details
                    v-if="message.conversation_id && !message.failed"
                    name="reply-feedback"
                    class="reply-feedback"
                    @focusout="
                      event => {
                        if (!event.currentTarget.contains(event.relatedTarget))
                          event.currentTarget.open = false
                      }
                    "
                    @keydown.esc.stop="closeFeedback($event.currentTarget)"
                    @toggle="
                      $event.currentTarget.open &&
                      $event.currentTarget
                        .querySelector('.feedback-options')
                        .scrollIntoView({ block: 'nearest' })
                    "
                  >
                    <summary
                      class="icon-button"
                      :class="{ 'is-rated': message.feedback }"
                      :aria-label="
                        feedbackOptions.find(option => option.value === message.feedback)?.label ||
                        '评价回复'
                      "
                      title="评价回复"
                    >
                      <ThumbsUp
                        v-if="message.feedback === 'positive'"
                        :size="16"
                        fill="currentColor"
                        aria-hidden="true"
                      />
                      <ThumbsDown
                        v-else-if="message.feedback === 'negative'"
                        :size="16"
                        fill="currentColor"
                        aria-hidden="true"
                      />
                      <span v-else class="feedback-icon" aria-hidden="true">
                        <ThumbsUp :size="14" />
                        <ThumbsDown :size="14" />
                      </span>
                    </summary>
                    <div class="feedback-options">
                      <button
                        v-for="option in feedbackOptions"
                        :key="option.value"
                        type="button"
                        :disabled="savingFeedback.has(message.id)"
                        :aria-pressed="message.feedback === option.value"
                        @click="
                          rateReply(message, option.value, $event.currentTarget.closest('details'))
                        "
                      >
                        <component :is="option.icon" :size="17" />
                        {{ option.label }}
                        <Check
                          v-if="message.feedback === option.value"
                          :size="14"
                          class="rating-check"
                        />
                      </button>
                    </div>
                  </details>
                  <button
                    v-if="canReadAloud && !message.failed"
                    type="button"
                    class="icon-button read-aloud-button"
                    :class="{ 'is-speaking': speakingId === message.id }"
                    :aria-label="speakingId === message.id ? '停止朗读' : '朗读回复'"
                    :title="speakingId === message.id ? '停止朗读' : '朗读回复'"
                    @click="toggleReading(message)"
                  >
                    <VolumeX v-if="speakingId === message.id" :size="16" aria-hidden="true" />
                    <Volume2 v-else :size="16" aria-hidden="true" />
                  </button>
                </div>
              </template>
              <div v-else class="user-bubble">{{ message.content }}</div>
            </article>
          </div>
        </div>
        <h1 v-if="!messages.length && !loading" class="welcome-title">{{ welcomeMessage }}</h1>
        <div class="composer-zone">
          <Transition name="scroll-bottom">
            <button
              v-if="showScrollBottom && messages.length && !expanded"
              type="button"
              class="scroll-bottom-button"
              aria-label="回到最新消息"
              title="回到底部"
              @click="jumpToBottom"
            >
              <ArrowDown :size="20" />
            </button>
          </Transition>
          <div v-if="error" class="error-banner" role="alert">
            <span>{{ error }}</span>
            <button class="icon-button" aria-label="关闭提示" @click="error = ''">
              <X :size="16" />
            </button>
          </div>
          <ChatComposer
            ref="composer"
            v-model="draft"
            v-model:thinking="enableThinking"
            v-model:expanded="expanded"
            class="assistant-composer"
            placeholder="询问你想解决的问题"
            aria-label="发送消息给 Lab Agent"
            :disabled="loading"
            :busy="busy"
            :available-height="availableHeight"
            @send="send"
            @stop="controller?.abort()"
          />
        </div>
      </div>
    </div>
    <Transition name="conversation-menu">
      <div
        v-if="menuConversation"
        class="conversation-menu"
        :style="menuPosition"
        role="menu"
        aria-label="对话选项"
        @keydown.tab="closeMenu(false)"
      >
        <button
          ref="menuAction"
          role="menuitem"
          class="menu-delete"
          :disabled="busy"
          @click="askDelete(menuConversation)"
        >
          <Trash2 :size="18" />
          <span>删除</span>
        </button>
      </div>
    </Transition>
    <dialog ref="deleteDialog" class="delete-dialog" @cancel="cancelDelete">
      <h2>删除对话？</h2>
      <p>“{{ pendingDelete?.title }}”将被永久删除。</p>
      <div>
        <button :disabled="deleting" @click="closeDeleteDialog">取消</button>
        <button class="danger" :disabled="deleting" @click="remove">
          {{ deleting ? '删除中…' : '删除' }}
        </button>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
  @property --history-scrollbar-thumb {
    syntax: '<color>';
    inherits: true;
    initial-value: transparent;
  }
  .assistant-shell {
    --chat-bg: #fff;
    --quote-line: #e3e3e3;
    --sidebar-bg: #f8f8fa;
    --sidebar-text: #8f8f8f;
    --sidebar-content-text: #0d0d0d;
    --user-bubble-bg: #7b74f3;
    --user-bubble-text: #fff;
    --resource-match-text: #6258d6;
    --input-bg: #f3f3f5;
    --chat-text: #242428;
    --muted: #818187;
    --line: #e7e7eb;
    --hover: #eaeaec;
    --accent: #7b74f3;
    --accent-hover: #7b74f3;
    --input-scrollbar: #d4d4d8;
    --input-scrollbar-hover: #b9b9c2;
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--chat-bg);
    color: var(--chat-text);
    position: relative;
  }
  :global(.dark .assistant-shell) {
    --chat-bg: #000000;
    --quote-line: #292929;
    --sidebar-bg: #171718;
    --sidebar-text: #afafaf;
    --sidebar-content-text: #afafaf;
    --user-bubble-bg: #23213d;
    --user-bubble-text: #f5f5f7;
    --resource-match-text: #a69fff;
    --input-bg: #242425;
    --chat-text: #ececed;
    --muted: #96969c;
    --line: #303033;
    --hover: #2b2b2e;
    --input-scrollbar: #333;
    --input-scrollbar-hover: #333;
  }
  button,
  input,
  textarea {
    font: inherit;
  }
  button {
    cursor: pointer;
    color: inherit;
    transition:
      background 0.18s,
      transform 0.18s;
  }
  button:active:not(:disabled) {
    transform: scale(0.96);
  }
  button:disabled {
    cursor: default;
    opacity: 0.45;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .icon-button {
    border: 0;
    background: transparent;
    width: 36px;
    height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    flex-shrink: 0;
  }
  .icon-button:hover {
    background: var(--hover);
  }
  .chat-sidebar {
    color: var(--sidebar-text);
    position: relative;
    width: 56px;
    flex-shrink: 0;
    overflow: hidden;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--line);
    transition: width 0.3s cubic-bezier(0.22, 0.7, 0.25, 1);
  }
  .chat-sidebar.open {
    width: 280px;
  }
  .sidebar-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 279px;
    padding: 6px 10px 0px 10px;
    opacity: 0;
    visibility: hidden;
    transform: translateX(-10px);
    transition:
      opacity 0.15s ease,
      transform 0.25s ease,
      visibility 0s 0.15s;
  }
  .open .sidebar-content {
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
    transition-delay: 0.08s, 0s, 0s;
  }
  .sidebar-rail {
    position: absolute;
    inset: 0 auto 0 0;
    width: 55px;
    padding: 12px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    opacity: 1;
    visibility: visible;
    transition:
      opacity 0.15s ease 0.1s,
      visibility 0s 0.1s;
  }
  .open .sidebar-rail {
    opacity: 0;
    visibility: hidden;
    transition-delay: 0s, 0.15s;
  }
  .sidebar-rail .icon-button {
    width: 32px;
    height: 32px;
  }
  .rail-toggle {
    position: relative;
    margin-bottom: 12px;
  }
  .rail-logo {
    width: 32px;
    height: 32px;
    transition: opacity 0.15s ease;
  }
  .sidebar-rail .rail-new,
  .sidebar-rail .rail-search,
  .sidebar-rail .rail-history {
    width: 32px;
    height: 32px;
  }
  .sidebar-rail .icon-button :deep(svg) {
    width: 19px;
    height: 19px;
  }
  .rail-expand-icon {
    position: absolute;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  .rail-toggle:hover .rail-logo,
  .rail-toggle:focus-visible .rail-logo {
    opacity: 0;
  }
  .rail-toggle:hover .rail-expand-icon,
  .rail-toggle:focus-visible .rail-expand-icon {
    opacity: 1;
  }
  .rail-new.selected,
  .new-chat.selected {
    background: var(--hover);
  }
  .sidebar-heading {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 44px;
    margin-bottom: 14px;
    padding-left: 10px;
  }
  .sidebar-brand {
    color: var(--chat-text);
    display: flex;
    align-items: center;
    gap: 9px;
    flex: 1;
    min-width: 0;
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
  }
  .sidebar-brand img {
    width: 25px;
    height: 25px;
  }
  .new-chat {
    border: 0;
    background: transparent;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border-radius: 10px;
    font-size: 14px;
    min-height: 44px;
    flex-shrink: 0;
  }
  .new-chat:hover {
    background: var(--hover);
  }
  .sidebar-search {
    display: grid;
    flex-shrink: 0;
    grid-template-rows: 1fr;
  }
  .sidebar-search-content {
    min-height: 0;
    overflow: hidden;
  }
  .sidebar-search-enter-active,
  .sidebar-search-leave-active {
    transition:
      grid-template-rows 0.24s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.18s ease;
  }
  .sidebar-search-leave-active {
    transition-duration: 0.18s, 0.14s;
  }
  .sidebar-search-enter-from,
  .sidebar-search-leave-to {
    grid-template-rows: 0fr;
    opacity: 0;
  }
  .search-box {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--muted);
    margin: 17px 8px;
  }
  .search-box input {
    background: none;
    border: 0;
    outline: 0;
    width: 100%;
    min-width: 0;
    font-size: 12px;
    color: var(--chat-text);
  }
  .history-heading {
    font-size: 12px;
    color: var(--muted);
    padding: 10px 12px 10px;
  }
  .history-item-enter-active {
    transition:
      opacity 0.25s ease,
      transform 0.25s ease;
  }
  .history-item-enter-from {
    opacity: 0;
    transform: translateY(5px);
  }
  .history-skeleton {
    display: grid;
    gap: 25px;
    padding: 15px 12px;
  }
  .history-skeleton span {
    display: block;
    width: 82%;
    height: 14px;
    border-radius: 999px;
    background: linear-gradient(100deg, var(--hover) 25%, var(--line) 50%, var(--hover) 75%);
    background-size: 250% 100%;
    animation: conversation-shimmer 1.6s ease-in-out infinite;
  }
  .history-skeleton span:nth-child(2) {
    width: 66%;
  }
  .history-skeleton span:nth-child(3) {
    width: 86%;
  }
  .history-list {
    --history-scrollbar-thumb: transparent;
    flex: 1;
    min-height: 0;
    margin-right: -10px;
    padding-right: 6px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: var(--history-scrollbar-thumb) transparent;
    transition: --history-scrollbar-thumb 0.25s ease;
  }
  .history-search-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 100%;
    color: var(--sidebar-text);
    font-size: 20px;
    font-weight: 400;
  }
  .history-search-empty svg {
    flex: 0 0 auto;
  }
  .history-list.scrollbar-visible {
    --history-scrollbar-thumb: var(--input-scrollbar);
  }
  @supports selector(::-webkit-scrollbar) {
    .history-list,
    .history-list.scrollbar-visible {
      scrollbar-width: auto;
      scrollbar-color: auto;
    }
  }
  .history-list::-webkit-scrollbar {
    width: 4px;
  }
  .history-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .history-list::-webkit-scrollbar-thumb {
    background: var(--history-scrollbar-thumb);
    border-radius: 999px;
  }
  .history-list::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
  .history-row {
    display: flex;
    align-items: center;
    border-radius: 8px;
    margin: 2px 0;
  }
  .history-row:hover,
  .history-row.active,
  .history-row.menu-open {
    background: var(--hover);
  }
  .history-title {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
    border: 0;
    background: none;
    text-align: left;
    padding: 11px 12px;
    font-size: 13px;
  }
  .history-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .history-title svg {
    flex-shrink: 0;
  }
  .delete-button {
    width: 30px;
    opacity: 0;
    color: var(--muted);
  }
  .history-row:hover .delete-button,
  .history-row:focus-within .delete-button,
  .history-row.menu-open .delete-button {
    opacity: 1;
  }
  .history-empty-state {
    display: grid;
    align-content: center;
    justify-items: center;
    min-height: 100%;
    padding: 20px 24px;
    text-align: center;
  }
  .history-empty-icon {
    display: grid;
    place-items: center;
    width: 54px;
    height: 54px;
    margin-bottom: 14px;
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
    border-radius: 18px;
    background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--accent) 5%, var(--sidebar-bg)),
      color-mix(in srgb, var(--accent) 15%, var(--sidebar-bg))
    );
    color: var(--accent);
  }
  .history-empty-title {
    margin: 0;
    color: var(--chat-text);
    font-size: 14px;
    font-weight: 600;
  }
  .history-empty-description {
    max-width: 17em;
    margin: 5px 0 0;
    color: color-mix(in srgb, var(--muted) 75%, var(--chat-text));
    font-size: 12px;
    line-height: 1.65;
    text-wrap: balance;
  }
  .empty-history,
  .list-error {
    font-size: 12px;
    color: var(--muted);
    padding: 12px 9px;
    white-space: normal;
    line-height: 1.8;
  }
  .list-error button,
  .load-more {
    display: block;
    background: none;
    border: 0;
    font-size: 12px;
    text-decoration: underline;
    padding: 8px;
  }
  .chat-sidebar .search-box,
  .chat-sidebar .search-box input,
  .chat-sidebar .search-box input::placeholder,
  .chat-sidebar .history-heading,
  .chat-sidebar .delete-button,
  .chat-sidebar .empty-history,
  .chat-sidebar .list-error {
    color: var(--sidebar-text);
  }
  .chat-sidebar .new-chat,
  .chat-sidebar .history-list,
  .chat-sidebar .history-list .empty-history,
  .chat-sidebar .history-list .list-error {
    color: var(--sidebar-content-text);
  }
  .chat-sidebar .history-list .conversation-menu-trigger {
    color: var(--sidebar-text);
  }
  .chat-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .chat-header {
    height: 64px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 26px;
    gap: 12px;
  }
  .chat-header > div {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .chat-title {
    font-size: 15px;
    font-weight: 550;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .export-button {
    display: flex;
    align-items: center;
    gap: 7px;
    border: 0;
    background: none;
    padding: 10px;
    border-radius: 8px;
    color: var(--muted);
    font-size: 12px;
    flex-shrink: 0;
  }
  .export-button:hover {
    background: var(--hover);
  }
  .chat-body {
    isolation: isolate;
    transition: padding-bottom 0.38s ease;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .chat-body.welcome {
    justify-content: center;
    padding-bottom: 8vh;
  }
  .welcome-title {
    text-align: center;
    font-size: clamp(24px, 2.4vw, 32px);
    font-weight: 500;
    letter-spacing: -0.7px;
    margin: 0 20px 36px;
    max-height: 60px;
    opacity: 1;
    transition:
      max-height 0.38s,
      opacity 0.2s,
      margin 0.38s;
  }
  .expanded .welcome-title {
    max-height: 0;
    opacity: 0;
    margin-bottom: 0;
  }
  .message-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    overflow-anchor: none;
  }
  .message-scroll {
    scrollbar-width: thin;
    scrollbar-color: var(--input-scrollbar) transparent;
  }
  @supports selector(::-webkit-scrollbar) {
    .message-scroll {
      scrollbar-width: auto;
      scrollbar-color: auto;
    }
  }
  .message-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .message-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .message-scroll::-webkit-scrollbar-thumb {
    background: var(--input-scrollbar);
    border-radius: 999px;
  }
  .message-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--input-scrollbar-hover);
  }
  .message-scroll::-webkit-scrollbar-button {
    display: none;
    width: 0;
    height: 0;
  }
  .message-scroll::-webkit-scrollbar-corner {
    background: transparent;
  }
  .message-list {
    width: min(800px, 100%);
    margin: auto;
    padding: 24px 28px 40px;
  }
  .message {
    margin-bottom: 34px;
    overflow-wrap: anywhere;
    font-size: 16px;
    line-height: 1.85;
  }
  .user {
    display: flex;
    justify-content: flex-end;
    padding-left: 12%;
  }
  .user-bubble {
    transform-origin: bottom right;
    white-space: pre-wrap;
    background: var(--user-bubble-bg);
    color: var(--user-bubble-text);
    padding: 10px 18px;
    border-radius: 22px;
    max-width: 100%;
  }
  .message.assistant {
    position: relative;
    padding-left: 42px;
  }
  .admin-card-enter-active {
    transition:
      opacity 0.28s ease,
      transform 0.28s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .admin-card-enter-from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  .admin-card-enter-to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  .assistant-avatar {
    position: absolute;
    top: 0;
    left: 0;
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
  .assistant-label {
    min-height: 32px;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .thinking-panel {
    width: min(100%, 560px);
    margin: 0 0 12px;
    color: var(--muted);
    overflow: hidden;
  }
  .thinking-panel > .thinking-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: fit-content;
    padding: 10px 0;
    text-align: left;
    color: inherit;
    cursor: pointer;
    background: transparent;
  }
  .thinking-panel > .thinking-toggle:hover,
  .thinking-panel > .thinking-toggle:focus-visible {
    background: transparent;
  }
  .thinking-chevron {
    transform: rotate(-90deg);
    transform-origin: center;
    transition: transform 0.22s ease;
  }
  .thinking-panel.open .thinking-chevron {
    transform: rotate(0deg);
  }
  .thinking-details {
    padding: 10px 12px;
    border-radius: 18px;
    background: var(--input-bg);
  }
  .thinking-steps {
    margin: 0;
    padding: 0 12px 0 16px;
    list-style: none;
  }
  .thinking-steps li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 13px;
  }
  .thinking-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
    background: var(--accent);
  }
  .thinking-steps li.running .thinking-dot {
    animation: thinking-pulse 1.1s ease-in-out infinite;
  }
  .thinking-step-enter-active {
    transition:
      opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1),
      transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .thinking-step-enter-from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
  .thinking-step-enter-to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .thinking-collapse-enter-active,
  .thinking-collapse-leave-active {
    overflow: hidden;
    transition:
      max-height 0.24s ease,
      opacity 0.18s ease,
      transform 0.24s ease;
  }
  .thinking-collapse-enter-from,
  .thinking-collapse-leave-to {
    max-height: 0;
    opacity: 0;
    transform: translateY(-4px);
  }
  .thinking-collapse-enter-to,
  .thinking-collapse-leave-from {
    max-height: 180px;
    opacity: 1;
    transform: translateY(0);
  }
  @keyframes thinking-pulse {
    50% {
      opacity: 0.35;
      transform: scale(0.72);
    }
  }
  .reply-actions {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    margin: 8px 0 0 -5px;
  }
  .reply-feedback {
    position: relative;
  }
  .reply-feedback summary {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    color: var(--muted);
    list-style: none;
    cursor: pointer;
  }
  .feedback-icon {
    position: relative;
    display: block;
    width: 24px;
    height: 22px;
  }
  .feedback-icon svg {
    position: absolute;
  }
  .feedback-icon svg:first-child {
    top: 1px;
    left: 1px;
  }
  .feedback-icon svg:last-child {
    right: 0;
    bottom: 0;
    clip-path: polygon(70% 0, 100% 0, 100% 100%, 0 100%, 0 48%, 70% 48%);
  }
  .reply-feedback summary::-webkit-details-marker {
    display: none;
  }
  .reply-feedback[open] summary {
    background: var(--hover);
  }
  .reply-feedback summary.is-rated {
    color: var(--resource-match-text, var(--accent));
  }
  .feedback-options {
    margin-top: 6px;
    width: 146px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--sidebar-bg);
    box-shadow: 0 6px 20px rgb(0 0 0 / 12%);
  }
  .feedback-options button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px;
    border-radius: 8px;
    font-size: 14px;
  }
  .feedback-options button:disabled {
    cursor: wait;
  }
  .feedback-options button:hover,
  .feedback-options button[aria-pressed='true'] {
    background: var(--hover);
  }
  .rating-check {
    margin-left: auto;
  }
  .read-aloud-button {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    color: var(--muted);
  }
  .read-aloud-button.is-speaking {
    color: var(--resource-match-text, var(--accent));
  }
  .copy-button {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    color: #98a2b3;
  }
  :global(.dark .copy-button) {
    color: #969ca9;
  }
  .failed {
    font-size: 12px;
    color: #c56d65;
  }
  .conversation-skeleton {
    display: grid;
    gap: 8px;
    width: min(48%, 340px);
  }
  .conversation-skeleton-line {
    height: 12px;
    border-radius: 999px;
    background: linear-gradient(100deg, var(--hover) 25%, var(--line) 50%, var(--hover) 75%);
    background-size: 250% 100%;
    animation: conversation-shimmer 1.6s ease-in-out infinite;
  }
  .conversation-skeleton-line:last-child {
    width: 85%;
  }
  .scroll-bottom-button {
    position: absolute;
    top: -52px;
    left: calc(50% - 17px);
    z-index: 5;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    border-radius: 50%;
    background: var(--chat-bg);
    color: var(--chat-text);
    box-shadow: 0 2px 6px #00000012;
  }
  .scroll-bottom-button:hover {
    background: var(--input-bg);
  }
  .scroll-bottom-enter-active,
  .scroll-bottom-leave-active {
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }
  .scroll-bottom-enter-from,
  .scroll-bottom-leave-to {
    opacity: 0;
    transform: translateY(5px) scale(0.92);
  }
  .composer-zone {
    position: relative;
    width: min(800px, 100%);
    padding: 0 24px 18px;
    margin: 0 auto;
    flex-shrink: 0;
  }
  .assistant-composer {
    --composer-background: var(--input-bg);
    --composer-border: var(--line);
    --composer-accent: var(--accent);
    --composer-text: var(--chat-text);
    --composer-surface: var(--chat-bg);
    --composer-muted: var(--muted);
    --composer-hover: var(--hover);
    --composer-scrollbar: var(--input-scrollbar);
  }
  .chat-body.expanded {
    padding-bottom: 0;
  }
  .error-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border: 1px solid #c5736a55;
    border-radius: 12px;
    font-size: 12px;
    color: #be665f;
    margin-bottom: 12px;
  }
  .error-banner span {
    flex: 1;
  }
  .sidebar-backdrop {
    display: none;
  }
  .conversation-menu {
    position: fixed;
    z-index: 60;
    width: 176px;
    padding: 7px;
    border: 1px solid var(--line);
    border-radius: 17px;
    background: var(--chat-bg);
    box-shadow:
      0 6px 24px #00000012,
      0 2px 5px #00000006;
    transform-origin: top left;
  }
  .menu-delete {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    min-height: 42px;
    padding: 10px 13px;
    border: 0;
    border-radius: 11px;
    background: transparent;
    color: #f04444;
    font-size: 14px;
    text-align: left;
  }
  .menu-delete:hover,
  .menu-delete:focus-visible {
    background: var(--input-bg);
  }
  .conversation-menu-enter-active {
    transition:
      opacity 0.18s ease,
      transform 0.2s cubic-bezier(0.22, 0.7, 0.25, 1);
  }
  .conversation-menu-leave-active {
    transition:
      opacity 0.12s ease,
      transform 0.12s ease;
  }
  .conversation-menu-enter-from,
  .conversation-menu-leave-to {
    opacity: 0;
    transform: translateY(-5px) scale(0.95);
  }
  .delete-dialog[open] {
    animation: dialog-enter 0.2s cubic-bezier(0.22, 0.7, 0.25, 1);
  }
  .delete-dialog[open]::backdrop {
    animation: backdrop-enter 0.2s ease;
  }
  @keyframes dialog-enter {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 8px)) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
  @keyframes backdrop-enter {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .delete-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    margin: 0;
    transform: translate(-50%, -50%);
    color: var(--chat-text);
    background: var(--chat-bg);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 26px;
    width: min(400px, calc(100% - 32px));
  }
  .delete-dialog::backdrop {
    background: #0007;
  }
  .delete-dialog h2 {
    font-size: 19px;
    margin-bottom: 12px;
  }
  .delete-dialog p {
    font-size: 13px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .delete-dialog > div {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 24px;
  }
  .delete-dialog button {
    padding: 9px 18px;
    border: 1px solid var(--line);
    border-radius: 9px;
    background: var(--input-bg);
    font-size: 13px;
  }
  .delete-dialog .danger {
    background: #bb514c;
    color: white;
    border-color: transparent;
  }
  .markdown {
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
      'Microsoft YaHei', sans-serif;
    font-size: 16px;
    font-weight: 400;
    line-height: 1.85;
    letter-spacing: 0;
  }
  .markdown :deep(p) {
    margin: 0 0 12px;
  }
  .markdown :deep(.resource-match) {
    background: transparent;
    color: var(--resource-match-text);
    font-weight: 600;
  }
  .markdown :deep(strong) {
    font-weight: 600;
  }
  .markdown :deep(pre) {
    overflow: auto;
    background: var(--sidebar-bg);
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 12px;
    margin: 16px 0;
    font-size: 16px;
  }
  .markdown :deep(code) {
    font-family: ui-monospace, monospace;
  }
  .markdown :deep(ul),
  .markdown :deep(ol) {
    padding-left: 24px;
    margin: 12px 0;
    list-style: revert;
  }
  .markdown :deep(h1),
  .markdown :deep(h2),
  .markdown :deep(h3),
  .markdown :deep(h4),
  .markdown :deep(h5),
  .markdown :deep(h6) {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.5;
    margin: 12px 0;
    text-wrap: pretty;
  }
  .markdown :deep(> :first-child) {
    margin-top: 0;
  }
  .markdown :deep(> :last-child) {
    margin-bottom: 0;
  }
  /* 分节使用浅色细线，与正文保持充足留白。 */
  .markdown :deep(hr) {
    height: 0;
    margin: 16px 0 0;
    padding: 8px 0 0;
    border: 0;
    border-top: 1px solid var(--line);
  }
  .markdown :deep(.markdown-table) {
    max-width: 100%;
    overflow-x: auto;
    margin: 20px 0 24px;
    scrollbar-width: thin;
    scrollbar-color: var(--input-scrollbar) transparent;
  }
  .markdown :deep(table) {
    width: 100%;
    border: 0;
    border-collapse: collapse;
    font-size: 14px;
    line-height: 1.7;
  }
  .markdown :deep(td),
  .markdown :deep(th) {
    min-width: 100px;
    padding: 12px 24px 12px 0;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: transparent;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  .markdown :deep(th) {
    font-weight: 600;
    text-align: left;
  }
  .markdown :deep(th:last-child),
  .markdown :deep(td:last-child) {
    padding-right: 0;
  }
  .markdown :deep(tbody tr:last-child td) {
    border-bottom: 0;
  }
  .markdown :deep(blockquote) {
    position: relative;
    margin: 16px 0;
    border: 0;
    padding-left: 16px;
    color: inherit;
    background: transparent;
  }
  .markdown :deep(blockquote)::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    border-radius: 999px;
    background: var(--quote-line);
  }
  .markdown :deep(blockquote > :last-child) {
    margin-bottom: 0;
  }
  .markdown :deep(a) {
    color: var(--accent);
    text-decoration: underline;
  }
  .markdown :deep(img) {
    max-width: 100%;
  }
  @keyframes conversation-shimmer {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: 0 0;
    }
  }

  @media (max-width: 800px) {
    .chat-sidebar {
      color: var(--sidebar-text);
      position: absolute;
      inset: 0 auto 0 0;
      z-index: 22;
    }
    .chat-sidebar.open {
      width: 280px;
    }
    .chat-main {
      margin-left: 56px;
    }
    .sidebar-backdrop {
      display: block;
      position: absolute;
      inset: 0 0 0 56px;
      background: #0006;
      border: 0;
      z-index: 21;
    }
    .chat-header {
      height: 56px;
      padding: 0 16px;
    }
    .composer-zone {
      padding: 0 14px 12px;
    }
    .message-list {
      padding: 20px;
    }

    .delete-button {
      opacity: 1;
    }
    .welcome-title {
      font-size: 26px;
    }
    .chat-body.welcome {
      padding-bottom: 12vh;
    }
    .chat-body.expanded {
      padding-bottom: 0;
    }
    .export-button span {
      display: none;
    }
    .input-hint {
      font-size: 10px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
  }

  /* Thinking controls stay left-aligned and transparent in every state. */
  .thinking-panel > .thinking-toggle,
  .thinking-panel > .thinking-toggle:hover,
  .thinking-panel > .thinking-toggle:focus-visible,
  .thinking-panel > .thinking-toggle.active {
    display: flex;
    justify-content: flex-start;
    width: fit-content;
    height: auto;
    min-height: 38px;
    padding: 10px 0;
    border: 0;
    border-radius: 0;
    background: transparent !important;
    color: var(--muted);
    text-align: left;
    transform: none;
    transition: color 0.2s ease;
  }
  .thinking-panel > .thinking-details {
    background: transparent;
  }
</style>
