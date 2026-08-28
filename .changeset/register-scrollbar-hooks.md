---
"@pie-players/pie-theme": patch
---

Register `--pie-scrollbar-thumb`, `--pie-scrollbar-thumb-hover` and `--pie-scrollbar-track` in the published token registry.

The three were the only `--pie-*` names in section-player source held out of the registry by an allowlist in `check-theme-tokens.mjs`, while every other internal handoff token in that package is registered. They are recorded as `package-private` with `excluded` scheme participation, which is what they already are: no theme and no scheme sets a value, so each one's fallback chain is the contract rather than its name. Nothing changes about how the panes render.

A host reading `token-registry.json` sees three new entries under a `scrollbar` category. That is the registry's designed behaviour — a token added here appears in a registry-driven inspector without a host edit — and no value, name, selector or fallback moved.
