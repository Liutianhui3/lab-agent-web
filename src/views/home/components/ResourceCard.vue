<script setup>
  import { computed, ref } from 'vue'
  import { Building2, Clock3, ImageOff, MapPin, Microscope, UsersRound } from 'lucide-vue-next'
  import { avatarUrl } from '@/utils/avatar'

  const props = defineProps({
    item: { type: Object, required: true },
    equipment: Boolean,
    labName: String,
    canReserve: Boolean
  })
  const emit = defineEmits(['reserve'])
  const failedImage = ref('')
  const image = computed(() => avatarUrl(props.item.img))
  const available = computed(() => Number(props.item.status) === 1)
  const status = computed(() => {
    if (props.equipment) return available.value ? '运行正常' : '维修检修'
    return available.value ? '开放中' : '已关闭'
  })
</script>

<template>
  <li class="resource-card liquid-card" :class="{ equipment }">
    <div class="cover">
      <img
        v-if="image && image !== failedImage"
        :src="image"
        :alt="item.name + '封面'"
        loading="lazy"
        @error="failedImage = image"
      />
      <div v-else class="cover-placeholder">
        <component :is="equipment ? Microscope : ImageOff" :size="32" aria-hidden="true" />
        {{ equipment ? '暂无设备图片' : '暂无封面' }}
      </div>
      <span class="code">{{ equipment ? item.code : item.lab_code }}</span>
      <span class="badge" :class="{ unavailable: !available }">{{ status }}</span>
      <span v-if="!equipment" class="hours">
        <Clock3 :size="14" />
        {{
          item.open_time && item.close_time
            ? item.open_time + ' – ' + item.close_time
            : '开放时间未设置'
        }}
      </span>
    </div>
    <div class="body">
      <h3>{{ item.name }}</h3>
      <p v-if="equipment && item.sepc" class="specification">{{ item.sepc }}</p>
      <div class="meta">
        <span v-if="equipment">
          <Building2 :size="16" />
          {{ labName || (item.lab_id ? '实验室 ' + item.lab_id : '实验室未设置') }}
        </span>
        <template v-else>
          <span>
            <MapPin :size="16" />
            {{ item.location || '位置未设置' }}
          </span>
          <span>
            <UsersRound :size="16" />
            容量 {{ item.capacity ?? '—' }} 人
          </span>
        </template>
      </div>
      <p class="description">
        {{ item.description || (equipment ? '暂无设备说明' : '暂无实验室描述') }}
      </p>
      <footer v-if="equipment || (canReserve && available)">
        <span v-if="equipment">
          数量
          <strong>{{ item.quantity ?? '—' }}</strong>
        </span>
        <button v-if="canReserve && available" type="button" @click="emit('reserve')">预约</button>
      </footer>
    </div>
  </li>
</template>

<style scoped>
  .resource-card {
    --glass-radius: 18px;
    min-width: 0;
    z-index: 0;
    border: 1px solid var(--border);
    transition:
      transform 0.3s cubic-bezier(0.2, 0.7, 0.3, 1),
      box-shadow 0.3s,
      border-color 0.3s;
  }
  .resource-card.equipment {
    --glass-radius: 14px;
  }
  .resource-card:is(:hover, :focus-within) {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px #24164518;
    border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
    z-index: 1;
  }
  .cover {
    position: relative;
    height: 205px;
    overflow: hidden;
    background: var(--soft);
    border-radius: calc(var(--glass-radius) - 1px) calc(var(--glass-radius) - 1px) 0 0;
  }
  .equipment .cover {
    height: 190px;
  }
  .resource-card:not(.equipment) .cover::after {
    content: '';
    position: absolute;
    inset: 50% 0 0;
    background: linear-gradient(transparent, #0006);
    pointer-events: none;
  }
  .cover img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.65s cubic-bezier(0.2, 0.7, 0.3, 1);
  }
  .resource-card:hover img {
    transform: scale(1.045);
  }
  .cover-placeholder {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 9px;
    color: var(--muted);
    font-size: 12px;
  }
  .code,
  .badge,
  .hours {
    position: absolute;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    border-radius: 7px;
    padding: 5px 9px;
    font-size: 11px;
  }
  .code {
    top: 12px;
    left: 12px;
    max-width: calc(100% - 94px);
    overflow-wrap: anywhere;
    background: #fffffff0;
    color: #34323b;
    font-weight: 600;
  }
  .badge {
    top: 12px;
    right: 12px;
    background: #eaf7ed;
    color: #216b3b;
    white-space: nowrap;
  }
  .badge::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }
  .badge.unavailable {
    color: #60616c;
    background: #eeeef2;
  }
  .equipment .badge.unavailable {
    color: #9c5e00;
    background: #fff1dc;
  }
  .hours {
    bottom: 12px;
    left: 12px;
    background: #111a;
    color: #fff;
  }
  .body {
    padding: 20px;
  }
  .equipment .body {
    padding: 17px;
  }
  h3 {
    margin: 0 0 10px;
    font-size: 17px;
    font-weight: 650;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .specification {
    margin: -6px 0 8px;
    color: var(--muted);
    font-size: 11px;
    overflow-wrap: anywhere;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 14px;
    color: var(--muted);
    font-size: 12px;
  }
  .meta span {
    display: flex;
    gap: 5px;
    align-items: center;
    overflow-wrap: anywhere;
  }
  .meta svg {
    flex: none;
  }
  .description {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 48px;
    margin: 14px 0 0;
    color: var(--muted);
    font-size: 13px;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    color: var(--muted);
    font-size: 12px;
  }
  footer button {
    margin-left: auto;
    padding: 6px 12px;
    border: 0;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent);
  }
  footer button:hover {
    background: color-mix(in srgb, var(--accent) 20%, transparent);
  }
  @media (max-width: 620px) {
    .body,
    .equipment .body {
      padding: 12px;
    }
    .cover,
    .equipment .cover {
      height: 150px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .resource-card,
    .cover img {
      transition: none;
    }
    .resource-card:is(:hover, :focus-within),
    .resource-card:hover img {
      transform: none;
    }
  }
</style>
