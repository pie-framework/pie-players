---
"@pie-players/pie-tool-tts-inline": patch
---

Fix inline TTS keyboard navigation so the reading controls sit in the page tab order in visual order.

- The controls panel now precedes the play/pause trigger in the DOM for the overlay layouts (`floating-overlay` and the default `left-aligned`), where it opens to the left of the trigger. Shift+Tab from Play/Pause now walks backwards through stop → fast-forward → rewind → speed controls. The row layouts, which drop the panel below the trigger, keep trigger-then-panel order.
- Rewind, fast-forward and stop are each their own Tab stop instead of sharing one roving toolbar stop, so every control is reachable with Tab alone.
- The speed radios remain a single Tab stop, now placed on the *checked* option per the ARIA radiogroup pattern (previously it was always the first option, e.g. "slow", even when "normal" was selected).
- Arrowing onto a speed option now selects it immediately, like a native radio group or an answer-choice group — no Spacebar/Enter needed. Arrow keys stay within their cluster, so they never cross the radiogroup boundary, and they skip disabled controls instead of stranding focus.
- The play/pause trigger keeps keyboard focus when activated. It no longer sets `disabled` while the play action is in flight — a disabled element cannot hold focus, so pressing Play dropped focus to the document body. Re-entrancy is still guarded in the handler and the pending state is exposed via `aria-busy`.
- Stopping playback hands focus back to the play/pause trigger. Stop unmounts the panel containing the button that was just activated, which previously left focus on `<body>`.
- The play/pause trigger now paints a focus ring whenever it holds focus, not only when the browser decides `:focus-visible` applies. Because activating it deliberately keeps focus on the trigger while the panel opens beside it, a pointer activation (or the programmatic hand-back from Stop) previously left focus on the trigger with nothing drawn. The rule is scoped to `:focus:not(:focus-visible)`, so genuine keyboard focus keeps the shared control ring — and the `nds-icon-button` variant keeps the NDS ring — unchanged.
