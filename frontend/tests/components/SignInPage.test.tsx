import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import SignInPage from '@/app/auth/signin/page'
import { signIn } from 'next-auth/react'

// Cast mock to inspect calls
const mockedSignIn = signIn as jest.Mock

describe('SignInPage Component', () => {
  beforeEach(() => {
    mockedSignIn.mockClear()
  })

  test('renders signin page correctly', () => {
    render(<SignInPage />)
    expect(screen.getByText('Benvenuto in LLMind2')).toBeInTheDocument()
    expect(screen.getByText("Accedi tramite l'Identity Provider sicuro dell'università")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accedi con Keycloak' })).toBeInTheDocument()
  })

  test('calls signIn function on button click', () => {
    render(<SignInPage />)
    const button = screen.getByRole('button', { name: 'Accedi con Keycloak' })
    fireEvent.click(button)

    expect(mockedSignIn).toHaveBeenCalledTimes(1)
    expect(mockedSignIn).toHaveBeenCalledWith('keycloak', { callbackUrl: '/' })
  })
})
