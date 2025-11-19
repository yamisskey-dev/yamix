<template>
  <div class="auth-page">
    <div class="auth-container">
      <!-- Logo -->
      <div class="auth-logo">
        <RouterLink to="/" class="logo-icon">Y</RouterLink>
      </div>

      <!-- Card -->
      <div class="auth-card">
        <h1 class="auth-title">会員登録</h1>
        <p class="auth-subtitle">Yamixに参加しましょう</p>

        <!-- Error message -->
        <div v-if="authStore.error" class="error-message">
          <p>{{ authStore.error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="auth-form">
          <!-- Display Name -->
          <div class="form-group">
            <label class="form-label">表示名</label>
            <input
              v-model="form.displayName"
              type="text"
              required
              class="form-input"
              placeholder="ニックネーム"
            />
            <p class="form-hint">他のユーザーに表示される名前です</p>
          </div>

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
              minlength="8"
              class="form-input"
              placeholder="8文字以上のパスワード"
            />
            <p class="form-hint">8文字以上で入力してください</p>
          </div>

          <!-- Password Confirmation -->
          <div class="form-group">
            <label class="form-label">パスワード（確認）</label>
            <input
              v-model="form.passwordConfirm"
              type="password"
              required
              class="form-input"
              placeholder="パスワードを再入力"
            />
            <p v-if="form.password && form.passwordConfirm && form.password !== form.passwordConfirm" class="form-error">
              パスワードが一致しません
            </p>
          </div>

          <!-- Terms agreement -->
          <div class="form-checkbox">
            <label class="checkbox-label">
              <input
                v-model="form.agreedToTerms"
                type="checkbox"
                required
                class="checkbox-input"
              />
              <span class="checkbox-text">
                <a href="#" class="auth-link">利用規約</a>
                と
                <a href="#" class="auth-link">プライバシーポリシー</a>
                に同意します
              </span>
            </label>
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="authStore.loading || !canSubmit"
            class="submit-button"
          >
            <span v-if="authStore.loading" class="loading-spinner"></span>
            {{ authStore.loading ? '登録中...' : '会員登録' }}
          </button>
        </form>

        <!-- Links -->
        <div class="auth-links">
          <p>
            すでにアカウントをお持ちの方は
            <RouterLink to="/login" class="auth-link">ログイン</RouterLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({
  displayName: '',
  email: '',
  password: '',
  passwordConfirm: '',
  agreedToTerms: false,
})

const canSubmit = computed(() => {
  return (
    form.value.displayName &&
    form.value.email &&
    form.value.password &&
    form.value.password === form.value.passwordConfirm &&
    form.value.agreedToTerms
  )
})

onMounted(() => {
  // Redirect if already authenticated
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

async function handleSubmit() {
  if (!canSubmit.value) return

  const success = await authStore.register(
    form.value.email,
    form.value.password,
    form.value.displayName
  )

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

.form-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
}

.form-error {
  margin: 0;
  font-size: var(--font-size-xs);
  color: hsl(var(--error));
}

.form-checkbox {
  margin-top: var(--space-2);
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  cursor: pointer;
}

.checkbox-input {
  width: 18px;
  height: 18px;
  margin-top: 2px;
  accent-color: hsl(var(--primary));
  cursor: pointer;
  flex-shrink: 0;
}

.checkbox-text {
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-secondary));
  line-height: var(--line-height-normal);
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
</style>
