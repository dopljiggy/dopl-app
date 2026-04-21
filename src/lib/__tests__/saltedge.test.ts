import { describe, it, expect } from 'vitest'
import { getMinFromDate } from '../saltedge'

describe('getMinFromDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    const result = getMinFromDate()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a date within 95 days of today (rolling ~90-day window)', () => {
    const result = getMinFromDate()
    const resultMs = new Date(result + 'T00:00:00Z').getTime()
    const diffDays = (Date.now() - resultMs) / (24 * 60 * 60 * 1000)
    // Allow ±5 days of slack for clock/timezone edge cases; core contract is
    // "today - 90 days" so diff should always land near 90.
    expect(diffDays).toBeGreaterThanOrEqual(89)
    expect(diffDays).toBeLessThanOrEqual(95)
  })

  it('sits comfortably inside Salt Edge rolling 2-year (730-day) window', () => {
    const result = getMinFromDate()
    const resultMs = new Date(result + 'T00:00:00Z').getTime()
    const diffDays = (Date.now() - resultMs) / (24 * 60 * 60 * 1000)
    expect(diffDays).toBeLessThan(730)
  })
})
