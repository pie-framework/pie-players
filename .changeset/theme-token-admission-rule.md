---
"@pie-players/pie-theme": patch
---

Write down the registry admission rule and the token stability rule.

The token surface has been stable and the churn was in our own decision rule for what belongs in it. Measured across develop's first-parent history from 2026-07-07 to 2026-08-28: no registered name was renamed or dropped, no token any consumer sets was removed, and two commits changed a value a host renders — `1f29de7f` repairing six base-theme colours and six scheme values against WCAG, and `16926137` moving one scheme's `--pie-blue-grey-300`. Against that, the admission rule gave three answers in four weeks: #153 published seventeen entries on the basis that the names existed in source, #162 withdrew sixteen of them the next day, and the scrollbar and TTS-highlight registrations of 2026-08-28 registered on the basis that a host sets them while declining nine geometry handoffs on the basis that none does.

`docs/architecture/pie-727-theme-token-inventory.md` gains **Registry admission** and **Token stability**, and `AGENTS.md` gains the binding summary next to the downstream-consumer rules it depends on. A `--pie-*` name earns a registry entry when a host sets it, or when package documentation tells a host to set it; every other name gets an allowlist line in `check-theme-tokens.mjs` and nothing else. A README that names a token states which side of that line it falls on, since offering a token to hosts while leaving it unregistered is the same defect read from the other end. Registered names are not renamed or dropped, and reclassifying one narrows a promise a host may already hold, so it takes the consumer-pad check a rename would. A rendered value changes on a diagnosed accessibility failure or a host-visible defect, named in the changeset with the relationship it repairs.

Docs only. No token, value, fallback, scope or participation moves here.
