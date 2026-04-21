import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

/**
 * Minimal harness component mirroring the onboarding-client's
 * visibilitychange listener so we can exercise the refresh-trigger
 * logic in isolation.
 */
function VisibilityHarness() {
  const router = useRouter()
  useEffect(() => {
    let lastHiddenAt = 0
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAt = Date.now()
        return
      }
      if (Date.now() - lastHiddenAt > 500) {
        router.refresh()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [router])
  return null
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('onboarding visibilitychange listener', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refreshMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls router.refresh once after > 500ms away', () => {
    render(<VisibilityHarness />)
    act(() => setVisibility('hidden'))
    act(() => {
      vi.advanceTimersByTime(800)
    })
    act(() => setVisibility('visible'))
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT call router.refresh on rapid alt-tab (< 500ms)', () => {
    render(<VisibilityHarness />)
    act(() => setVisibility('hidden'))
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => setVisibility('visible'))
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
