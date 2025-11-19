// This store is deprecated. Use wallet store instead.
// Kept for backwards compatibility during migration.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWalletStore } from './wallet'

export const useAuthStore = defineStore('auth', () => {
  const walletStore = useWalletStore()

  // Proxy to wallet store for backwards compatibility
  const isAuthenticated = computed(() => walletStore.isConnected)
  const user = computed(() => walletStore.wallet ? { displayName: walletStore.address } : null)
  const loading = computed(() => walletStore.loading)
  const error = computed(() => walletStore.error)

  // No-op functions for backwards compatibility
  async function fetchUser() {
    // No longer needed - wallet is loaded from localStorage
  }

  function logout() {
    walletStore.disconnect()
  }

  return {
    user,
    loading,
    error,
    isAuthenticated,
    fetchUser,
    logout,
  }
})
