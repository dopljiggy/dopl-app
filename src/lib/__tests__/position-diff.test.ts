import { describe, it, expect } from 'vitest'
import { computeChanges } from '@/lib/position-diff'

type Prev = { id: string; ticker: string; shares: number }
type Next = { ticker: string; shares: number }

const p = (id: string, ticker: string, shares: number): Prev =>
  ({ id, ticker, shares })
const n = (ticker: string, shares: number): Next =>
  ({ ticker, shares })

describe('computeChanges (scoped to already-assigned tickers)', () => {
  it('empty prev + empty next → no changes', () => {
    expect(computeChanges([], [])).toEqual([])
  })

  it('new ticker in next but not in prev → NO change (buys do not come from sync)', () => {
    const changes = computeChanges([], [n('AAPL', 10)])
    expect(changes).toEqual([])
  })

  it('ticker removed from broker → "sell" change with prev row id', () => {
    const changes = computeChanges([p('pos-1', 'MSFT', 5)], [])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      type: 'sell',
      ticker: 'MSFT',
      positionId: 'pos-1',
      prevShares: 5,
    })
  })

  it('share count changed → "rebalance" change', () => {
    const changes = computeChanges([p('pos-2', 'TSLA', 10)], [n('TSLA', 15)])
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      type: 'rebalance',
      ticker: 'TSLA',
      positionId: 'pos-2',
      prevShares: 10,
      shares: 15,
    })
  })

  it('share count unchanged → no change emitted', () => {
    expect(computeChanges([p('pos-3', 'NVDA', 7)], [n('NVDA', 7)])).toEqual([])
  })

  it('mixed: 1 rebalance, 1 sell, 1 new-in-broker-but-not-assigned (ignored)', () => {
    const prev = [p('id-a', 'AAPL', 10), p('id-b', 'MSFT', 5)]
    const next = [n('AAPL', 12), n('GOOG', 3)] // GOOG is new — ignored
    const changes = computeChanges(prev, next)
    expect(changes).toHaveLength(2)
    const byType = Object.fromEntries(
      changes.map((c) => [c.type + ':' + c.ticker, c])
    )
    expect(byType['rebalance:AAPL']).toMatchObject({ prevShares: 10, shares: 12 })
    expect(byType['sell:MSFT']).toMatchObject({ positionId: 'id-b', prevShares: 5 })
    expect(byType['buy:GOOG']).toBeUndefined()
  })

  it('per-portfolio scoping: a ticker assigned to portfolio A is not reflected in portfolio B', () => {
    // This is the invariant: the sync route calls computeChanges once per
    // portfolio, passing only that portfolio's assigned positions as prev.
    // At the pure-function level, scoping is enforced by the caller.
    const portfolioA = [p('a-aapl', 'AAPL', 10)]
    const portfolioB = [p('b-msft', 'MSFT', 5)]
    const live = [n('AAPL', 10), n('MSFT', 5)]
    expect(computeChanges(portfolioA, live)).toEqual([]) // AAPL unchanged
    expect(computeChanges(portfolioB, live)).toEqual([]) // MSFT unchanged
    // Now MSFT disappears from the broker.
    const liveAfter = [n('AAPL', 10)]
    expect(computeChanges(portfolioA, liveAfter)).toEqual([]) // AAPL still there
    const bChanges = computeChanges(portfolioB, liveAfter)
    expect(bChanges).toHaveLength(1)
    expect(bChanges[0]).toMatchObject({ type: 'sell', ticker: 'MSFT' })
  })

  it('ticker compare is case-insensitive', () => {
    expect(
      computeChanges([p('pos-5', 'aapl', 10)], [n('AAPL', 10)])
    ).toEqual([])
  })

  it('fractional shares compared with epsilon', () => {
    expect(
      computeChanges([p('pos-6', 'BRK.B', 0.5)], [n('BRK.B', 0.5000001)])
    ).toEqual([])
  })
})
