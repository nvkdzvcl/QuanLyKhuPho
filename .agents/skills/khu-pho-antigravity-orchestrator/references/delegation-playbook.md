# Antigravity delegation playbook

Read this file only for `DELEGATE` or `PHASE` work.

## Prepare the task packet

Create `.ai-work/current-task.md`. Keep it concise and use this structure:

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

ACCEPTANCE_CRITERIA
Observable conditions that must pass.

CODEX_VERIFICATION_COMMANDS
Exact commands discovered from manifests or CI. These are for Codex after the
handoff, not for Antigravity's default implementation-only run.

IMPLEMENTATION_INSTRUCTIONS
Implement using repository read/write tools only. Do not run shell commands,
tests, lint, builds, Git, Docker, or package-manager commands. Inspect the files
you changed and repair obvious problems. Do not commit, push, deploy, add
unrelated dependencies, or continue into later work. Codex will verify.

REQUIRED_HANDOFF
Return exactly these headings with concise content:
FILES_CHANGED
CHANGE_SUMMARY
TESTS
KNOWN_RISKS
DIFF_SUMMARY
```

Reference requirements and code by path. Include only the snippets needed to
disambiguate a contract; do not paste entire documents or files.

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

The runner pins `gemini-3.7-flash-high`, `accept-edits`, high effort, JSON outer
output, and an eight-minute default timeout. It adds the implementation-only
constraint, validates the model and required handoff sections, then writes
`.ai-work/last-handoff.md`.

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
6. the same required handoff headings.

Do not request a broad redo unless the implementation is unusable. Run no more
than one repair delegation per user request.

## Stop conditions

Stop and report the exact layer when blocked by a missing `agy` executable,
authentication, model availability, quota, permissions, invalid JSON, timeout,
implementation failure, or an incomplete handoff. Never substitute a model or
enable dangerous permission bypasses.
