# CareSync — Next Session Prompt

Copy everything below the line into a brand-new Claude session started in
`D:\AI_Agents\CareSync`.

---

You are continuing development of **CareSync**, a production-grade healthcare
mobile app (Expo/React Native + Supabase) for Alzheimer's/elderly medication
management. The project is mid-way through a 12-milestone production rebuild;
milestones M0–M4 are complete and merged.

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
  **update `PROJECT_HANDOFF.md` (status, completed list, next tasks) at the
  end of any significant work** — it must always let the next session start
  cold.

## What to do first

1. If PR #16 (M7) or the M6 PR (`feature/m6-hebrew-rtl`, stacked on the M7
   branch) is still open, surface them to the user: merge order is #16
   first, then M6 — and she must review every Hebrew string in
   `src/i18n/locales/he.json` before the M6 merge. Also still pending on
   the user: M5 physical-device validation (EAS dev build including M7's
   AuthGuard fix; cron → push → tap → confirm → caregiver update incl.
   killed-app cold start; father's device profile: font scale ≥1.3,
   TalkBack; Hebrew/RTL spot-check via Settings).
2. Once M5–M7 are merged and validated, the next code milestone is
   **M8+M9 — urgent patient↔caregiver messaging** per the roadmap in
   PROJECT_HANDOFF.md (verify postgres_changes delivery WITH RLS early).

Deliver every milestone the way prior ones were delivered: reviewable
commits, a PR into `develop` with a completion report in the body, all gates
green.
