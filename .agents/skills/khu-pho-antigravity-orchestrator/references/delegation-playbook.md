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

TEST_COMMANDS
Exact commands discovered from manifests or CI.

IMPLEMENTATION_INSTRUCTIONS
Implement, run focused checks, inspect your own diff, repair obvious problems,
and rerun affected checks. Do not commit, push, deploy, add unrelated
dependencies, or continue into later work.

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
output, and a bounded timeout. It validates the model and required handoff
sections, then writes `.ai-work/last-handoff.md`.

If the CLI reports an interrupted stream while repository changes are present,
resume the same conversation with a compact continuation prompt and
`-Continue`; do not start the implementation over.

Use the CLI for ordinary delegation. Use Computer Use only for interactive
authentication, permission dialogs, or a CLI failure that genuinely requires
the desktop application. Use Chrome only when an Antigravity web session is
explicitly required. After any UI fallback, return to repository diff and shell
verification for acceptance.

## Repair prompt

For a verified defect, create `.ai-work/repair-N.md` containing only:

1. the concrete finding and evidence;
2. the violated invariant;
3. expected behavior;
4. likely affected files;
5. the exact verification command; and
6. the same required handoff headings.

Do not request a broad redo unless the implementation is unusable. Run no more
than two repair delegations per user request.

## Stop conditions

Stop and report the exact layer when blocked by a missing `agy` executable,
authentication, model availability, quota, permissions, invalid JSON, timeout,
implementation failure, or an incomplete handoff. Never substitute a model or
enable dangerous permission bypasses.
