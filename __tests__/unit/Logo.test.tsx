import React from 'react'
import { render, screen } from '@testing-library/react'
import { LogoWithText } from '@/components/Logo'

describe('LogoWithText', () => {
  it('renders the logo text correctly', () => {
    render(<LogoWithText />)
    expect(screen.getByText('Code Atlas')).toBeInTheDocument()
  })
})
