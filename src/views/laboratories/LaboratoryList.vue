<script setup>
  import { computed } from 'vue'
  import { useRoute } from 'vue-router'
  import Laboratories from './index.vue'
  import Equipment from '@/views/equipment/index.vue'

  const route = useRoute()
  const detail = computed(() => route.query.status === 'detail')
  const labCode = computed(() =>
    typeof route.query.lab_code === 'string' ? route.query.lab_code : ''
  )
</script>

<template>
  <Equipment v-if="detail" :key="labCode" read-only :lab-code="labCode" />
  <Laboratories v-else read-only />
</template>
