# PIE LTI Demos

Demonstrates how an LTI tool host can launch PIE players after LTI protocol
validation has already completed.

This app intentionally uses a mock verified launch context. It does not
implement OIDC login, JWT validation, platform registration, Deep Linking, or
Assignment and Grade Services.

## Running The Demo

The canonical demo command list lives in
[`../../docs/setup/demo_system.md`](../../docs/setup/demo_system.md). For this
app:

```bash
bun run dev:lti -- --rebuild
bun run dev:lti
```

The LTI demo runs on `http://localhost:5600` by default.

The demo page fetches a server-approved launch context, maps it to
`assessment-id` and `attempt-id`, mounts `pie-assessment-player-default`, and
persists assessment sessions through a server API rather than browser
`localStorage`.
