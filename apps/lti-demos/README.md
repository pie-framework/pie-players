# PIE LTI Demos

Demonstrates how an LTI tool host can launch PIE players after LTI protocol
validation has already completed.

This app intentionally uses a mock verified launch context. It does not
implement OIDC login, JWT validation, platform registration, Deep Linking, or
Assignment and Grade Services.

## Running The Demo

```bash
# From monorepo root
bun install

# First run on a fresh checkout
bun run dev:lti -- --rebuild

# Normal daily start
bun run dev:lti
# Opens http://localhost:5600
```

The demo page fetches a server-approved launch context, maps it to
`assessment-id` and `attempt-id`, mounts `pie-assessment-player-default`, and
persists assessment sessions through a server API rather than browser
`localStorage`.
