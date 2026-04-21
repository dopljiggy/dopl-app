import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NavLink, NavLinkView } from '@/components/ui/nav-link'

describe('NavLinkView', () => {
  it('pending=true → pending class applied', () => {
    render(
      <NavLinkView pending className="base-class" pendingClassName="opacity-60">
        hello
      </NavLinkView>
    )
    const span = screen.getByText('hello')
    expect(span.className).toContain('opacity-60')
    expect(span.className).toContain('base-class')
  })

  it('pending=false → no pending class', () => {
    render(
      <NavLinkView pending={false} className="base-class" pendingClassName="opacity-60">
        hello
      </NavLinkView>
    )
    const span = screen.getByText('hello')
    expect(span.className).not.toContain('opacity-60')
    expect(span.className).toContain('base-class')
  })
})

describe('NavLink', () => {
  it('renders children and href on the underlying anchor', () => {
    render(<NavLink href="/foo">hello</NavLink>)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/foo')
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
