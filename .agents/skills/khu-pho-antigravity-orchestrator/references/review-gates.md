# QuanLyKhuPho review gates

Apply only gates relevant to the diff. Findings should include evidence, impact,
and the smallest reasonable correction.

## Repository and scope

- Preserve pre-existing user changes and avoid unrelated cleanup.
- Reject commits, generated secrets, local state, broad rewrites, or unexplained
  dependencies outside the task.
- Confirm public contracts, callers, tests, and documentation remain aligned.

## Authentication and authorization

- Enforce the three roles `resident`, `leader`, and `officer` on the server.
- A leader may access only their assigned neighborhood; an officer may access
  ward-wide data. Never rely on frontend filtering for data isolation.
- Check account status on protected operations and invalidate access when an
  account is locked or rejected.
- Verify OTP expiry, rate limiting, failed-attempt lockout, session expiry, and
  renewal behavior where touched.

## Personal data and security

- Do not log plaintext phone numbers, citizen IDs, OTPs, tokens, or secrets.
- Verify encryption or protected storage for sensitive fields and masking in
  diagnostics, errors, queues, and exported data where applicable.
- Prefer secure HttpOnly cookies for browser session credentials. If another
  approach is required, document the threat model and compensating controls.
- Validate file type, size, ownership, download authorization, and safe storage
  for uploads.

## Database and state

- Check primary keys, foreign keys, uniqueness, indexes, nullability, and actual
  database types rather than placeholder strings.
- Migrations must be deterministic, reversible when practical, and compatible
  with existing data.
- Multi-write workflows should use transactions or explicit compensation.
- History and audit records that are defined as immutable must not be overwritten
  or deleted by ordinary workflows.

## API, queues, and notifications

- Validate inputs at the server boundary and keep status codes/error contracts
  consistent.
- Check idempotency, retries, duplicate delivery, poison-message behavior, and
  observability for RabbitMQ jobs.
- Push notifications must have an in-app fallback and may not bypass recipient
  scope or authorization.

## Frontend behavior

- Verify loading, error, empty, success, and permission-denied states.
- Preserve mobile-first behavior from 320px and usable desktop layouts.
- Avoid leaking privileged data through prefetched queries, cached state, URLs,
  logs, or client-only guards.
- Check keyboard use, labels, focus, validation feedback, and destructive-action
  confirmation for changed flows.

## Verification depth

- `DIRECT`: focused check for the edited surface.
- `DELEGATE`: relevant lint/type/test commands plus contract or runtime checks.
- `PHASE`: full lint, typecheck, test, build, migration validation, and a runtime
  smoke test when supported by the repository.

Do not suppress failures with `any`, `@ts-ignore`, blanket lint disables, skipped
tests, or weakened assertions unless the user explicitly accepts the tradeoff.
