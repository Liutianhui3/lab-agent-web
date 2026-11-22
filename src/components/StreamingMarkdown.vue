<script>
  import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useSmoothStream } from 'smooth-stream-text/vue'
  import { createReveal } from 'smooth-stream-text/dom'
  import 'smooth-stream-text/styles.css'

  // Each leaf owns its DOM; Vue never replaces the already revealed text on a tick.
  const TextReveal = defineComponent({
    props: { text: String, initialText: String },
    setup(props) {
      const host = ref()
      let reveal
      onMounted(() => {
        reveal = createReveal(host.value, {
          initialText: props.initialText,
          durationMs: 260,
          staggerMs: 8,
          blurPx: 2,
          translatePx: 0,
          maxWaveLagMs: 100,
          maxAnimatedUnits: 48,
          injectStyles: false
        })
        reveal.update(props.text)
      })
      watch(
        () => props.text,
        text => reveal?.update(text),
        { flush: 'post' }
      )
      onBeforeUnmount(() => reveal?.destroy())
      return () => h('span', { ref: host })
    }
  })

  export default defineComponent({
    props: {
      content: { type: String, default: '' },
      pending: Boolean,
      renderMarkdown: { type: Function, required: true }
    },
    emits: ['progress', 'settled'],
    setup(props, { emit }) {
      const { text, phase } = useSmoothStream(() => props.content, {
        done: () => !props.pending,
        boundary: 'markdown',
        targetLatencyMs: 180,
        minCharsPerSecond: 30,
        maxCharsPerSecond: 1200,
        settleMs: 180
      })
      watch(text, () => emit('progress'), { flush: 'post' })
      watch(phase, value => {
        if (value === 'done') emit('settled')
      })
      const history = !props.pending
      let previousText = ''
      return () => {
        const template = document.createElement('template')
        template.innerHTML = props.renderMarkdown(text.value)
        const currentText = template.content.textContent || ''
        // Parser changes (e.g. closing bold/link delimiters) may reparent old text.
        // Seed that text as settled even if its leaf has to mount again.
        let prefix = 0,
          suffix = 0
        while (
          prefix < previousText.length &&
          prefix < currentText.length &&
          previousText[prefix] === currentText[prefix]
        )
          prefix++
        while (
          suffix < previousText.length - prefix &&
          suffix < currentText.length - prefix &&
          previousText[previousText.length - 1 - suffix] ===
            currentText[currentText.length - 1 - suffix]
        )
          suffix++
        let offset = 0
        function convert(node, key) {
          if (node.nodeType === Node.TEXT_NODE) {
            const value = node.textContent || ''
            const start = offset
            offset += value.length
            const seed =
              history || start >= currentText.length - suffix
                ? value
                : value.slice(0, Math.max(0, prefix - start))
            return h(TextReveal, { key, text: value, initialText: seed })
          }
          if (node.nodeType !== Node.ELEMENT_NODE) return null
          const attrs = Object.fromEntries(
            Array.from(node.attributes, attr => [attr.name, attr.value])
          )
          return h(
            node.localName,
            { ...attrs, key },
            Array.from(node.childNodes, (child, i) => convert(child, `${key}.${i}`))
          )
        }
        const children = Array.from(template.content.childNodes, (node, i) =>
          convert(node, String(i))
        )
        previousText = currentText
        return h('div', { class: 'markdown', 'data-phase': phase.value }, children)
      }
    }
  })
</script>
