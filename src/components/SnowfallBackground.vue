<script setup>
  import { onBeforeUnmount, onMounted, ref } from 'vue'

  // Canvas snowfall adapted from myBlob/src/components/SnowfallBg.vue.
  // Match myBlob: radius 0.2–5px, alpha 0.5–1, speed 0.5 at 60fps.
  // https://inspira-ui.com/docs/cn/components/backgrounds/snowfall-bg
  const canvas = ref(null)
  let context, resizeObserver, themeObserver, motionPreference, frame
  let flakes = []
  let width = 0, height = 0, previousTime = 0
  let dark = false
  const random = (min, max) => min + Math.random() * (max - min)

  function resize() {
    const bounds = canvas.value.getBoundingClientRect()
    width = bounds.width
    height = bounds.height
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.value.width = Math.round(width * ratio)
    canvas.value.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    flakes = Array.from({ length: width < 600 ? 60 : 100 }, () => ({
      x: random(0, width), y: random(0, height), radius: random(.2, 5),
      speed: random(30, 45), drift: random(-15, 15), opacity: random(.5, 1)
    }))
    draw(0)
  }
  function draw(delta) {
    context.clearRect(0, 0, width, height)
    context.fillStyle = dark ? '#add8e6' : '#514def'
    for (const flake of flakes) {
      flake.y += flake.speed * delta
      flake.x += flake.drift * delta
      if (flake.y > height + flake.radius) { flake.y = -flake.radius; flake.x = random(0, width) }
      if (flake.x > width + flake.radius) flake.x = -flake.radius
      if (flake.x < -flake.radius) flake.x = width + flake.radius
      context.globalAlpha = flake.opacity
      context.beginPath()
      context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1
  }
  function animate(time) {
    draw(previousTime ? Math.min((time - previousTime) / 1000, .05) : 0)
    previousTime = time
    frame = requestAnimationFrame(animate)
  }
  function syncAnimation() {
    cancelAnimationFrame(frame)
    previousTime = 0
    draw(0)
    if (!document.hidden && !motionPreference.matches) frame = requestAnimationFrame(animate)
  }
  onMounted(() => {
    context = canvas.value.getContext('2d')
    if (!context) return
    dark = document.documentElement.classList.contains('dark')
    motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.value)
    themeObserver = new MutationObserver(() => {
      dark = document.documentElement.classList.contains('dark')
      draw(0)
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    motionPreference.addEventListener('change', syncAnimation)
    document.addEventListener('visibilitychange', syncAnimation)
    resize()
    syncAnimation()
  })
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame)
    resizeObserver?.disconnect()
    themeObserver?.disconnect()
    motionPreference?.removeEventListener('change', syncAnimation)
    document.removeEventListener('visibilitychange', syncAnimation)
  })
</script>

<template>
  <canvas ref="canvas" class="snowfall-background" aria-hidden="true" />
</template>

<style scoped>
  .snowfall-background { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; border-radius: inherit; }
</style>
