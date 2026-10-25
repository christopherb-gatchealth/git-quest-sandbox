import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ScoreBar from './ScoreBar'

describe('ScoreBar', () => {
  it('shows the score out of 100', () => {
    render(<ScoreBar score={0.46} />)
    expect(screen.getByText('46')).toBeInTheDocument()
  })

  it('clamps scores above 1 to 100', () => {
    render(<ScoreBar score={1.7} />)
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100')
  })
})
