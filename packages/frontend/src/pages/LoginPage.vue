<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <RouterLink to="/" class="text-3xl font-bold text-primary">Yamix</RouterLink>
          <nav class="flex gap-4 items-center">
            <RouterLink to="/" class="text-gray-700 hover:text-primary">ホーム</RouterLink>
            <RouterLink to="/register" class="btn-primary text-sm">会員登録</RouterLink>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-md mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div class="card">
        <h1 class="text-3xl font-bold text-center mb-8">ログイン</h1>

        <!-- Error message -->
        <div v-if="authStore.error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-red-700">{{ authStore.error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
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
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="パスワードを入力"
            />
          </div>

          <!-- Submit button -->
          <button
            type="submit"
            :disabled="authStore.loading"
            class="btn-primary w-full"
          >
            {{ authStore.loading ? 'ログイン中...' : 'ログイン' }}
          </button>
        </form>

        <!-- Links -->
        <div class="mt-6 text-center text-sm">
          <p class="text-gray-600">
            アカウントをお持ちでない方は
            <RouterLink to="/register" class="text-primary underline">会員登録</RouterLink>
          </p>
        </div>
      </div>

      <!-- Additional info -->
      <div class="mt-8 text-center text-sm text-gray-600">
        <p>ログインすることで、あなたは利用規約とプライバシーポリシーに同意したものとみなされます。</p>
      </div>
    </main>
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
