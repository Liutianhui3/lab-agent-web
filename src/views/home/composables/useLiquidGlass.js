import { onBeforeUnmount, onMounted, ref } from 'vue'

// Neutral red and green leave the center intact; offsets grow near the curved rim.
function createRefractionMap() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const map = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1
      const v = ((y + 0.5) / size) * 2 - 1
      const edgeX = Math.pow(Math.abs(u), 13)
      const edgeY = Math.pow(Math.abs(v), 10)
      const offset = (y * size + x) * 4
      map.data[offset] = 128 - Math.sign(u) * 117 * edgeX
      map.data[offset + 1] = 128 - Math.sign(v) * 117 * edgeY
      map.data[offset + 2] = 128
      map.data[offset + 3] = 255
    }
  }
  ctx.putImageData(map, 0, 0)
  return canvas.toDataURL()
}

export function useLiquidGlass() {
  const map = ref('')
  let pending
  let frame = 0

  onMounted(() => {
    map.value = createRefractionMap()
  })
  onBeforeUnmount(() => cancelAnimationFrame(frame))

  function paintPointer() {
    frame = 0
    if (!pending) return
    const { card, x, y } = pending
    pending = null
    const bounds = card.getBoundingClientRect()
    card.style.setProperty(
      '--light-x',
      Math.max(0, Math.min(100, ((x - bounds.left) / bounds.width) * 100)) + '%'
    )
    card.style.setProperty(
      '--light-y',
      Math.max(0, Math.min(100, ((y - bounds.top) / bounds.height) * 100)) + '%'
    )
  }

  function track(event) {
    const card = event.target.closest('.liquid-card')
    if (!card) return
    pending = { card, x: event.clientX, y: event.clientY }
    if (!frame) frame = requestAnimationFrame(paintPointer)
  }

  return { map, track }
}
