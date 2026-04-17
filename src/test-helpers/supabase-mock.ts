/**
 * Reusable Supabase client mock for Vitest tests.
 *
 * Ported from dopl-mvp's allocation-position-service.test.ts (buildChain)
 * + dopler-service.test.ts (response queue).
 *
 * Usage:
 *   import { buildChain, createMockClient } from '@/test-helpers/supabase-mock'
 *
 *   vi.mock('@/lib/supabase-admin', () => ({
 *     createAdminClient: () => createMockClient({
 *       profiles: [{ id: 'user-1', full_name: 'Alice' }],
 *     }),
 *   }))
 */

type Row = Record<string, unknown>

export interface MockState {
  rows: Record<string, Row[]>
  dbError: { message: string } | null
  insertData: unknown[]
  upsertData: unknown[]
  updateData: unknown[]
  deleteFilters: Record<string, unknown>[]
}

export function createMockState(initialRows: Record<string, Row[]> = {}): MockState {
  return {
    rows: { ...initialRows },
    dbError: null,
    insertData: [],
    upsertData: [],
    updateData: [],
    deleteFilters: [],
  }
}

/**
 * Build a chainable query object that matches Supabase's fluent API
 * surface (.select().eq().single() etc).
 *
 * Thens are triggered by awaiting the chain — resolves with { data, error }
 * where data is filtered per accumulated .eq() / .in() calls.
 */
export function buildChain(state: MockState, tableName: string) {
  const filters: Record<string, unknown> = {}
  let inFilters: { col: string; values: unknown[] } | null = null
  let singleCalled = false
  let orderCol: string | null = null
  let orderAsc = true
  const chain: Record<string, (...args: unknown[]) => unknown> = {}
  const self = () => chain

  chain.select = () => chain
  chain.insert = (data: unknown) => {
    state.insertData.push(data)
    return { data: Array.isArray(data) ? data : [data], error: state.dbError }
  }
  chain.upsert = (data: unknown) => {
    state.upsertData.push(data)
    return { data: Array.isArray(data) ? data : [data], error: state.dbError }
  }
  chain.update = (data: unknown) => {
    state.updateData.push(data)
    return chain
  }
  chain.delete = () => {
    state.deleteFilters.push({ ...filters })
    return chain
  }
  chain.eq = (col: string, val: unknown) => {
    filters[col] = val
    return chain
  }
  chain.in = (col: string, values: unknown[]) => {
    inFilters = { col, values }
    return chain
  }
  chain.order = (col: string, opts?: { ascending?: boolean }) => {
    orderCol = col
    orderAsc = opts?.ascending ?? true
    return chain
  }
  chain.limit = self
  chain.single = () => {
    singleCalled = true
    return chain
  }

  const thenHandler = (resolve: (val: unknown) => void) => {
    const rows = state.rows[tableName] || []
    let filtered = rows
    for (const [col, val] of Object.entries(filters)) {
      filtered = filtered.filter((r: Row) => r[col] === val)
    }
    if (inFilters) {
      const { col, values } = inFilters
      const set = new Set(values)
      filtered = filtered.filter((r: Row) => set.has(r[col]))
    }
    if (orderCol) {
      const col = orderCol
      const asc = orderAsc
      filtered = [...filtered].sort((a: Row, b: Row) => {
        const av = a[col] as string | number
        const bv = b[col] as string | number
        if (av === bv) return 0
        const cmp = av < bv ? -1 : 1
        return asc ? cmp : -cmp
      })
    }
    resolve({ data: singleCalled ? (filtered[0] ?? null) : filtered, error: state.dbError })
  }
  chain.then = thenHandler as unknown as (...args: unknown[]) => unknown

  return chain
}

/**
 * Create a minimal mock Supabase client with .from(table) chaining.
 * Returns the same `state` object used internally so tests can
 * inspect mutations (state.insertData, state.deleteFilters, etc).
 */
export function createMockClient(initialRows: Record<string, Row[]> = {}) {
  const state = createMockState(initialRows)
  return {
    state,
    client: {
      from: (table: string) => buildChain(state, table),
    },
  }
}
