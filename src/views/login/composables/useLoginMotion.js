import { onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'

export function useLoginMotion(root) {
  let context
  onMounted(() => {
    context = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('[data-enter]', {
        y: 18,
        opacity: 0,
        duration: 0.85,
        stagger: 0.09,
        ease: 'power3.out'
      })
      gsap.from('[data-image]', { scale: 1.045, duration: 1.8, ease: 'power2.out' })
    }, root.value)
  })
  onBeforeUnmount(() => context?.revert())
}
