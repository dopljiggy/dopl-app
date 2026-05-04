# IMPROVEMENT.md — Team Feedback Collection

Sprint 14 pre-implementation feedback log. Collecting all issues before batching fixes.

**Status:** COMPLETE — 30 items collected, ready for implementation planning

---

## P1 — Broken / blocks users

### 4. Undopl overlay broken
- Overlapping elements, layout mess
- "Keep dopling" button doesn't work (handler broken or z-index blocks clicks)
- Needs full redesign of the confirmation overlay

---

## P2 — Bad UX / feels wrong

### 1. Slide-to-Dopl needs more polish
- Currently functional but feels snappy, not smooth
- Needs: better spring physics, momentum feel, parallax fill effect, smoother visual feedback timing
- Research: study high-quality slider implementations for reference

### 2. Stripe checkout transition
- Redirect feels jarring — sudden page leave
- Fix: branded full-screen loading overlay ("connecting to Stripe...") after slider completes, before browser navigates away
- Keep hosted checkout (Connect Express requirement) — this is cosmetic only

### 3. Auto-rebalance positions to 100%
- Currently requires FM to manually click a rebalance button
- Fix: auto-recalculate all `allocation_pct` as `market_value / total_market_value * 100` whenever a position is added or removed
- Server-side, same DB transaction as position insert
- No manual button needed — allocations always reflect actual market value proportions

---

## P3 — New features / nice-to-have

### 5. Forgot password / reset password
- No forgot-password flow currently exists
- Add: link on login page → Supabase `resetPasswordForEmail()` → email → `/reset-password` page with `updateUser()`
- Part of broader auth flow upgrade

---

## Homepage (landing page, pre-login)

### 6. Hero section — strip subtext, redesign buttons
- Remove the long subtext ("connect your broker. create portfolio tiers...") — it repeats what "How It Works" explains
- Keep only: heading + tagline
- "See Fund Managers" button looks like a plain text link — needs to feel clickable
- Both buttons: Title Case text, gradient border+body (match glass-card style), not monochromatic
- Both buttons should feel equally interactive and inviting

### 7. How It Works section — more visual distinction
- Section looks plain and flat, needs clear visual separation from hero
- "How It Works" heading: Title Case
- Cards: add gradient border+body treatment (same as other glass cards in the app)
- Cards should feel interactive / elevated, not static slabs

### 8. CTA section + math card — trim copy
- Math card itself is good and interactive — keep as-is
- Remove the long subtext below math card ("from the audience you already have...")
- "stop giving away your best trades for free" section: subtext is too long, trim it
- "Launch Your Fund" repeat CTA is fine

### 9. Footer — professional revamp
- Current footer is bare ("dopl" + "infrastructure for fund managers") — looks dead
- Reference: Wispr Flow footer style — large logo, copyright line, clean layout
- dopl version: prominent dopl logo, copyright year, Terms/Privacy links if available
- Don't need full link columns (we don't have that many pages), but make it look polished

---

## Signup / Login

### 10. Signup page — capitalization + bottom link visibility
- Text capitalization: Title Case for headings/buttons across all auth pages
- "already have an account? log in" text is too dim — make brighter/more legible
- Add all standard auth edge cases (validation errors, duplicate email, weak password, etc.)
- Forgot password link (see item #5)

---

## FM Onboarding Flow

### 11. Profile step — remove subtext
- Remove "display name + handle are required. bio + avatar can come later from profile settings."
- This is intuitive — the required fields are already marked, no need to explain

### 12. Region step — remove subtext + improve clarity
- Remove "we route you to the right broker network for your region."
- FM may feel confused if their country isn't listed — add a short reassurance (e.g. tooltip or helper text explaining regions are broker-network groupings, not a restriction)
- Make the value of broker connection clearer: auto-sync vs. manual entry tradeoff
- **Open question (resolved):** Broker connection IS needed — provides auto-sync + "broker-verified" credibility signal. Manual entry is the fallback. Make this distinction clearer on the page.

### 13. Portfolio step — default name, price layout, notice trim
- Don't default portfolio name to "Main Portfolio" — use it as placeholder text only, leave input empty
- Price input: make the field shorter, /mo text feels awkwardly far from the dollar amount
- Bottom notice ("paid tier — will go live once you finish stripe...") — shorten
- Text capitalization

### 14. Stripe step — alignment polish
- Button and text alignment needs visual tightening
- No functional changes, layout-only

---

## Global (applies across all pages)

### 15. Text capitalization
- Title Case for all headings, button labels, and section titles across the app
- Currently inconsistent — some lowercase, some capitalized

---

## FM Dashboard

### 16. Overview — stat card artifacts + empty state
- Bottom stat cards (Doplers / MRR / Portfolios) have weird decorative lines/artifacts on top — visual bug, remove or fix
- Card entrance animations need polish
- After completing all setup steps, the overview looks empty — needs a better "all set, here's your dashboard" state

### 17. Share page — strip subtext from actions
- Remove subtext from all action buttons: "copy link", "download PNG", "share on X" — just the action label is enough
- For download PNG: only show download size, not the description
- Remove the bottom description ("the downloaded PNG is 1200x630 — perfect for X, LinkedIn...")
- Remove heading subtext too
- Share card float animation (slow up/down bob) — verify if intentional, keep if subtle

### 18. Profile page — bland sections + links UX
- Sections look monochromatic and plain — add gradient treatment matching rest of app
- Links section: should have built-in platform options (X, Instagram, YouTube, etc.) where FM just types their handle, not full URLs
- The current dropdown + "https://" input is clunky — FM remembers their handle, not their full profile URL

### 19. Broker page — layout + "not listed" flow
- Three broker cards are side-by-side — should stack vertically even on desktop, feels dense
- "My broker isn't listed" → /dashboard/connect page looks weird
- That page shows manual position adding, which is redundant — positions should be added within portfolios instead
- Consider: simplify the "not listed" path or merge it with the portfolio position management

### 20. Broker connected state — change provider vs disconnect bug
- "Change provider" and "Disconnect broker" show the EXACT same popup (both show "disconnect broker?") — bug, should be different flows
- Disconnect modal has a weird icon in top-left corner — remove or fix
- "Keep connected" button should be green/contrasting (not plain) to complement the red "disconnect" button
- **Global pattern:** wherever a red destructive button appears, the safe/cancel option should be a complementary green

### 21. Portfolios — need edit portfolio details
- No way to edit portfolio name/details after creation — FM named a portfolio "." and can't fix it
- Add edit functionality for portfolio name, description, tier, price
- This is a frustration point — FM feels stuck

### 22. Positions page — unassigned confusing + cards too plain
- "Unassigned" block is confusing — unclear what use case it serves
- Assigned position cards are too grim/plain — should show real-time prices, number of shares, market value to feel lively
- Currently just ticker + name text, no data richness

### 23. Doplers page — minor text brightness
- Text could be slightly brighter/more highlighted
- Otherwise functional and good

### 24. Billing page — Stripe overlay
- Page looks fine when connected (MRR / doplers / your cut cards + "payments active" state)
- Needs the branded Stripe loading overlay (already covered in item #2)

### 25. Broker "not listed" → manual entry page is redundant
- /dashboard/connect page shows a manual "add positions" form (ticker / shares / entry $)
- This is redundant — positions are already manageable from within portfolios
- This page shouldn't exist as a standalone, or should redirect to the positions/portfolio flow instead

### 26. Destructive action button pattern (global)
- Wherever a red/destructive button appears (disconnect, cancel, delete), the safe/cancel option should be a contrasting green — not plain/ghost
- Currently "keep connected" is plain gray next to red "disconnect" — doesn't guide the user toward the safe choice
- Apply consistently across all confirmation modals

### 27. FM dashboard pages — monochromatic / bland feel (global)
- Recurring theme across overview, profile, positions, broker pages: plain green cards, no visual richness
- Apply the same gradient border+body, interactive hover states, and visual depth used on the homepage and tier cards
- Dashboard should feel as polished as the public-facing pages, not like an admin panel

---

## Dopler Side

### 28. Dopler onboarding — remove region step + expand broker list
- Doplers are still asked "where do you trade?" with region cards
- Region selection doesn't change anything — same 8 brokers shown regardless of region
- Doplers don't connect brokers (removed Sprint 8), so region serves no purpose for doplers
- **Recommendation:** Remove region step from dopler onboarding entirely. One fewer step, no information loss.
- **Broker dropdown (FM side):** Currently only shows 8 brokers regardless of region — should show ALL available brokers from SnapTrade/Salt Edge, not a hardcoded subset. If region is kept for FMs, filter the list by region; otherwise show the full list in the dropdown.

### 29. Discover page — remove leaderboard, show FM cards instead
- Current leaderboard sorts FMs by number of doplers — bad signal, penalizes new FMs
- Every FM has their own strategy and audience — ranking by doplers is misleading
- Instead: show individual FM cards (not ranked) with stats visible (portfolios, doplers, etc.)
- No sorting/leaderboard — just a browsable gallery of fund managers

### 30. Feed page undopl overlay — broken (same as #4)
- Undopl modal on feed page is chopped/cut off, overlapping content
- "Keep dopling" and "undopl" buttons don't work
- Looks terrible especially when portfolio has no positions
- Same root issue as item #4 — fix covers both profile and feed page undopl flows

---

## Summary

**30 items total:**
- P1 broken: #4, #20 (change-provider bug), #30
- P2 bad UX: #1, #2, #3, #6–9, #16–19, #21–22, #25, #27–29
- P3 new features: #5
- Polish/copy: #10–15, #23–24, #26

