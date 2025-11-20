import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Wallet, Transaction } from '@yamix/shared'
import { api } from '../api/client'

const WALLETS_STORAGE_KEY = 'yamix_wallets'
const ACTIVE_WALLET_KEY = 'yamix_active_wallet'
const MAX_WALLETS = 10 // Maximum wallets per browser

export const useWalletStore = defineStore('wallet', () => {
  // State
  const wallets = ref<Wallet[]>([])
  const activeWalletAddress = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const wallet = computed(() =>
    wallets.value.find(w => w.address === activeWalletAddress.value) || null
  )
  const isConnected = computed(() => wallet.value !== null)
  const address = computed(() => wallet.value?.address || '')
  const name = computed(() => wallet.value?.name || null)
  const balance = computed(() => wallet.value?.balance || 0)
  const walletId = computed(() => wallet.value?.id || '')
  const walletCount = computed(() => wallets.value.length)
  const canCreateWallet = computed(() => wallets.value.length < MAX_WALLETS)

  // Initialize from localStorage
  function init() {
    const storedWallets = localStorage.getItem(WALLETS_STORAGE_KEY)
    const storedActive = localStorage.getItem(ACTIVE_WALLET_KEY)

    if (storedWallets) {
      try {
        wallets.value = JSON.parse(storedWallets)
      } catch {
        localStorage.removeItem(WALLETS_STORAGE_KEY)
      }
    }

    if (storedActive && wallets.value.some(w => w.address === storedActive)) {
      activeWalletAddress.value = storedActive
    } else if (wallets.value.length > 0) {
      activeWalletAddress.value = wallets.value[0].address
    }
  }

  // Save to localStorage
  function saveToStorage() {
    localStorage.setItem(WALLETS_STORAGE_KEY, JSON.stringify(wallets.value))
    if (activeWalletAddress.value) {
      localStorage.setItem(ACTIVE_WALLET_KEY, activeWalletAddress.value)
    } else {
      localStorage.removeItem(ACTIVE_WALLET_KEY)
    }
  }

  // Create a new wallet
  async function createWallet(walletName?: string) {
    // Check wallet limit
    if (wallets.value.length >= MAX_WALLETS) {
      error.value = `ウォレットは最大${MAX_WALLETS}個までです`
      return null
    }

    loading.value = true
    error.value = null

    try {
      const response = await api.post<Wallet>('/api/wallets', { name: walletName || null })
      wallets.value.push(response)
      activeWalletAddress.value = response.address
      saveToStorage()
      return response
    } catch (err: any) {
      error.value = err.message || 'ウォレットの作成に失敗しました'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update wallet name
  async function updateWalletName(walletAddress: string, newName: string | null) {
    loading.value = true
    error.value = null

    try {
      const response = await api.patch<Wallet>(`/api/wallets/${walletAddress}`, { name: newName })

      // Update in wallets array
      const index = wallets.value.findIndex(w => w.address === walletAddress)
      if (index >= 0) {
        wallets.value[index] = response
      }

      saveToStorage()
      return response
    } catch (err: any) {
      error.value = err.message || '名前の更新に失敗しました'
      return null
    } finally {
      loading.value = false
    }
  }

  // Switch to a different wallet
  function switchWallet(walletAddress: string) {
    if (wallets.value.some(w => w.address === walletAddress)) {
      activeWalletAddress.value = walletAddress
      saveToStorage()
      return true
    }
    return false
  }

  // Delete a wallet
  async function deleteWallet(walletAddress: string) {
    loading.value = true
    error.value = null

    try {
      await api.delete(`/api/wallets/${walletAddress}`)
    } catch (err: any) {
      // 404 means wallet doesn't exist in DB, but we should still remove from local storage
      // Other errors should be reported but we still remove locally to maintain sync
      if (!err.message?.includes('404')) {
        error.value = err.message || 'ウォレットの削除に失敗しました'
      }
    }

    // Always remove from local storage to maintain consistency
    wallets.value = wallets.value.filter(w => w.address !== walletAddress)

    // If deleted wallet was active, switch to another
    if (activeWalletAddress.value === walletAddress) {
      activeWalletAddress.value = wallets.value.length > 0 ? wallets.value[0].address : null
    }

    saveToStorage()
    loading.value = false
    return true
  }

  // Fetch wallet by address and update local state
  async function fetchWallet(walletAddress: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<Wallet>(`/api/wallets/${walletAddress}`)

      // Update in wallets array
      const index = wallets.value.findIndex(w => w.address === walletAddress)
      if (index >= 0) {
        wallets.value[index] = response
      }

      saveToStorage()
      return response
    } catch (err: any) {
      error.value = err.message || 'ウォレットの取得に失敗しました'
      return null
    } finally {
      loading.value = false
    }
  }

  // Refresh active wallet balance
  async function refreshBalance() {
    if (!activeWalletAddress.value) return

    try {
      const response = await api.get<Wallet>(`/api/wallets/${activeWalletAddress.value}`)

      // Update in wallets array
      const index = wallets.value.findIndex(w => w.address === activeWalletAddress.value)
      if (index >= 0) {
        wallets.value[index] = response
      }

      saveToStorage()
    } catch {
      // Silently fail on refresh
    }
  }

  // Send tokens to a post author
  async function sendTokens(postId: string, amount: number = 1) {
    if (!wallet.value?.id) {
      error.value = 'ウォレットが接続されていません'
      return null
    }

    loading.value = true
    error.value = null

    try {
      const response = await api.post<Transaction>('/api/transactions', {
        postId,
        senderId: wallet.value.id,
        amount,
      })

      // Refresh balance after transaction
      await refreshBalance()

      return response
    } catch (err: any) {
      error.value = err.message || 'トークンの送信に失敗しました'
      return null
    } finally {
      loading.value = false
    }
  }

  // Disconnect current wallet (just deselect, keep in storage)
  function disconnect() {
    activeWalletAddress.value = null
    saveToStorage()
  }

  // Reincarnate (create new identity)
  async function reincarnate() {
    return createWallet()
  }

  // Initialize on store creation
  init()

  return {
    wallet,
    wallets,
    loading,
    error,
    isConnected,
    address,
    name,
    balance,
    walletId,
    walletCount,
    canCreateWallet,
    createWallet,
    updateWalletName,
    switchWallet,
    deleteWallet,
    fetchWallet,
    refreshBalance,
    sendTokens,
    disconnect,
    reincarnate,
  }
})
