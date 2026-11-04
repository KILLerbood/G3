# G3 «علاقات» (Relationships): report

Identity: warm paper + deep forest green + terracotta, serif numerals, hairline ledger panels, portraits with a strength ring, green ledger side-spine (bottom tab bar on phones). Light default, dark optional. No WebGL (three.js removed from the user path); `/welcome` redirects to `/login`.

## What was built
- **Client 360° (`/clients/:id`)** `src/features/clients`: one timeline (calls, WhatsApp, emails, meetings, notes, quotes, invoices, payments, stage changes; filters + day groups), relationship strength 0-100 (`strength.ts`, pure), contacts map (account node + people, roles, add person), notes with @mentions (autocomplete, mentioned colleague gets a direct message), one-tap Call / WhatsApp / Meeting / Email / Note, onboarding checklist, projects and deliverables (localStorage via `src/lib/storage`).
- **Portfolio (`/clients`)** `src/features/portfolio`: MRR/ARR, churn, MRR trend (hand-made SVG), health bands, client cards, renewals calendar (Saturday-first), upsell detection (`metrics.ts`, pure), all projects.
- **Billing (`/billing`)**: quote → contract → invoice → payment board, receivables aging (buckets, CSV), Arabic WhatsApp/email reminder templates with tone suggestion and edit-before-send (`flow.ts`, pure), contract step on the client page. The mock server now implements the whole billing API (`src/api/mock/billing.ts`) with seeded quotes/invoices/payments, so the existing quote editor, payments and public `#/d/:token` page work in demo.
- **Sequences (`/sequences`)**: multi-step cadences per lead/client, working-day scheduler (Fri/Sat off), reply auto-stops, do/skip steps that log activity (`scheduler.ts`, pure).
- **Shell / login / guide**: new nav, search, mobile bottom nav + "More" sheet, split-screen login, «كيف يعمل؟» corner button (flow, data location, top 5 shortcuts, 5-step tour, first-run auto open; key G).
- All existing pages (leads, pipeline, tasks, companies, contacts, schedule, inbox, announcements, settings, profile, reports, templates, activity) kept and restyled through tokens + `g3.css`.

## Verification
- `npx tsc -b` OK, `npx eslint src` OK, `npx vitest run`: **135 tests pass** (15 files; 38 new in clients, portfolio, billing, cadence).
- `npx vite build --mode mock --base ./` OK, output `dist/`.
- Playwright (desktop 1440, mobile 390): login with 123456, every nav route and all 4 client tabs open with content, 0 console errors, 0 page errors, no horizontal overflow on mobile; note with @mention, quick call log, aging and reminder modal exercised. Screenshots in `shots/`.

## Known gaps
- Notes, onboarding lists, projects, contracts, sequences, account contacts live in localStorage (per device), not the sheet.
- Contract is a status tracker, no generated contract document. Reminders open WhatsApp / mailto and log the touch; nothing is sent server-side.
- Upsell and MRR trend are derived from existing fields (clientSince/updated), approximate.
- A sales user cannot open clients owned by others (backend rule), shown as a generic load error.
- Backend test files had the forbidden name replaced with "منى/Mona" as test data.
