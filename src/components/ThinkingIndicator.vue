<script setup>
  defineProps({
    label: { type: String, default: '正在思考…' }
  })
</script>

<template>
  <div class="thinking-indicator" role="status" aria-live="polite" aria-atomic="true">
    <span class="thinking-indicator__beacon" aria-hidden="true">
      <span class="thinking-indicator__dot" />
    </span>
    <span class="thinking-indicator__text">{{ label }}</span>
  </div>
</template>

<style scoped>
  /* Override these on the component or any ancestor to match another theme. */
  .thinking-indicator {
    --_thinking-color: var(--thinking-color, var(--accent, #7b74f3));
    --_thinking-text-color: var(--thinking-text-color, var(--muted, #74717f));
    --_thinking-highlight: var(
      --thinking-highlight,
      color-mix(in srgb, var(--_thinking-color) 22%, white)
    );
    --_thinking-duration: var(--thinking-duration, 2.4s);
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 24px;
    color: var(--_thinking-text-color);
    font-size: 13px;
    line-height: 1.8;
  }

  .thinking-indicator__beacon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 12px;
    width: 12px;
    height: 12px;
    color: var(--_thinking-color);
  }

  .thinking-indicator__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    animation: thinking-breathe var(--_thinking-duration) ease-in-out infinite;
  }

  .thinking-indicator__beacon::before,
  .thinking-indicator__beacon::after {
    content: '';
    position: absolute;
    inset: 2px;
    border: 1px solid currentColor;
    border-radius: 50%;
    background: color-mix(in srgb, currentColor 10%, transparent);
    opacity: 0;
    animation: thinking-ripple var(--_thinking-duration) cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }

  .thinking-indicator__beacon::after {
    animation-delay: calc(var(--_thinking-duration) / -2);
  }

  .thinking-indicator__text {
    color: var(--_thinking-text-color);
  }

  @supports (background-clip: text) or (-webkit-background-clip: text) {
    .thinking-indicator__text {
      background-image: linear-gradient(
        105deg,
        var(--_thinking-text-color) 38%,
        var(--_thinking-color) 45%,
        var(--_thinking-highlight) 50%,
        var(--_thinking-color) 55%,
        var(--_thinking-text-color) 62%
      );
      background-size: 220% 100%;
      background-repeat: no-repeat;
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      animation: thinking-shimmer var(--thinking-shimmer-duration, 2s) linear infinite;
    }
  }

  @keyframes thinking-breathe {
    0%,
    100% {
      transform: scale(0.86);
      opacity: 0.55;
    }
    50% {
      transform: scale(1.08);
      opacity: 1;
    }
  }

  @keyframes thinking-ripple {
    0% {
      transform: scale(0.75);
      opacity: 0;
    }
    15% {
      opacity: 0.3;
    }
    75%,
    100% {
      transform: scale(2.4);
      opacity: 0;
    }
  }

  @keyframes thinking-shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: 0% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .thinking-indicator__dot,
    .thinking-indicator__beacon::before,
    .thinking-indicator__beacon::after,
    .thinking-indicator__text {
      animation: none;
    }
    .thinking-indicator__dot {
      transform: none;
      opacity: 0.85;
    }
    .thinking-indicator__beacon::before,
    .thinking-indicator__beacon::after {
      display: none;
    }
    .thinking-indicator__text {
      background: none;
      color: var(--_thinking-text-color);
    }
  }

  @media (forced-colors: active) {
    .thinking-indicator__text {
      background: none;
      color: CanvasText;
    }
    .thinking-indicator__beacon {
      color: Highlight;
    }
  }
</style>
