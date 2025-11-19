<template>
  <div class="app-layout three-column">
    <!-- 左サイドバー: ナビゲーション -->
    <aside class="sidebar-left">
      <div class="app-logo">
        <span class="logo-icon">Y</span>
        <span class="logo-text">Yamix</span>
      </div>
      <nav>
        <RouterLink to="/" class="nav-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>ホーム</span>
        </RouterLink>
        <RouterLink to="/posts/new" class="nav-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>投稿する</span>
        </RouterLink>
      </nav>
    </aside>

    <!-- 中央: メインコンテンツ -->
    <main class="main-content">
      <RouterView />
    </main>

    <!-- 右サイドバー: AIチャット -->
    <aside class="sidebar-right">
      <ChatPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import ChatPanel from './components/ChatPanel.vue'
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: #f5f5f5;
}

.three-column {
  display: grid;
  grid-template-columns: 240px 1fr 360px;
}

/* 左サイドバー */
.sidebar-left {
  position: sticky;
  top: 0;
  height: 100vh;
  background: white;
  border-right: 1px solid #e5e5e5;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  color: white;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  color: #4b5563;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  transition: background 0.2s, color 0.2s;
}

.nav-item:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.nav-item.router-link-active {
  background: #f3e8ff;
  color: #9333ea;
}

/* 中央コンテンツ */
.main-content {
  min-height: 100vh;
  border-right: 1px solid #e5e5e5;
}

/* 右サイドバー */
.sidebar-right {
  position: sticky;
  top: 0;
  height: 100vh;
  background: white;
  display: flex;
  flex-direction: column;
}

/* レスポンシブ */
@media (max-width: 1024px) {
  .three-column {
    grid-template-columns: 72px 1fr 320px;
  }

  .sidebar-left {
    padding: 12px;
  }

  .logo-text {
    display: none;
  }

  .nav-item span {
    display: none;
  }

  .nav-item {
    justify-content: center;
    padding: 12px;
  }
}

@media (max-width: 768px) {
  .three-column {
    grid-template-columns: 1fr;
  }

  .sidebar-left {
    display: none;
  }

  .sidebar-right {
    display: none;
  }

  .main-content {
    border-right: none;
  }
}
</style>
