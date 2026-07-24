import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Navbar from '@/components/ui/Navbar'
import { useSession, signOut, signIn } from 'next-auth/react'

// Mock context for i18n
jest.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({
    lang: 'en',
    setLang: jest.fn(),
  }),
}))

const mockedUseSession = useSession as jest.Mock
const mockedSignOut = signOut as jest.Mock
const mockedSignIn = signIn as jest.Mock

describe('Navbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders only Home link when unauthenticated', () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    })

    render(<Navbar />)

    // Unauthenticated should only see Home and not secure links like Clinical Chat, Settings
    expect(screen.getAllByText('Home')[0]).toBeInTheDocument()
    expect(screen.queryByText('Clinical Chat')).not.toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })

  test('renders all secure navigation links when authenticated', () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: 'Dr. Rossi', email: 'rossi@clinic.it' } },
      status: 'authenticated',
    })

    render(<Navbar />)

    expect(screen.getAllByText('Home')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Clinical Chat')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Settings')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Benchmark Lab')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Clinical Knowledge')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Vector Stores')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Experimental')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Legacy')[0]).toBeInTheDocument()
    expect(screen.getAllByText('Legacy RAG Console')[0]).toBeInTheDocument()
  })

  test('renders user actions and allows sign out', () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: 'Dr. Rossi', email: 'rossi@clinic.it' } },
      status: 'authenticated',
    })

    render(<Navbar />)

    // User name or email should be visible in desktop/mobile view
    expect(screen.getByText('rossi@clinic.it')).toBeInTheDocument()
    
    // Sign out button click
    const signOutBtn = screen.getByText('Sign Out')
    fireEvent.click(signOutBtn)
    expect(mockedSignOut).toHaveBeenCalledTimes(1)
  })
})
