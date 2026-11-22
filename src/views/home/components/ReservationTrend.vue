<script setup>
  import { computed, ref } from 'vue'

  const props = defineProps({ days: { type: Array, required: true } })
  const selected = ref(null)
  const ceiling = computed(() =>
    Math.max(4, Math.ceil(Math.max(...props.days.map(day => day.total)) / 4) * 4)
  )
  const x = index => 12 + (index * 576) / Math.max(1, props.days.length - 1)
  const y = value => 174 - (value / ceiling.value) * 158
  const series = [
    { key: 'total', label: '预约申请' },
    { key: 'approved', label: '已通过' }
  ]
  const sum = key => props.days.reduce((count, day) => count + day[key], 0)
  const active = computed(() => props.days[selected.value])
  function line(key) {
    return props.days
      .map((day, i) => {
        const next = y(day[key])
        if (!i) return `M ${x(i)} ${next}`
        const middle = (x(i - 1) + x(i)) / 2
        return `C ${middle} ${y(props.days[i - 1][key])}, ${middle} ${next}, ${x(i)} ${next}`
      })
      .join(' ')
  }
  const label = day => day.date.slice(5).replace('-', '/')
</script>

<template>
  <div class="trend">
    <div class="legend">
      <span v-for="item in series" :key="item.key" :class="item.key">
        {{ item.label }}
        <strong>{{ sum(item.key) }} 笔</strong>
      </span>
    </div>
    <div class="plot" @pointerleave="selected = null">
      <div class="scale-labels" aria-hidden="true">
        <span
          v-for="tick in 5"
          :key="tick"
          :style="{ top: (y(((tick - 1) * ceiling) / 4) / 180) * 100 + '%' }"
        >
          {{ ((tick - 1) * ceiling) / 4 }}
        </span>
      </div>
      <svg viewBox="0 0 600 180" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient
            v-for="item in series"
            :id="'trend-fill-' + item.key"
            :key="item.key"
            x2="0"
            y2="1"
          >
            <stop offset="0" :class="item.key" stop-color="currentColor" stop-opacity=".22" />
            <stop offset="1" :class="item.key" stop-color="currentColor" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line
          v-for="tick in 5"
          :key="tick"
          x1="12"
          x2="588"
          :y1="y(((tick - 1) * ceiling) / 4)"
          :y2="y(((tick - 1) * ceiling) / 4)"
          stroke="var(--border)"
          stroke-dasharray="4 5"
        />
        <g v-for="item in series" :key="item.key" class="trend-series" :class="item.key">
          <path
            :d="line(item.key) + ' L 588 174 H 12 Z'"
            :fill="'url(#trend-fill-' + item.key + ')'"
          />
          <path
            :d="line(item.key)"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            vector-effect="non-scaling-stroke"
          />
          <ellipse
            v-for="(day, i) in days"
            :key="day.date"
            :cx="x(i)"
            :cy="y(day[item.key])"
            class="trend-point"
            :class="{ 'is-selected': selected === i }"
            fill="var(--pane-color)"
            stroke="currentColor"
            vector-effect="non-scaling-stroke"
          />
        </g>
        <line
          v-if="active"
          :x1="x(selected)"
          :x2="x(selected)"
          y1="12"
          y2="174"
          stroke="var(--accent)"
          stroke-dasharray="3 4"
        />
      </svg>
      <div class="targets">
        <button
          v-for="(day, i) in days"
          :key="day.date"
          type="button"
          :aria-label="day.date + '，申请 ' + day.total + ' 笔，通过 ' + day.approved + ' 笔'"
          @pointerenter="selected = i"
          @focus="selected = i"
          @blur="selected = null"
          @click="selected = i"
        ></button>
      </div>
      <Transition name="readout">
        <div v-if="active" class="readout" aria-hidden="true">
          <strong>{{ label(active) }}</strong>
          申请 {{ active.total }} · 通过 {{ active.approved }}
        </div>
      </Transition>
    </div>
    <div class="dates" aria-hidden="true">
      <template v-for="(day, i) in days" :key="day.date">
        <span
          v-if="days.length <= 7 || i % 5 === 0 || i === days.length - 1"
          :style="{ left: x(i) / 6 + '%' }"
        >
          {{ label(day) }}
        </span>
      </template>
    </div>
  </div>
</template>

<style scoped>
  .trend {
    margin-top: 18px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    font-size: 12px;
  }
  .legend span::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 5px;
    border-radius: 50%;
    background: currentColor;
  }
  .total {
    color: var(--accent);
  }
  .approved {
    color: var(--teal);
  }
  .plot {
    position: relative;
    margin-top: 13px;
    margin-left: 25px;
  }
  .scale-labels {
    position: absolute;
    inset: 0 auto 0 -25px;
    width: 24px;
    color: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .scale-labels span {
    position: absolute;
    right: 0;
    transform: translateY(-50%);
  }
  svg {
    display: block;
    width: 100%;
    height: clamp(160px, 18vw, 250px);
  }
  .trend-point {
    rx: 3.5px;
    ry: 3.5px;
    stroke-width: 1.5px;
  }
  .trend-point.is-selected {
    rx: 5.5px;
    ry: 5.5px;
    stroke-width: 2px;
  }
  @media (prefers-reduced-motion: no-preference) {
    .trend-series {
      transform-box: view-box;
      animation: reveal-trend 1.4s cubic-bezier(0.3, 0.5, 0.5, 1) both;
    }
    .trend-series.approved {
      animation-delay: 65ms;
    }
    .trend-point {
      transition: rx 160ms ease, ry 160ms ease, stroke-width 160ms ease;
    }
    .readout-enter-active,
    .readout-leave-active {
      transition: opacity 140ms ease, translate 140ms ease;
    }
    .readout-enter-from,
    .readout-leave-to {
      opacity: 0;
      translate: 0 3px;
    }
  }
  @keyframes reveal-trend {
    from {
      clip-path: inset(0 100% 0 0);
    }
    to {
      clip-path: inset(0);
    }
  }
  .targets {
    position: absolute;
    inset: 0;
    display: flex;
  }
  .targets button {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 0;
    padding: 0;
  }
  .targets button:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }
  .readout {
    position: absolute;
    top: 0;
    right: 0;
    pointer-events: none;
    background: var(--pane-color);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 5px 8px;
    font-size: 12px;
  }
  .dates {
    position: relative;
    height: 24px;
    margin: 4px 0 0 25px;
    color: var(--muted);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .dates span {
    position: absolute;
    transform: translateX(-50%);
    white-space: nowrap;
  }
</style>
