import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import OAuthReturnPage from '@/app/oauth-return/page'

const searchParamsMock = vi.fn()

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsMock }),
}))

beforeEach(() => {
  vi.useFakeTimers()
  searchParamsMock.mockReset()
  // window.close() in jsdom throws noisy errors; stub it.
  vi.spyOn(window, 'close').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('OAuthReturnPage', () => {
  it('renders "SnapTrade" label when provider=snaptrade', () => {
    searchParamsMock.mockReturnValue('snaptrade')
    render(<OAuthReturnPage />)
    expect(screen.getByText(/connected via SnapTrade/i)).toBeInTheDocument()
  })

  it('renders "Stripe" label when provider=stripe', () => {
    searchParamsMock.mockReturnValue('stripe')
    render(<OAuthReturnPage />)
    expect(screen.getByText(/connected via Stripe/i)).toBeInTheDocument()
  })

  it('falls back to "your broker" when provider is unknown', () => {
    searchParamsMock.mockReturnValue(null)
    render(<OAuthReturnPage />)
    expect(screen.getByText(/connected via your broker/i)).toBeInTheDocument()
  })

  it('fallback button hidden first 300ms, visible after', () => {
    searchParamsMock.mockReturnValue('snaptrade')
    render(<OAuthReturnPage />)
    expect(screen.queryByText('return to dopl')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(screen.getByText('return to dopl')).toBeInTheDocument()
  })

  it('clicking fallback button navigates to /onboarding?connected=true', () => {
    searchParamsMock.mockReturnValue('snaptrade')
    // Spy on href assignment via Object.defineProperty so we can read the
    // set value without actually navigating the jsdom window.
    let assigned: string | null = null
    Object.defineProperty(window, 'location', {
      value: {
        get href() {
          return assigned ?? 'http://localhost/'
        },
        set href(v: string) {
          assigned = v
        },
      },
      writable: true,
    })
    render(<OAuthReturnPage />)
    act(() => {
      vi.advanceTimersByTime(350)
    })
    fireEvent.click(screen.getByText('return to dopl'))
    expect(assigned).toContain('/onboarding?connected=true')
  })
})
