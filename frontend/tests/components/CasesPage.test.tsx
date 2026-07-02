import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import CasesPage from '@/app/benchmark/cases/page'
import { casesApi, chatApi, benchmarkApi } from '@/lib/api'
import { useSession, signIn } from 'next-auth/react'

// Mock the API client functions
jest.mock('@/lib/api', () => ({
  casesApi: {
    list: jest.fn(),
  },
  chatApi: {
    getModels: jest.fn(),
  },
  benchmarkApi: {
    run: jest.fn(),
  },
}))

describe('CasesPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default mock implementation
    ;(chatApi.getModels as jest.Mock).mockResolvedValue({
      models: ['model-1', 'model-2'],
      default_model: 'model-1',
    })
  })

  test('renders page title and filters', async () => {
    ;(casesApi.list as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 1,
    })

    render(<CasesPage />)

    expect(screen.getByText('DSM-5 Clinical Cases')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search cases by title or content...')).toBeInTheDocument()
  })

  test('displays loading spinner and then displays cases list', async () => {
    ;(casesApi.list as jest.Mock).mockResolvedValue({
      items: [
        {
          id: 'case-1',
          case_number: 'Case 1.1',
          title: 'Depressive Case',
          is_reviewed: true,
          anamnesis_preview: 'Patient feels sad...',
          source_page: 5,
          run_count: 0,
          created_at: '2026-06-21T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
      total_pages: 1,
    })

    render(<CasesPage />)

    // Initially should show loading
    const loadingEl = screen.queryByRole('status') || 
                      screen.queryByText(/loading/i) || 
                      document.querySelector('.loading')
    expect(loadingEl).toBeInTheDocument()

    // Wait for the timeout load and render
    await waitFor(() => {
      expect(screen.getByText('Depressive Case')).toBeInTheDocument()
    })
  })

  test('displays empty state when no cases are returned', async () => {
    ;(casesApi.list as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      total_pages: 1,
    })

    render(<CasesPage />)

    await waitFor(() => {
      expect(screen.getByText(/No DSM-5 Clinical Cases found/i)).toBeInTheDocument()
    })
  })

  test('displays error alert on API failure', async () => {
    ;(casesApi.list as jest.Mock).mockRejectedValue(new Error('Connection timed out'))

    render(<CasesPage />)

    await waitFor(() => {
      expect(screen.getByText('Impossibile caricare i casi: Connection timed out')).toBeInTheDocument()
    })
  })
})
