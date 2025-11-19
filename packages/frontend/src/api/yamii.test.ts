import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { yamiiApi, type CounselingRequest, type CounselingResponse } from './yamii'

// fetchをモック
const mockFetch = vi.fn()
;(globalThis as any).fetch = mockFetch

describe('yamiiApi', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sendCounselingMessage', () => {
    it('正常なリクエストでレスポンスを返す', async () => {
      const mockResponse: CounselingResponse = {
        response: 'テスト応答です',
        session_id: 'session-123',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: ['質問1', '質問2'],
        is_crisis: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const request: CounselingRequest = {
        message: 'こんにちは',
        user_id: 'user-123',
      }

      const result = await yamiiApi.sendCounselingMessage(request)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/counseling'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(request),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('セッションIDを含むリクエストを送信できる', async () => {
      const mockResponse: CounselingResponse = {
        response: '応答',
        session_id: 'session-456',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: [],
        is_crisis: false,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const request: CounselingRequest = {
        message: 'テスト',
        user_id: 'user-123',
        session_id: 'session-456',
        user_name: 'テストユーザー',
      }

      await yamiiApi.sendCounselingMessage(request)

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(callBody.session_id).toBe('session-456')
      expect(callBody.user_name).toBe('テストユーザー')
    })

    it('APIエラー時に例外を投げる', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'サーバーエラー' }),
      })

      const request: CounselingRequest = {
        message: 'テスト',
        user_id: 'user-123',
      }

      await expect(yamiiApi.sendCounselingMessage(request)).rejects.toThrow()
    })

    it('ネットワークエラー時に例外を投げる', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const request: CounselingRequest = {
        message: 'テスト',
        user_id: 'user-123',
      }

      await expect(yamiiApi.sendCounselingMessage(request)).rejects.toThrow('Network error')
    })
  })

  describe('healthCheck', () => {
    it('ヘルスチェックが正常に動作する', async () => {
      const mockHealth = {
        status: 'healthy',
        timestamp: '2024-01-01T00:00:00',
        service: 'Yamii Counseling API',
        version: '1.0.0',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHealth),
      })

      const result = await yamiiApi.healthCheck()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.objectContaining({
          method: 'GET',
        })
      )
      expect(result.status).toBe('healthy')
    })
  })
})
