<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <RouterLink to="/" class="text-3xl font-bold text-primary">やみなべ</RouterLink>
          <nav class="flex gap-4 items-center">
            <RouterLink to="/" class="text-gray-700 hover:text-primary">ホーム</RouterLink>
            <RouterLink to="/login" class="btn-secondary text-sm">ログイン</RouterLink>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-md mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div class="card">
        <h1 class="text-3xl font-bold text-center mb-8">会員登録</h1>

        <!-- Error message -->
        <div v-if="authStore.error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-red-700">{{ authStore.error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Display Name -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              表示名
            </label>
            <input
              v-model="form.displayName"
              type="text"
              required
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="山田太郎"
            />
            <p class="text-sm text-gray-500 mt-1">他のユーザーに表示される名前です</p>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              v-model="form.email"
              type="email"
              required
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="your@email.com"
            />
          </div>

          <!-- Password -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              パスワード
            </label>
            <input
              v-model="form.password"
              type="password"
              required
              minlength="8"
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="8文字以上のパスワード"
            />
            <p class="text-sm text-gray-500 mt-1">8文字以上で入力してください</p>
          </div>

          <!-- Password Confirmation -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              パスワード（確認）
            </label>
            <input
              v-model="form.passwordConfirm"
              type="password"
              required
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="パスワードを再入力"
            />
            <p v-if="form.password && form.passwordConfirm && form.password !== form.passwordConfirm" class="text-sm text-red-500 mt-1">
              パスワードが一致しません
            </p>
          </div>

          <!-- Terms agreement -->
          <div>
            <label class="flex items-start gap-2">
              <input
                v-model="form.agreedToTerms"
                type="checkbox"
                required
                class="w-4 h-4 mt-1 text-primary focus:ring-primary"
              />
              <span class="text-sm text-gray-700">
                <a href="#" class="text-primary underline">利用規約</a>
                と
                <a href="#" class="text-primary underline">プライバシーポリシー</a>
                に同意します
              </span>
            </label>
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="authStore.loading || !canSubmit"
            class="btn-primary w-full"
          >
            {{ authStore.loading ? '登録中...' : '会員登録' }}
          </button>
        </form>

        <!-- Links -->
        <div class="mt-6 text-center text-sm">
          <p class="text-gray-600">
            すでにアカウントをお持ちの方は
            <RouterLink to="/login" class="text-primary underline">ログイン</RouterLink>
          </p>
        </div>
      </div>
    </main>
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
