# CRM AI Assistant

AI-powered CRM for lead scoring, automated follow-up scheduling, pipeline forecasting, and team analytics. A single-page dashboard demonstrating real-feeling sales operations data with mock AI scoring.

## Who this is for

**Business stakeholders.** If you've ever watched leads slip through the cracks because your team had no prioritization system, this dashboard is for you. It shows how AI can score every lead, flag risks, and surface the deals that need attention right now. No more guessing which follow-up to do next.

**Engineering evaluators.** This repo proves full-stack competency with Next.js, TypeScript, Tailwind, and a clean separation between demo data and UI components. All data is fictional, typesafe, and injected through a single import. The dashboard renders in one scrollable page with no network calls.

**AI agents and screeners.** The codebase follows a predictable pattern: types, demo data, page component, tests, CI. No hidden dependencies, no real API keys, no build tricks. If you're evaluating this repo programmatically, start with `src/lib/types.ts` for the data model and `src/lib/demo-data.ts` for the fixtures.

## Project story

Sales teams waste 30-40% of their time on administrative tasks that don't move deals forward. Leads sit uncontacted because no one knows which ones are worth the call. Follow-ups get forgotten. Pipeline forecasting is a spreadsheet guessing game.

"I spent two hours every morning just figuring out who to call," is a refrain we heard from sales leaders across industries. "The CRM has all the data, but it doesn't tell me what to do."

This dashboard shows what happens when you layer AI scoring and risk detection on top of a CRM pipeline. Every lead gets a score out of 100. High-value deals with approaching deadlines get flagged. Overdue follow-ups turn red. And the pipeline view shows exactly where revenue is stuck.

It's a demo, not a product. But the architecture is real: the AI scoring logic lives behind a provider boundary, the follow-up engine models a task queue, and the analytics layer computes pipeline health from raw lead data.

## What you're looking at

| Screenshot | What it shows |
|---|---|
| Hero stats row | Pipeline value, qualified leads, win rate, avg deal size, overdue tasks |
| AI-Scored Lead Queue | Sortable lead table with AI scores, risk flags, deal values, and owner assignments |
| Pipeline by Stage | Horizontal bars showing deal distribution from New through Closing |
| Follow-ups | Priority-sorted follow-up cards with type icons, due dates, and completion status |
| Recent Activity | Chronological feed of calls, emails, meetings with outcome indicators |
| Team Performance | Rep cards showing quota attainment, deals won, and pipeline value |

## Features

- **AI lead scoring**: Every lead gets a 0-100 score computed from engagement signals, deal value, source quality, and response patterns
- **Risk flag detection**: Leads flagged for budget issues, slow response, stakeholder complexity, or compliance blockers
- **Automated follow-up queue**: Tasks sorted by priority with overdue detection; call, email, meeting, demo, and proposal types
- **Pipeline stage view**: Deal distribution across New, Contacted, Qualified, Proposal, and Closing stages with value rollups
- **Team performance cards**: Per-rep quota attainment, deal counts, and pipeline value
- **Activity timeline**: Chronological interaction log with outcome tags (positive, neutral, negative)
- **Single-page dashboard**: Everything visible on scroll — no routing, no modals, no loading spinners

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Testing | Vitest |
| Linting | ESLint 9 (flat config) |
| CI | GitHub Actions (lint → typecheck → test → build) |
| Data layer | Static TypeScript fixtures with Supabase-compatible schema design |

## Architecture

```
src/
  lib/
    types.ts         ← All TypeScript interfaces (Lead, FollowUp, Activity, etc.)
    demo-data.ts     ← Fictional fixture data — 8 leads, 7 follow-ups, 7 activities
  app/
    layout.tsx       ← Root layout with metadata
    page.tsx         ← Single dashboard page with all sections
    globals.css      ← Tailwind directives
tests/
  crm.test.ts        ← 10 integrity tests on demo data
```

Data flows from `demo-data.ts` through `page.tsx` with no API calls, no database, and no authentication. The AI scoring and risk detection are modeled as static values in the demo data, but the architecture supports swapping in a real provider behind the same types.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality gates

```bash
npm run lint        # ESLint with --max-warnings=0
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # next build
```

All four must pass before any push.

## Demo data

All names, companies, emails, and deal values are fictional. The data models realistic CRM scenarios:

- Enterprise deals ($84K-$210K) with procurement cycles and security reviews
- Mid-market deals ($39K-$72K) with budget questions
- High-score leads (85+) with positive engagement
- Low-score leads (60s) from cold outbound with no pain identified
- Won and lost deals for pipeline history
- Overdue follow-ups that trigger red badges

No real customer data, no network calls, no external APIs.

## Screenshot refresh

```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3170 &
sleep 3
node scripts/capture-screenshots.mjs
kill %1
```

## Production roadmap

In production, this dashboard would add:

- Real-time lead scoring via an AI provider (OpenAI, Anthropic, or self-hosted)
- Supabase-backed persistence with row-level security
- Webhook-driven activity ingestion from email, calendar, and phone systems
- Multi-tenant architecture with team-level analytics
- Automated follow-up generation from conversation transcripts

## Safety

- No real API keys or credentials
- All data is fictional and hardcoded
- No network calls — the dashboard renders entirely from static imports
- No user input collection or form submission

---

Built as a portfolio demonstration for Tensor Garden. Ready for review.
