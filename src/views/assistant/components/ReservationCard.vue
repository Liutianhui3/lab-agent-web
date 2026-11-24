<script setup>
  import { computed, ref } from 'vue'
  import { CalendarCheck, Check, ShieldCheck, X, Ban } from 'lucide-vue-next'
  import { confirmReservationApplication, confirmReservationApproval, confirmReservationCancellation } from '@/api/reservation'
  import { useUserInfo } from '@/composables/useUserInfo'

  const props = defineProps({ content: { type: String, required: true } })
  const { userInfo } = useUserInfo()
  const card = computed(() => {
    try {
      return JSON.parse(props.content)
    } catch {
      return null
    }
  })
  const approval = computed(() => card.value?.type === 'reservation_approval')
  const cancellation = computed(() => card.value?.type === 'reservation_cancellation')
  const data = computed(() => card.value?.data || {})
  const allowed = computed(() =>
    approval.value ? userInfo.value.role === 'admin' : userInfo.value.role === 'student'
  )
  const busy = ref(false)
  const result = ref('')
  const error = ref('')
  async function confirm(decision) {
    if (busy.value || result.value || !allowed.value || !card.value?.token) return
    busy.value = true
    error.value = ''
    try {
      if (approval.value) await confirmReservationApproval(card.value.token, decision)
      else if (cancellation.value) await confirmReservationCancellation(card.value.token)
      else await confirmReservationApplication(card.value.token)
      result.value = cancellation.value
        ? '预约已取消'
        : approval.value
        ? decision === 1
          ? '已同意预约'
          : '已拒绝预约'
        : '预约已提交，等待管理员审核'
    } catch (reason) {
      error.value =
        reason?.response?.data?.message || reason?.message || '提交失败，请重试或重新生成卡片'
    } finally {
      busy.value = false
    }
  }
</script>

<template>
  <section v-if="card" class="reservation-card" :aria-busy="busy">
    <header>
      <span class="title-icon"><CalendarCheck :size="19" aria-hidden="true" /></span>
      <h3>{{ cancellation ? '确认取消预约' : approval ? '预约审批' : '确认预约申请' }}</h3>
      <span class="confirmation-badge">
        <ShieldCheck :size="14" aria-hidden="true" />
        {{ cancellation ? '取消操作需确认' : approval ? '管理员确认后执行' : '确认后提交审核' }}
      </span>
    </header>
    <p class="description">
      {{ cancellation ? '请核对以下预约信息。确认后将取消这条待审核预约。' : approval ? '核对预约信息后，选择同意或拒绝。' : '核对预约信息，点击确认后提交审核。' }}
      如需调整，请在对话中重新提出需求。
    </p>
    <dl>
      <div v-if="approval">
        <dt>预约编号</dt>
        <dd>{{ data.id }}</dd>
      </div>
      <div v-if="cancellation">
        <dt>预约编号</dt>
        <dd>{{ data.reservation_id }}</dd>
      </div>
      <div v-if="approval">
        <dt>申请人</dt>
        <dd>{{ data.user_name || data.user?.name }}</dd>
      </div>
      <div>
        <dt>实验室</dt>
        <dd>{{ card.display?.lab_name || data.lab_name || data.lab?.name }}</dd>
      </div>
      <div v-if="card.display?.equipment_name || data.equipment_name">
        <dt>设备</dt>
        <dd>{{ card.display?.equipment_name || data.equipment_name }}</dd>
      </div>
      <div>
        <dt>预约日期</dt>
        <dd>{{ data.date }}</dd>
      </div>
      <div>
        <dt>时间（北京时间）</dt>
        <dd>{{ data.start_time }} — {{ data.end_time }}</dd>
      </div>
      <div v-if="data.remark">
        <dt>备注</dt>
        <dd>{{ data.remark }}</dd>
      </div>
      <div v-if="cancellation">
        <dt>当前状态</dt>
        <dd>{{ data.status === 0 ? '待审核' : '不可取消' }}</dd>
      </div>
    </dl>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="result" class="result" role="status">
      <Check :size="16" />
      {{ result }}
    </p>
    <div v-else-if="allowed" class="actions">
      <button v-if="approval" :disabled="busy" @click="confirm(2)">
        <X :size="16" />
        拒绝
      </button>
      <button v-if="cancellation" class="danger" :disabled="busy || !card.token" @click="confirm()">
        <Ban :size="16" />
        {{ busy ? '取消中…' : '确认取消预约' }}
      </button>
      <button v-if="!cancellation" class="primary" :disabled="busy || !card.token" @click="confirm(1)">
        <Check :size="16" />
        {{ busy ? '提交中…' : approval ? '同意预约' : '确认预约' }}
      </button>
    </div>
    <p v-else class="description">当前账号无权操作此卡片。</p>
  </section>
</template>

<style scoped>
  .reservation-card {
    --card-surface: #fff;
    --card-line: #e9e9ef;
    --card-soft: #f5f5f8;
    --card-text: #292a34;
    --card-muted: #747784;
    position: relative;
    width: min(100%, 680px);
    margin-top: 14px;
    padding: clamp(18px, 3vw, 25px);
    border: 2px solid var(--user-bubble-bg, #7b74f3);
    border-radius: 24px;
    background: var(--card-surface);
    color: var(--card-text);
    box-shadow:
      0 14px 30px #17132310,
      0 2px 4px #17132308;
  }
  header,
  .actions,
  .result,
  button {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  :global(.dark .reservation-card) {
    --reservation-error: #f48d94;
    --card-surface: #202023;
    --card-line: #35353c;
    --card-soft: #2b2b31;
    --card-text: #f0f0f4;
    --card-muted: #b0b0bd;
    box-shadow: 0 14px 30px #0003;
  }
  header {
    padding-bottom: 17px;
    border-bottom: 1px solid var(--card-line);
  }
  .title-icon {
    display: grid;
    place-items: center;
    width: 31px;
    height: 31px;
    border-radius: 9px;
    color: var(--accent, #7b74f3);
    background: color-mix(in srgb, var(--accent, #7b74f3) 9%, var(--card-surface));
  }
  .confirmation-badge {
    position: absolute;
    top: 0;
    right: 22px;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 13px;
    background: var(--user-bubble-bg, #7b74f3);
    color: #fff;
    border-radius: 999px;
    font-size: 11px;
    white-space: nowrap;
    box-shadow: 0 3px 8px #29204b18;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .description {
    font-size: 13px;
    line-height: 1.7;
    margin: 18px 0;
    color: var(--card-muted);
  }
  dl {
    margin: 0;
    padding: 12px;
    border: 1px solid var(--card-line);
    border-radius: 14px;
    background: var(--card-soft);
  }
  dl > div {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 16px;
    padding: 9px 0;
  }
  dt {
    font-size: 13px;
    color: var(--card-muted);
  }
  dd {
    margin: 0;
    font-size: 14px;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .actions {
    justify-content: flex-end;
    margin-top: 20px;
    padding-top: 17px;
    border-top: 1px solid var(--card-line);
  }
  button {
    padding: 9px 16px;
    border: 1px solid var(--card-line);
    border-radius: 11px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    transition:
      background-color 0.18s ease,
      transform 0.18s ease;
  }
  button:active:not(:disabled) {
    transform: scale(0.97);
  }
  button.primary {
    background: var(--accent, #6258d6);
    color: #fff;
    border-color: transparent;
  }
  button.danger {
    background: #b53a3a;
    color: #fff;
    border-color: transparent;
  }
  button:hover:not(:disabled) {
    filter: brightness(0.92);
  }
  button:focus-visible {
    outline: 2px solid var(--accent, #6258d6);
    outline-offset: 3px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: wait;
  }
  .error {
    color: var(--reservation-error, #b53a3a);
    font-size: 13px;
  }
  .result {
    font-size: 14px;
    margin: 20px 0 0;
  }
  @media (max-width: 480px) {
    .reservation-card {
      padding: 16px;
    }
    dl > div {
      grid-template-columns: 1fr;
      gap: 4px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
