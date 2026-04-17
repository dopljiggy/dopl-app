import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// The route module reads env at call time, so we mutate process.env per test.
const ORIGINAL_ENV = { ...process.env }

async function importRoute() {
  vi.resetModules()
  return await import('../route')
}

function makeRequest(authHeader?: string): Request {
  const headers = new Headers()
  if (authHeader) headers.set('authorization', authHeader)
  return new Request('http://localhost/api/migrate', {
    method: 'POST',
    headers,
  })
}

describe('/api/migrate POST', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('500 with generic error body when MIGRATION_ADMIN_TOKEN is not configured', async () => {
    delete process.env.MIGRATION_ADMIN_TOKEN
    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer anything'))
    expect(res.status).toBe(500)
    const body = await res.json()
    // Response body must NOT leak the gate mechanism or env-var name.
    expect(JSON.stringify(body)).not.toMatch(/MIGRATION_ADMIN_TOKEN/i)
  })

  it('401 when Authorization header is missing', async () => {
    process.env.MIGRATION_ADMIN_TOKEN = 'expected-token'
    const { POST } = await importRoute()
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
  })

  it('401 when Authorization header has wrong token', async () => {
    process.env.MIGRATION_ADMIN_TOKEN = 'expected-token'
    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer wrong-token'))
    expect(res.status).toBe(401)
  })

  it('401 when Authorization header is malformed (no Bearer prefix)', async () => {
    process.env.MIGRATION_ADMIN_TOKEN = 'expected-token'
    const { POST } = await importRoute()
    const res = await POST(makeRequest('expected-token'))
    expect(res.status).toBe(401)
  })

  it('calls exec_sql and returns ok:true when token matches', async () => {
    process.env.MIGRATION_ADMIN_TOKEN = 'expected-token'
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))
    const { POST } = await importRoute()
    const res = await POST(makeRequest('Bearer expected-token'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toContain('/rest/v1/rpc/exec_sql')
  })
})
