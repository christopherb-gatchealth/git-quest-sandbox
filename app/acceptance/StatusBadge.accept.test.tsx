// Acceptance tests for Quest 9. These fail until you build
// components/StatusBadge.tsx and use it in app/page.tsx. Don't edit this
// file: make the tests pass by writing the component.
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from '@/components/StatusBadge'
import Page from '@/app/page'
import { MOLECULES } from '@/lib/molecules'

describe('Quest 9 acceptance: StatusBadge', () => {
  it.each([
    ['pass', 'Pass'],
    ['warn', 'Warn'],
    ['fail', 'Fail'],
  ] as const)('shows the "%s" status as the label "%s"', (status, label) => {
    render(<StatusBadge status={status} score={0.5} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows the score as a percentage with one decimal place', () => {
    render(<StatusBadge status="pass" score={0.183} />)
    expect(screen.getByText('18.3%')).toBeInTheDocument()
  })

  it('marks its outer element with a data-status attribute', () => {
    const { container } = render(<StatusBadge status="warn" score={0.4} />)
    expect(container.querySelector('[data-status="warn"]')).not.toBeNull()
  })

  it('is used for every row on the page', () => {
    const { container } = render(<Page />)
    expect(container.querySelectorAll('[data-status]')).toHaveLength(MOLECULES.length)
  })
})
