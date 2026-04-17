import { describe, it, expect } from 'vitest'
import { createMockClient } from '@/test-helpers/supabase-mock'

describe('supabase-mock buildChain', () => {
  it('select().eq().single() returns filtered row', async () => {
    const { client } = createMockClient({
      profiles: [
        { id: 'user-1', full_name: 'Alice' },
        { id: 'user-2', full_name: 'Bob' },
      ],
    })

    const { data, error } = await client.from('profiles').select('*').eq('id', 'user-2').single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ id: 'user-2', full_name: 'Bob' })
  })

  it('select().in() filters by array', async () => {
    const { client } = createMockClient({
      fund_managers: [
        { id: 'fm-1', handle: 'alice' },
        { id: 'fm-2', handle: 'bob' },
        { id: 'fm-3', handle: 'carol' },
      ],
    })

    const { data } = await client.from('fund_managers').select('*').in('id', ['fm-1', 'fm-3'])
    expect(data).toHaveLength(2)
    expect((data as { handle: string }[]).map(r => r.handle)).toEqual(['alice', 'carol'])
  })

  it('single() with no match returns null data', async () => {
    const { client } = createMockClient({ profiles: [] })
    const { data, error } = await client.from('profiles').select('*').eq('id', 'missing').single()
    expect(data).toBeNull()
    expect(error).toBeNull()
  })

  it('insert captures the row on state.insertData', async () => {
    const { client, state } = createMockClient({ portfolios: [] })
    await client.from('portfolios').insert({ name: 'Test Portfolio', fund_manager_id: 'fm-1' })
    expect(state.insertData).toHaveLength(1)
    expect(state.insertData[0]).toMatchObject({ name: 'Test Portfolio' })
  })
})
