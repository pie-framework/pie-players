---
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

Remove PIE-owned focus-placement APIs and automatic section navigation focus movement.

This is a breaking cleanup for pre-1.0 hosts: `pie-item-player.focusFirst()`, section-player layout `focusStart()`, `SectionPlayerFocusPolicy.autoFocus`, `DEFAULT_FOCUS_POLICY`, and `resolveAutoFocusStrategy` are no longer exported. The shared `queryFirstFocusableDeep()` and `focusFirstFocusableInElement()` helpers were also removed; `FOCUSABLE_SELECTOR` and `isProgrammaticFocusTarget()` remain for focus-trap internals.

Hosts should own skip links, landmarks, and page-level focus placement while section player preserves natural tab order into actionable controls.
