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
3. Establish a focused baseline when executable code exists. Codex runs this
   baseline; do not spend an Antigravity turn on it. Record failures that
   predate the task separately from failures caused by the change.
4. Make a compact plan containing `OBJECTIVE`, `SCOPE`, `NON_GOALS`,
   `INVARIANTS`, `LIKELY_FILES`, `ACCEPTANCE_CRITERIA`, and
   `CODEX_VERIFICATION_COMMANDS`. For `PHASE`, also define dependency-ordered
   `EXECUTION_SLICES`; keep the phase scope intact but do not ask Flash to
   implement the entire phase in one invocation.
   When the slice requires new files and their paths are already determined,
   create their parent directories and minimal valid placeholders with
   `apply_patch` before delegation. Do not create speculative placeholders.
5. For `DELEGATE` or `PHASE`, read
   [references/delegation-playbook.md](references/delegation-playbook.md), create
   a repository-specific task packet under `.ai-work/`, and invoke the bundled
   runner. Require the exact model `gemini-3.7-flash-high`; do not substitute.
6. After each Antigravity slice, inspect its actual changed files and diff. Read
   [references/review-gates.md](references/review-gates.md) and apply only the
   gates relevant to that slice. Update the compact phase checkpoint before
   moving to the next slice.
7. Run focused verification independently after each slice. For `PHASE`, defer
   the complete repository quality gate and runtime smoke test until all slices,
   reviews, and focused checks are stable. Run one successful final full gate;
   if it fails, diagnose and repair with focused checks before rerunning it.
8. If a concrete product defect remains, send one narrow repair prompt through
   the same runner. Review the repair delta. Do not retry or resume a session
   that failed on permissions; Codex completes verification itself. Report any
   unresolved blocker rather than looping indefinitely.
9. Use browser or Computer Use QA only after the implementation is stable and
   only when user-visible behavior changed. Prefer deterministic shell checks.
10. Report the implementation, review findings, repairs, verification, remaining
    risks, and recommended next step. Do not continue into another phase.

## Token discipline

- Reference repository paths instead of pasting whole requirements or source
  files into prompts.
- For a large phase, keep one stable phase contract and send Flash a sequence of
  coherent, dependency-ordered slice packets. Split by behavior and integration
  boundary, not an arbitrary line or file quota. Each slice must fit one runner
  invocation and leave a reviewable repository state.
- Default to implementation-only delegation: Antigravity reads and writes
  repository files but does not run shell commands, tests, lint, builds, Git,
  Docker, or package-manager commands. Codex runs the smallest relevant focused
  verification after reviewing each slice.
- Review `git diff --stat`, changed paths, and affected contracts before opening
  broader code.
- Do not run the full suite as a baseline or inside a repair loop. Run it only
  as the final phase gate after focused checks pass.
- Require a compact structured handoff. Do not request narrative progress logs.
- Limit the handoff to `FILES_CHANGED`, `CHANGE_SUMMARY`, and `KNOWN_RISKS`:
  paths only, at most five summary bullets, and at most three risks. Antigravity
  does not repeat tests or diff narration because Codex verifies both directly.
- Reuse the original task packet for repairs and add only the concrete finding.
- Keep `.ai-work/current-phase.md` as the concise restart checkpoint for an
  active phase. Store verified facts, slice status, changed paths, commands and
  unresolved risks; never copy chat history, source files, or raw logs into it.
- Keep tool output narrow: report command, result, and the first actionable
  failure. On runner failure, read `.ai-work/agy-error-summary.txt` first. Never
  read `agy-run.log` in full; use at most its final 80 lines only when the compact
  summary does not identify the layer. During silent CLI waits, send only a
  minimal elapsed-time/status heartbeat.
- Use at most one CLI continuation, and only for a transient interrupted stream.
  Never continue after a permission denial because a resumed conversation can
  retain stale permission state.

## Boundaries

- The repository and user-provided requirements are the source of truth.
- Antigravity may edit and test but may not commit, push, release, deploy, add
  unrelated dependencies, or broaden the requested scope.
- Never pass `--dangerously-skip-permissions` to `agy`.
- Keep CLI file access repository-scoped. Do not grant the CLI access to the
  Windows user profile to recover from a relative-path or discovery fallback;
  the bundled runner enforces absolute paths under `D:/QuanLyKhuPho`.
- Do not claim success from Antigravity's report. Codex owns final acceptance.
- If the exact model, authentication, quota, or runner is unavailable, identify
  that layer and stop; do not silently fall back to another model.
- Prefer the CLI. Use the lightweight Antigravity desktop task/chat surface only
  for exceptional interactive authentication, model, quota, or project-grant
  recovery. Use the full IDE editor only if the lightweight surface cannot
  resolve that interaction. Return to shell diff review immediately afterward.
