/**
 * Simple API client
 */

const BASE_URL = import.meta.env.VITE_API_URL || ''

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: any
  params?: Record<string, any>
}

class ApiClient {
  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, params } = options

    // Build URL with query params
    let url = `${BASE_URL}${path}`
    if (params) {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value))
        }
      })
      const queryString = searchParams.toString()
      if (queryString) {
        url += `?${queryString}`
      }
    }

    // Build request options
    const fetchOptions: RequestInit = {
      method,
      headers: { ...headers },
    }

    // Only set Content-Type and body for methods that typically have a body
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(body ?? {})
    } else if (body) {
      (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'リクエストに失敗しました' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  async get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' })
  }

  async post<T>(path: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body })
  }

  async put<T>(path: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body })
  }

  async patch<T>(path: string, body?: any, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PATCH', body })
  }

  async delete<T>(path: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' })
  }
}

export const api = new ApiClient()
