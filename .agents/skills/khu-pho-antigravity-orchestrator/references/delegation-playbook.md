# Antigravity delegation playbook

Read this file only for `DELEGATE` or `PHASE` work.

## Prepare the task packet

For `DELEGATE`, create `.ai-work/current-task.md` with the structure below.

For `PHASE`, first create `.ai-work/phase-contract.md` containing the stable
phase-level `OBJECTIVE`, `SCOPE`, `NON_GOALS`, `INVARIANTS`, final
`ACCEPTANCE_CRITERIA`, final `CODEX_VERIFICATION_COMMANDS`, and an ordered
`EXECUTION_SLICES` list. Preserve the user's complete phase scope, but divide
execution into coherent slices based on dependencies and integration boundaries.
Do not give Flash the whole phase in one invocation.

Create `.ai-work/current-phase.md` as a compact restart checkpoint. Keep only:

```text
PHASE
Current phase and source requirement paths.

VERIFIED_BASELINE
Commands and concise results established by Codex.

SLICE_STATUS
Pending, active, completed, and blocked slice identifiers.

CHANGED_PATHS
Paths changed so far, grouped by slice.

VERIFICATION
Focused checks already passed and the still-pending final gate.

OPEN_FINDINGS
Concrete unresolved defects or risks only.

NEXT_ACTION
One precise next action.
```

Update this checkpoint after every reviewed slice. It replaces replaying chat
history when a task is compacted or a later Codex task continues the phase.

For each phase slice, create `.ai-work/current-slice.md` using the packet
structure below. Reference `.ai-work/phase-contract.md`, then include only that
slice's outcome, dependencies, affected behavior, likely integration points,
focused acceptance criteria, and focused verification commands. A slice must be
small and cohesive enough to finish in one runner invocation, but do not use a
rigid file-count or line-count quota.

Keep each task or slice packet concise and use this structure:

```text
OBJECTIVE
One verifiable outcome.

SCOPE
Included behavior and affected layer.

NON_GOALS
Explicitly deferred work.

VERIFIED_CURRENT_STATE
Facts confirmed from the repository, with paths.

INVARIANTS
Architecture, authorization, security, data, and compatibility rules.

LIKELY_INTEGRATION_POINTS
Likely files or modules without prescribing a broad rewrite.

PRECREATED_TARGETS
New files whose exact paths Codex has already created with minimal valid
placeholders. Omit this section when the slice changes only existing files.

ACCEPTANCE_CRITERIA
Observable conditions that must pass.

CODEX_VERIFICATION_COMMANDS
Exact commands discovered from manifests or CI. These are for Codex after the
handoff, not for Antigravity's default implementation-only run. For a phase
slice, include only focused checks; keep the full quality gate in the phase
contract.

IMPLEMENTATION_INSTRUCTIONS
Implement using repository read/write tools only. Do not run shell commands,
tests, lint, builds, Git, Docker, or package-manager commands. Inspect the files
you changed and repair obvious problems. Do not commit, push, deploy, add
unrelated dependencies, or continue into later work. Codex will verify.
Every path in PRECREATED_TARGETS already exists. Edit it with repository file
tools; never use RunCommand, a terminal, node -e, PowerShell, cmd, or shell file
creation. If another new path is genuinely required, report it as a risk instead
of creating it through a command.

REQUIRED_HANDOFF
Return exactly these headings with no preamble and at most 350 words total:
FILES_CHANGED
Paths only.
CHANGE_SUMMARY
At most five bullets.
KNOWN_RISKS
At most three bullets, or `None`.
```

Reference requirements and code by path. Include only the snippets needed to
disambiguate a contract; do not paste entire documents or files.

Before invoking the runner, Codex creates every determined new target in
`PRECREATED_TARGETS` with `apply_patch`. This is a small placeholder, not a
partial implementation. Existing directories and files are left untouched.

## Invoke Antigravity

Before the first delegated run on a machine, preview and then apply the narrow
repository permissions. The setup backs up the existing Antigravity settings
before merging rules; it does not enable a global permission bypass.

```powershell
.\.agents\skills\khu-pho-antigravity-orchestrator\scripts\setup-agy-automation.ps1
.\.agents\skills\khu-pho-antigravity-orchestrator\scripts\setup-agy-automation.ps1 -Apply
```

From the repository root:

```powershell
.\.agents\skills\khu-pho-antigravity-orchestrator\scripts\invoke-antigravity.ps1 `
  -PromptPath .\.ai-work\current-task.md
```

For a phase slice, pass `.\.ai-work\current-slice.md` instead. Complete this
review-and-verify cycle before invoking the next slice:

1. inspect `git diff --stat`, the slice's changed paths, and affected contracts;
2. repair obvious Codex-review findings or send the one allowed narrow repair;
3. run the smallest relevant lint, type, and test commands;
4. update `.ai-work/current-phase.md`; and
5. continue only when the slice leaves a stable base for its dependents.

After the final slice, review the combined phase diff and run the complete
quality gate once. If that gate fails, return to targeted diagnosis and focused
checks; rerun the complete gate only after those checks pass.

The runner pins `gemini-3.7-flash-high`, `accept-edits`, high effort, JSON outer
output, and an eight-minute default timeout. It adds the implementation-only
constraint, validates the three compact handoff sections, then writes
`.ai-work/last-handoff.md`.

Keep the eight-minute default for `DELEGATE` and `PHASE` runs. Lower it only for
an intentional diagnostic time box, not for substantial implementation. The
runner reports timeout separately and treats only explicit denial markers as a
permission failure; ordinary product text such as a `permission-denied` UI state
must not trigger permission recovery.

The runner also adds the repository root explicitly and injects a filesystem
boundary into every prompt. Antigravity must use absolute paths beneath
`D:/QuanLyKhuPho` for reads, writes, listings, globs, and searches. It must not
fall back to `.`, `~`, a drive root, or the Windows user profile when discovery
times out. Do not solve a misdirected path request by granting access to the
user profile; correct the path or stop the run.

Use `-AllowChecks` only when Antigravity truly needs to execute the packet's
verification commands and a fresh CLI permission smoke test has already passed.
This is opt-in because Antigravity CLI 1.1.x on Windows can still reject commands
that are present in `permissions.allow`.

If the CLI reports an interrupted stream while repository changes are present,
resume the same conversation once with a compact continuation prompt and
`-Continue`; do not start the implementation over. Never use `-Continue` after
a permission denial. Stop that run, review the existing diff, and let Codex run
the verification command.

On any runner failure, inspect `.ai-work/agy-error-summary.txt` first. The runner
derives it from at most the final 80 log lines and keeps only actionable signals.
Do not load `.ai-work/agy-run.log` wholesale. If the summary is insufficient,
inspect no more than the final 80 lines and stop after identifying the layer.

Use the CLI for ordinary delegation. For an exceptional interactive issue that
cannot be resolved in the CLI, prefer the lightweight Antigravity desktop
task/chat surface, then the full IDE editor only if necessary. Computer Use is
only the transport for those recovery actions, not the normal coding path. Use
Chrome only when an Antigravity web session is explicitly required. After any
UI fallback, return to repository diff and shell verification for acceptance.

## Repair prompt

For a verified defect, create `.ai-work/repair-N.md` containing only:

1. the concrete finding and evidence;
2. the violated invariant;
3. expected behavior;
4. likely affected files;
5. the exact verification command; and
6. the same three compact required handoff headings.

Do not request a broad redo unless the implementation is unusable. Run no more
than one repair delegation per user request.

## Stop conditions

Stop and report the exact layer when blocked by a missing `agy` executable,
authentication, model availability, quota, permissions, invalid JSON, timeout,
implementation failure, or an incomplete handoff. Never substitute a model or
enable dangerous permission bypasses.
