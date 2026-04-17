# dopl-app — Changelog

All code changes logged in reverse chronological order.
Format: date, description, files, why, impact, testing, risks.

---

## [2026-04-17] — Plan 1: Transition Setup + Code Audit

**Plan:** `plans/2026-04-17-transition-and-audit.md` (implemented)

**Files added:**
- `PIPELINE.md` — 3-instance workflow (Architect / Reviewer / Implementer)
- `CLAUDE-BRAND.md` — brand + design system (extracted from original CLAUDE.md)
- `STATUS.md` — living project summary
- `.env.example` — 10 documented env vars (gitignore now exempts this file)
- `research/state-of-repo-2026-04-17.md` — full repo audit (34 routes, 103 TS files, 12.3K LOC, DB schema, recent commits, build warnings, env var grep, npm audit snapshot)
- `research/pivot-decision-2026-04-16.md` — Alpaca → SnapTrade pivot record (copied from dopl-mvp)
- `research/competitive-landscape-2026-04-13.md` (copied from dopl-mvp)
- `research/copy-trading-competitors-2026-04-10.md` (renamed from alpaca-competitors-*)
- `docs/SECURITY-CHECKLIST.md` — security audit checklist (copied + trimmed from dopl-mvp)
- `vitest.config.ts` — test runner config (jsdom, globals, @/ alias)
- `src/test-helpers/setup.ts` — imports `@testing-library/jest-dom`
- `src/test-helpers/supabase-mock.ts` — ported `buildChain` mock from dopl-mvp
- `src/lib/fm-resolver.ts` — pure function `resolveFm(fm, profile)` extracted from `feed/page.tsx`
- `src/lib/__tests__/fm-resolver.test.ts` — 10 assertions covering norm + resolveFm fallback paths
- `src/lib/__tests__/supabase-mock.test.ts` — 4 assertions validating the mock
- `src/lib/__tests__/snaptrade.test.ts` — 2 assertions validating module loads

**Files modified:**
- `CLAUDE.md` — rewritten as engineering reference (tech stack, revenue, terminology, DB pointer, conventions, pipeline ref, changelog protocol, folder structure, gotchas). Brand content moved to CLAUDE-BRAND.md; Next.js 16 gotcha references AGENTS.md.
- `package.json` — added `test` and `test:watch` scripts, added devDeps: vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @vitejs/plugin-react
- `.gitignore` — added `!.env.example` exemption so the template commits
- `src/app/feed/page.tsx` — replaced inline `resolveFm` closure with import from `@/lib/fm-resolver`; closure becomes `resolveFmById` that does map lookups and delegates to the pure function

**Memory folder populated:** `/Users/surfer/.claude/projects/-Users-surfer-Desktop-dopl-app/memory/` with 8 ported feedback files + 3 new dopl-app-specific memory files + rewritten `MEMORY.md` index.

**Why:** Foundational setup for 3-instance pipeline work on dopl-app. Establishes measurement baseline (audit), testing infrastructure (vitest), env var documentation, and pipeline conventions before Sprint 1 launches user-facing fixes.

**Impact:** No user-facing changes. Developer experience + future-plan fact base only. 15 tests now run under `npm test` where previously there were zero.

**Testing:**
- `npm test` — 15 passing across 3 test files (fm-resolver, supabase-mock, snaptrade)
- `npm run build` — TypeScript compiles cleanly; build fails at "Collecting page data" on the pre-existing Stripe eager-init bug (documented in `research/state-of-repo-2026-04-17.md` §7.3, tracked for Sprint 1). Not a regression.
- Manual: verified CLAUDE.md auto-load content covers tech stack + terminology; PIPELINE.md paths updated for dopl-app layout (no `dopl/` subfolder); memory folder files are complete.

**Risks:** None user-facing. The resolveFm refactor preserves exact behavior (including the "fund manager" fallback literal — that's Sprint 1's fix, not this plan's). axios CVEs (moderate, transitive via SnapTrade SDK) noted in §7.10 of audit — tracked for Sprint 3.

**Branch:** `chore/transition-setup` (local only — Surfer verifies + pushes + merges).
