---
name: khu-pho-antigravity-orchestrator
description: Plan, delegate, review, and verify substantial QuanLyKhuPho feature or phase work with Antigravity Gemini 3.7 Flash High. Use for cross-file implementation and architecture-sensitive changes; handle read-only questions and tiny surgical edits directly.
---

# Khu Pho Antigravity Orchestrator

Act as the technical architect and final quality gate for QuanLyKhuPho. Codex
owns scope, planning, review, and acceptance. Delegate the bulk of substantial
implementation to Antigravity Gemini 3.7 Flash High, then verify the repository
instead of trusting the handoff summary.

## Triage

- `DIRECT`: answer read-only questions and perform tiny, low-risk edits when
  delegation overhead exceeds the work.
- `DELEGATE`: use Antigravity for a feature that spans files, layers, contracts,
  database behavior, or non-trivial UI state.
- `PHASE`: use Antigravity for a sprint or phase, then run the repository's full
  quality gate and meaningful runtime checks.

Announce the selected mode. Never delegate automatically merely because the
skill is active.

## Required workflow

1. Read the nearest `AGENTS.md`. Inspect repository manifests, relevant design
   or requirements files, affected code and tests, `git status`, and the current
   diff. Preserve unrelated or pre-existing changes.
2. Discover commands from repository manifests and CI configuration. Do not
   invent lint, test, build, migration, or development commands.
3. Establish a focused baseline when executable code exists. Record failures
   that predate the task separately from failures caused by the change.
4. Make a compact plan containing `OBJECTIVE`, `SCOPE`, `NON_GOALS`,
   `INVARIANTS`, `LIKELY_FILES`, `ACCEPTANCE_CRITERIA`, and `TEST_COMMANDS`.
5. For `DELEGATE` or `PHASE`, read
   [references/delegation-playbook.md](references/delegation-playbook.md), create
   a repository-specific task packet under `.ai-work/`, and invoke the bundled
   runner. Require the exact model `gemini-3.7-flash-high`; do not substitute.
6. After Antigravity finishes, inspect the actual changed files and diff. Read
   [references/review-gates.md](references/review-gates.md) and apply only the
   gates relevant to the changed area.
7. Run focused verification independently. For `PHASE`, also run the complete
   repository quality gate and a runtime smoke test when the application can run.
8. If a concrete defect remains, send a narrow repair prompt through the same
   runner. Review the repair delta. Stop after two repair delegations and report
   the unresolved blocker rather than looping indefinitely.
9. Use browser or Computer Use QA only after the implementation is stable and
   only when user-visible behavior changed. Prefer deterministic shell checks.
10. Report the implementation, review findings, repairs, verification, remaining
    risks, and recommended next step. Do not continue into another phase.

## Token discipline

- Reference repository paths instead of pasting whole requirements or source
  files into prompts.
- Let Antigravity read the repository and run its focused checks.
- Review `git diff --stat`, changed paths, and affected contracts before opening
  broader code.
- Run full suites at phase boundaries; use focused checks for ordinary features.
- Require a compact structured handoff. Do not request narrative progress logs.
- Reuse the original task packet for repairs and add only the concrete finding.

## Boundaries

- The repository and user-provided requirements are the source of truth.
- Antigravity may edit and test but may not commit, push, release, deploy, add
  unrelated dependencies, or broaden the requested scope.
- Never pass `--dangerously-skip-permissions` to `agy`.
- Do not claim success from Antigravity's report. Codex owns final acceptance.
- If the exact model, authentication, quota, or runner is unavailable, identify
  that layer and stop; do not silently fall back to another model.
