<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- Logo -->
      <div class="auth-logo">
        <RouterLink to="/" class="logo-icon">Y</RouterLink>
      </div>

      <!-- Card -->
      <div class="auth-card">
        <h1 class="auth-title">ログイン</h1>
        <p class="auth-subtitle">Yamixへようこそ</p>

        <!-- Error message -->
        <div v-if="authStore.error" class="error-message">
          <p>{{ authStore.error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <!-- Email -->
          <div class="form-group">
            <label class="form-label">メールアドレス</label>
            <input
              v-model="form.email"
              type="email"
              required
              class="form-input"
              placeholder="your@email.com"
            />
          </div>

          <!-- Password -->
          <div class="form-group">
            <label class="form-label">パスワード</label>
            <input
              v-model="form.password"
              type="password"
              required
              class="form-input"
              placeholder="パスワードを入力"
            />
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="authStore.loading"
            class="submit-button"
          >
            <span v-if="authStore.loading" class="loading-spinner"></span>
            {{ authStore.loading ? 'ログイン中...' : 'ログイン' }}
          </button>
        </form>

        <!-- Links -->
        <div class="auth-links">
          <p>
            アカウントをお持ちでない方は
            <RouterLink to="/register" class="auth-link">会員登録</RouterLink>
          </p>
        </div>
      </div>

      <!-- Additional info -->
      <p class="auth-terms">
        ログインすることで、利用規約とプライバシーポリシーに同意したものとみなされます。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  email: '',
  password: '',
})

onMounted(() => {
  // Redirect if already authenticated
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

async function handleSubmit() {
  const success = await authStore.login(form.value.email, form.value.password)

  if (success) {
    router.push('/')
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: hsl(var(--background));
}

.auth-container {
  width: 100%;
  max-width: 400px;
}

.auth-logo {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-8);
}

.logo-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-xl);
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: hsl(var(--primary-foreground));
  text-decoration: none;
  box-shadow: var(--shadow-lg);
  transition: all var(--transition-normal) var(--spring-easing);
}

.logo-icon:hover {
  transform: scale(1.05);
}

.auth-card {
  background: hsl(var(--background-secondary));
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  box-shadow: var(--shadow-lg);
}

.auth-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: hsl(var(--foreground));
  text-align: center;
  margin: 0 0 var(--space-2);
}

.auth-subtitle {
  font-size: var(--font-size-md);
  color: hsl(var(--foreground-secondary));
  text-align: center;
  margin: 0 0 var(--space-6);
}

.error-message {
  background: hsl(var(--error) / 0.1);
  border: 1px solid hsl(var(--error) / 0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-4);
}

.error-message p {
  margin: 0;
  color: hsl(var(--error));
  font-size: var(--font-size-sm);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: hsl(var(--foreground-secondary));
}

.form-input {
  display: block;
  width: 100%;
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-base);
  color: hsl(var(--foreground));
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-lg);
  transition: all var(--transition-normal) var(--spring-easing);
  outline: none;
}

.form-input:hover {
  border-color: hsl(var(--border-hover));
}

.form-input:focus {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
}

.form-input::placeholder {
  color: hsl(var(--foreground-tertiary));
}

.submit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-md);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-normal) var(--spring-easing);
  margin-top: var(--space-2);
}

.submit-button:hover:not(:disabled) {
  background: hsl(var(--primary-hover));
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.submit-button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid hsl(var(--primary-foreground) / 0.3);
  border-top-color: hsl(var(--primary-foreground));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-links {
  margin-top: var(--space-6);
  text-align: center;
}

.auth-links p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-secondary));
}

.auth-link {
  color: hsl(var(--primary));
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition-fast);
}

.auth-link:hover {
  color: hsl(var(--primary-hover));
  text-decoration: underline;
}

.auth-terms {
  margin-top: var(--space-6);
  text-align: center;
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
  line-height: var(--line-height-relaxed);
}
</style>
