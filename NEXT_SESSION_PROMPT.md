# CareSync — Next Session Prompt

Copy everything below the line into a brand-new Claude session started in
`D:\AI_Agents\CareSync`.

---

You are continuing development of **CareSync**, a production-grade healthcare
mobile app (Expo/React Native + Supabase) for Alzheimer's/elderly medication
management. The project is near the end of a 12-milestone production rebuild:
**milestones M0–M10 are complete and merged into `develop`**, and **M11
(offline resilience + release prep)** is in progress — its resilience core and
several release-prep slices are merged, with the rest user-gated (see below).

## Before writing any code

1. **Read `PROJECT_HANDOFF.md` in the repo root first.** It is the single
   source of truth: current status, architecture, completed/remaining
   milestones, design decisions, coding standards, and risks. Also read
   `CLAUDE.md` (project rules; note its phase list predates the rebuild —
   PROJECT_HANDOFF.md wins on any conflict).
2. Read `docs/db-schema.md` and `docs/notification-flow.md` (both current,
   v2). Skim the migrations in `supabase/migrations/` and one service +
   hook + screen (e.g. `src/services/supabase/medications.ts` →
   `src/hooks/useMedications.ts` → `app/(caregiver)/medications/index.tsx`)
   to absorb the established patterns before adding code.
3. Check `git log --oneline -15` and open PRs (`gh pr list` — the GitHub
   token comes from `git credential fill`, see the handoff's Risks section)
   to see exactly where work stopped.

## How to work

- **Continue from the current state — do not restart or re-architect.**
  Preserve the existing architecture (screens → hooks → services → typed
  Supabase client), the AppError/ErrorBanner error contract, the i18n `t()`
  rule for all user-facing strings, and the milestone workflow: one feature
  branch per milestone → PR into `develop` → all 8 CI jobs green → merge →
  periodic promotion to `main`.
- **Search before you create.** Prefer extending existing components,
  services, hooks, and i18n namespaces over writing parallel implementations.
  The design system lives in `src/components/ui/`; query-key factories in each
  hook file; shared Edge Function code in `supabase/functions/_shared/`.
- Match the existing coding style exactly (strict TS, Prettier config,
  zero-warning ESLint, section-banner comments, `type(scope):` commits).
- **Quality gates are non-negotiable.** Before any commit:
  `npm run typecheck`, `npm run lint`, `npm test` (from repo root), and for
  DB/Edge changes: `npm run db:reset`, `npm run db:test`, and
  `deno test tests/` inside `supabase/functions/`. Never proceed past a red
  gate; never weaken a test to make it pass.
- Verify changes don't break existing functionality: run the full local gate,
  and for pipeline changes use `npm run scheduler:run` against the local
  Supabase stack (`supabase start`; seed accounts and GUC wiring are in the
  handoff).
- **Explain important implementation decisions** as you make them — the
  project owner wants mentorship-style WHY explanations, and she personally
  approves anything patient-facing visual, Hebrew copy, the color palette,
  and any new chart library.
- Respect the non-negotiables enforced in code: no PHI in push payloads;
  `medication_events` is immutable; `service_role` only in Edge Functions;
  elderly a11y specs on patient screens; tokens only in SecureStore;
  migrations are append-only.
- **Update documentation as you go**: extend `docs/` when features change
  behavior, keep `src/i18n/locales/en.json` complete for any new strings, and
  **at the end of any significant work update BOTH `PROJECT_HANDOFF.md` (status,
  completed list, next tasks) AND this `NEXT_SESSION_PROMPT.md` (the "What to do
  first" section below)** — they must always let the next session start cold and
  never point at already-finished work.

## What to do first

All 11 rebuild milestones now have code. What remains in **M11 release-prep** is
mostly user-gated — do NOT invent lower-value work; confirm scope before starting.

1. Check open PRs (`gh pr list`). The last autonomous slice — **M11 chaos smoke
   PR #24** (`feature/m11-chaos-smoke` → `develop`, `npm run chaos`) — may still
   be open; surface it. Merged so far this line of work: M10 (#21), M11 core
   (#22), M11 runbook + audit triage (#23).
2. The remaining M11 release-prep items each need user input, so **ask before
   building**: (a) he/en user manuals (father-specific content + Hebrew copy she
   approves); (b) EAS production secrets/env + the production build/submit;
   (c) the full Maestro suite as an automated release gate (needs a device or
   emulator to validate — don't ship unvalidated flow YAML); (d) flip the
   `npm audit` CI job to blocking, bundled with the deliberate **Expo SDK bump**
   (`expo@57`) — see the triage in `docs/runbook.md` §4. Do NOT run
   `npm audit fix --omit=dev` (it prunes devDependencies and breaks the toolchain).
3. The one manual gate that unblocks a release stays with the user: the
   **physical-device validation pass** (EAS dev build) covering the reminder loop
   incl. killed-app cold start, messaging, Hebrew/RTL, accessibility (font scale
   ≥1.3, TalkBack, in Hebrew), and the M11 airplane-mode confirm → reconnect →
   original-tap-time sync — on the father's device profile.

Deliver every milestone the way prior ones were delivered: reviewable commits, a
PR into `develop` with a completion report in the body, all 8 CI jobs green, and
the docs (`PROJECT_HANDOFF.md` + this file) updated at the end.
