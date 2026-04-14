# CLAUDE.md — dopl Phase 0 Build Instructions

## What this is
dopl is a portfolio transparency platform for fund managers. Fund managers connect their brokerage via SnapTrade, create subscription tiers, and their followers pay to see the live portfolio. When positions change, subscribers get notified.

## Tech Stack
- Next.js 14 (App Router, TypeScript)
- Supabase (auth, database, real-time)
- Stripe Connect (payments, 10% platform fee)
- SnapTrade API (read-only broker connections)
- Tailwind CSS + Framer Motion (UI)
- Vercel (deployment)

## Brand
- dopl is always lowercase
- Colors: deep green #0D261F, sage #2D4A3E, lime #C5D634, cream #F3EFE8
- Fonts: Fraunces (headings), Inter (body), JetBrains Mono (numbers/data)
- Aesthetic: dark finance meets glassmorphism

## Revenue Model
- dopl takes 10% of every subscription via Stripe Connect application_fee_percent
- Fund manager sets their own price
- User pays the fund manager price. dopl fee is invisible, taken from FM cut.

## Terminology
- ALWAYS: fund manager, strategist, portfolio, infrastructure
- NEVER: creator, SaaS, copy trading, robo-advisor

## Database
See supabase/schema.sql for full schema.

## SnapTrade Integration
- Free tier: 5 connections. Pay as you go: $2/connected user/month.
- Webull confirmed supported (Yazan is test case)
- Read-only: positions, balances, holdings
- OAuth flow via SnapTrade Connect widget

## Stripe Connect
- Express accounts for fund managers
- application_fee_percent: 10 on every subscription
- Checkout Sessions for subscriber payments

## Design
- Dark theme (bg: #0D261F)
- Glassmorphism cards (backdrop-blur, semi-transparent)
- Lime #C5D634 for CTAs
- JetBrains Mono for numbers
- Framer Motion animations
- Screenshot-worthy UI that fund managers want to share
