import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Wallet, Transaction } from '@yamix/shared'
import { api } from '../api/client'

const WALLET_STORAGE_KEY = 'yamix_wallet'

export const useWalletStore = defineStore('wallet', () => {
  // State
  const wallet = ref<Wallet | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isConnected = computed(() => wallet.value !== null)
  const address = computed(() => wallet.value?.address || '')
  const balance = computed(() => wallet.value?.balance || 0)
  const walletId = computed(() => wallet.value?.id || '')

  // Initialize from localStorage
  function init() {
    const stored = localStorage.getItem(WALLET_STORAGE_KEY)
    if (stored) {
      try {
        wallet.value = JSON.parse(stored)
      } catch {
        localStorage.removeItem(WALLET_STORAGE_KEY)
      }
    }
  }

  // Create a new wallet
  async function createWallet() {
    loading.value = true
    error.value = null

    try {
      const response = await api.post<Wallet>('/api/wallets')
      wallet.value = response
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(response))
      return response
    } catch (err: any) {
      error.value = err.message || 'ウォレットの作成に失敗しました'
      return null
    } finally {
      loading.value = false
    }
  }

  // Fetch wallet by address
  async function fetchWallet(walletAddress: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<Wallet>(`/api/wallets/${walletAddress}`)
      wallet.value = response
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(response))
      return response
    } catch (err: any) {
      error.value = err.message || 'ウォレットの取得に失敗しました'
      return null
    } finally {
      loading.value = false
    }
  }

  // Refresh wallet balance
  async function refreshBalance() {
    if (!wallet.value?.address) return

    try {
      const response = await api.get<Wallet>(`/api/wallets/${wallet.value.address}`)
      wallet.value = response
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(response))
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

  // Disconnect wallet (create new identity)
  function disconnect() {
    wallet.value = null
    localStorage.removeItem(WALLET_STORAGE_KEY)
  }

  // Reincarnate (create new identity)
  async function reincarnate() {
    disconnect()
    return createWallet()
  }

  // Initialize on store creation
  init()

  return {
    wallet,
    loading,
    error,
    isConnected,
    address,
    balance,
    walletId,
    createWallet,
    fetchWallet,
    refreshBalance,
    sendTokens,
    disconnect,
    reincarnate,
  }
})
