import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('shows Fail for a failing molecule', () => {
    render(<StatusBadge status="fail" score={0.9} />)
    expect(screen.getByText('Fail')).toBeInTheDocument()
  })
})
