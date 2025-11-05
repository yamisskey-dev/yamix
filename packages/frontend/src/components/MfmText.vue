<template>
  <span v-if="parsed" class="mfm">
    <MfmNode v-for="(node, i) in parsed" :key="i" :node="node" />
  </span>
  <span v-else>{{ text }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import * as mfm from 'mfm-js'
import MfmNode from './MfmNode.vue'

const props = defineProps<{
  text: string
}>()

const parsed = computed(() => {
  try {
    return mfm.parse(props.text)
  } catch (err) {
    console.error('MFM parse error:', err)
    return null
  }
})
</script>

<style scoped>
.mfm {
  word-wrap: break-word;
  white-space: pre-wrap;
}
</style>
