<template>
  <div class="app-layout" :class="{ 'panel-open': chatStore.isPanelOpen }">
    <div class="main-content">
      <RouterView />
    </div>
    <ChatPanel />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import ChatPanel from './components/ChatPanel.vue'
import { useChatStore } from './stores/chat'

const chatStore = useChatStore()
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: #f9fafb;
  display: flex;
}

.main-content {
  flex: 1;
  min-width: 0;
  transition: margin-right 0.3s ease;
}

/* デスクトップでパネルが開いているとき */
@media (min-width: 769px) {
  .panel-open .main-content {
    margin-right: 400px;
  }
}
</style>
