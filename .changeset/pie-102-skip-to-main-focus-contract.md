---
'@pie-players/pie-section-player': minor
---

Ship the framework-side focus contract for Skip-to-Main (PIE-102).

- Promote `<pie-section-player-passage-card>` and `<pie-section-player-item-card>` to public focus targets: each custom element now carries `tabindex="-1"`, `role="region"`, and `aria-labelledby` pointing at its heading, plus a `:focus-visible` outline scoped to the tag so the indicator wraps the whole card box. The inner `data-section-item-card` div remains as an internal hook.
- Replace `SectionPlayerFocusPolicy.autoFocusFirstItem: boolean` with `SectionPlayerFocusPolicy.autoFocus: 'none' | 'start-of-content' | 'current-item'` (default `'start-of-content'`). The strategy governs both mount and navigation focus moments: `start-of-content` focuses the passage when present else the first item card; `current-item` focuses the newly-active `pie-section-player-item-card[is-current]` for stacked/list layouts; `none` disables framework-driven focus movement entirely.
- Keep `autoFocusFirstItem` as a deprecated alias (`true` → `'start-of-content'`, `false` → `'none'`) with a one-time console warning. Existing hosts continue to work unchanged.
- Expose a `focusStart(): boolean` imperative method on `pie-section-player-splitpane`, `pie-section-player-vertical`, `pie-section-player-tabbed`, `pie-section-player-kernel-host`, and `pie-section-player-base`. It always focuses start-of-content and is the escape hatch hosts call from Skip-to-Main handlers — strategy-agnostic by design.
- Export `DEFAULT_FOCUS_POLICY`, `SectionPlayerAutoFocusStrategy`, and `resolveAutoFocusStrategy` alongside the existing policy types.
