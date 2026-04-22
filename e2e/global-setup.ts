import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import { mkdirSync } from 'fs'

// Playwright's global-setup module runs outside Next's runtime, so env
// files aren't loaded automatically. `loadEnvConfig` hydrates process.env
// from .env.local before we reach for SUPABASE_SERVICE_ROLE_KEY.
loadEnvConfig(process.cwd())

const TEST_FM_EMAIL = 'test-fm@dopl.test'
const TEST_FM_PASSWORD = 'testpass123456'
const TEST_FM_HANDLE = 'test-fm'
const TEST_FM_DISPLAY_NAME = 'Test FM'
const TEST_FM_BIO = 'e2e test account'

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — ' +
        'cannot mint test FM session. Make sure .env.local is populated.'
    )
  }
  const supabase = createClient(url, serviceKey)

  // Ensure the test FM auth user exists. listUsers returns the first
  // page only (up to 50 by default); a fresh dev DB fits in one page.
  const { data: existingUsers, error: listErr } =
    await supabase.auth.admin.listUsers()
  if (listErr) throw listErr
  let testUserId = existingUsers?.users?.find(
    (u) => u.email === TEST_FM_EMAIL
  )?.id

  if (!testUserId) {
    const { data: created, error: createErr } =
      await supabase.auth.admin.createUser({
        email: TEST_FM_EMAIL,
        password: TEST_FM_PASSWORD,
        email_confirm: true,
        user_metadata: { role: 'fund_manager', full_name: TEST_FM_DISPLAY_NAME },
      })
    if (createErr) throw createErr
    testUserId = created.user?.id
  }
  if (!testUserId) {
    throw new Error('Could not resolve test FM user id after create')
  }

  // Promote profile to fund_manager. The handle_new_user trigger writes
  // the profile row with role='subscriber' by default on signup.
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ role: 'fund_manager', full_name: TEST_FM_DISPLAY_NAME })
    .eq('id', testUserId)
  if (profileErr) {
    // eslint-disable-next-line no-console
    console.warn('profile role update failed:', profileErr.message)
  }

  // Upsert fund_managers row with bio + broker_connected so the dashboard
  // layout's fmNeedsOnboarding gate lets the test FM through to /dashboard
  // instead of redirecting to /onboarding.
  const { error: fmErr } = await supabase.from('fund_managers').upsert(
    {
      id: testUserId,
      handle: TEST_FM_HANDLE,
      display_name: TEST_FM_DISPLAY_NAME,
      bio: TEST_FM_BIO,
      broker_connected: true,
      broker_name: 'Manual Entry',
    },
    { onConflict: 'id' }
  )
  if (fmErr) {
    // eslint-disable-next-line no-console
    console.warn('fund_managers upsert failed:', fmErr.message)
  }

  // Capture session cookies by signing in through the live login page.
  // This exercises the SSR cookie path so Playwright tests hit an
  // authed /dashboard the same way a real user would.
  mkdirSync('e2e/.auth', { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', TEST_FM_EMAIL)
  await page.fill('input[type="password"]', TEST_FM_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30_000 })
  await context.storageState({ path: 'e2e/.auth/fm.json' })
  await browser.close()
}
