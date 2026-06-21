import { jest } from '@jest/globals'
import { casesApi, chatApi } from '@/lib/api'
import * as nextAuth from 'next-auth/react'

describe('API Client tests', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: 'mock' }),
        text: () => Promise.resolve('{"data":"mock"}'),
      } as any)
    ) as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('casesApi.list calls fetch with pagination and auth token', async () => {
    ;(nextAuth.getSession as jest.Mock).mockResolvedValue({
      accessToken: 'test-token-123',
      expires: ''
    } as any)

    await casesApi.list({ page: 2, page_size: 10, search: 'bipolar' })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/cases?page=2&page_size=10&search=bipolar'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token-123',
        }),
      })
    )
  })

  test('api calls throw error on bad response', async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      } as any)
    ) as any

    await expect(casesApi.list({})).rejects.toThrow('API Error 400: Bad Request')
  })

  test('chatApi.getModels works correctly', async () => {
    ;(nextAuth.getSession as jest.Mock).mockResolvedValue(null)

    await chatApi.getModels()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/models'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )
  })
})
