<template>
  <div class="app-layout three-column">
    <!-- 左サイドバー: ナビゲーション -->
    <aside class="sidebar-left">
      <!-- ロゴ -->
      <div class="app-logo">
        <RouterLink to="/" class="logo-icon">Y</RouterLink>
      </div>

      <!-- 下部セクション -->
      <div class="bottom-section">
        <!-- 投稿するボタン -->
        <RouterLink to="/posts/new" class="post-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>投稿する</span>
        </RouterLink>

        <!-- 認証ボタン -->
        <div class="auth-section">
          <RouterLink to="/login" class="auth-button auth-login">ログイン</RouterLink>
          <RouterLink to="/register" class="auth-button auth-register">会員登録</RouterLink>
        </div>
      </div>
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
  background: hsl(var(--background));
}

.three-column {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr var(--chat-panel-width);
}

/* 左サイドバー */
.sidebar-left {
  position: sticky;
  top: 0;
  height: 100vh;
  background: hsl(var(--background-secondary));
  border-right: 1px solid hsl(var(--border));
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
}

.app-logo {
  display: flex;
  justify-content: center;
  padding: var(--space-1) 0;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: hsl(var(--primary-foreground));
  text-decoration: none;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal) var(--spring-easing);
}

.logo-icon:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
}

.logo-icon:active {
  transform: scale(0.98);
}

/* 下部セクション */
.bottom-section {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 投稿するボタン */
.post-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: var(--radius-full);
  text-decoration: none;
  font-size: var(--font-size-md);
  font-weight: 600;
  transition: all var(--transition-normal) var(--spring-easing);
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.post-button:hover {
  background: hsl(var(--primary-hover));
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.post-button:active {
  transform: translateY(0) scale(0.98);
}

/* 認証セクション */
.auth-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid hsl(var(--border));
}

.auth-button {
  display: block;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  text-decoration: none;
  font-size: var(--font-size-base);
  font-weight: 500;
  text-align: center;
  transition: all var(--transition-normal) var(--spring-easing);
}

.auth-login {
  color: hsl(var(--foreground-secondary));
  background: hsl(var(--item-hover));
}

.auth-login:hover {
  background: hsl(var(--item-active));
  color: hsl(var(--foreground));
}

.auth-register {
  color: hsl(var(--primary-foreground));
  background: hsl(var(--primary));
}

.auth-register:hover {
  background: hsl(var(--primary-hover));
}

/* 中央コンテンツ */
.main-content {
  min-height: 100vh;
  border-right: 1px solid hsl(var(--border));
}

/* 右サイドバー */
.sidebar-right {
  position: sticky;
  top: 0;
  height: 100vh;
  background: hsl(var(--background-secondary));
  display: flex;
  flex-direction: column;
}

/* レスポンシブ */
@media (max-width: 1024px) {
  .three-column {
    grid-template-columns: var(--sidebar-collapsed-width) 1fr 320px;
  }

  .sidebar-left {
    padding: var(--space-2);
  }

  .post-button span,
  .auth-button {
    display: none;
  }

  .post-button {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
  }

  .auth-section {
    display: none;
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
