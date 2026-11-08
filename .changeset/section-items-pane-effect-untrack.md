---
"@pie-players/pie-section-player": patch
---

Keep the section items pane's warmup-resolution `$effect` wiring-only: it reads the readiness and the renderables fingerprint tracked, and writes the remembered fingerprint inside `untrack`, per the subscription-safety rule the rest of the pane follows. No behavior change.
