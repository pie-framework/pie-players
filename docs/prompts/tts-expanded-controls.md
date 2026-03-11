# Implementation Plan Prompt: TTS Expanded Controls (PD-5809)

Use this prompt to generate a detailed implementation plan for the TTS inline tool expanded controls feature.

---

## Prompt

I need an implementation plan for expanding the `pie-tool-tts-inline` custom element with a popup control panel containing play/pause, stop, fast-forward, rewind, and playback speed controls.

### Design spec

The control panel has three states:
- **Closed** — a single speaker icon trigger button. No panel.
- **Open (idle)** — panel visible with: Play ▶, Stop ■, Fast-forward ⏩, Rewind ⏪, speed buttons (1.5×, 2×).
- **Playing** — panel stays open; Play becomes Pause ⏸; all other controls remain. Panel only closes when Stop is pressed (or user explicitly closes it).

Keyboard: Tab moves focus into the panel section; arrow keys navigate between controls within it.

### Relevant files

- `packages/tool-tts-inline/tool-tts-inline.svelte` — the component to modify. Currently renders: a speaker/play/pause trigger button directly; a stop button shown inline while playing. Shadow DOM (`shadow: "open"`). Props: `toolId`, `catalogId`, `language`, `size` (`sm|md|lg`).
- `packages/assessment-toolkit/src/services/interfaces.ts` — defines `ITTSService`. Current methods: `speak()`, `speakRange()`, `pause()`, `resume()`, `stop()`, `isPlaying()`, `isPaused()`, `getState()`, `getCurrentText()`, `onStateChange()`, `offStateChange()`, `getCapabilities()`, `updateSettings(settings: Partial<TTSConfig>)`, `setHighlightCoordinator()`, `setCatalogResolver()`. **No `seekForward`/`seekBackward` methods yet.**
- `packages/assessment-toolkit/src/services/TTSService.ts` — implements `ITTSService`. Already has `updateSettings()` which accepts `{ rate, pitch, voice, ... }`. Rate is clamped to 0.25–4 internally.
- `packages/assessment-toolkit/src/services/tts/browser-provider.ts` — browser `SpeechSynthesis` provider. Has `updateSettings({ rate })` that updates `utterance.rate` on the fly.

### What already works

- `ttsService.pause()` / `resume()` / `stop()` — functional
- `ttsService.updateSettings({ rate: 1.5 })` — changes playback rate mid-session via `ITTSService.updateSettings`
- `speaking` / `paused` reactive state in the component
- `handlePlayPause()` and `handleStop()` functions
- `--pie-*` CSS token theming throughout
- WCAG 2.1 AA touch targets (44px), focus indicators, `aria-live` status announcements already present

### What needs to be added

1. **Panel open/close state** — clicking the speaker icon toggles the panel; panel stays open while playing; closes on stop (or explicit close).

2. **Fast-forward / Rewind** — `ITTSService` has no seek methods. Options to evaluate:
   - Sentence-boundary jump: stop current utterance, re-`speak()` from the next/previous sentence boundary in the text (requires tracking current position/segment index).
   - Fixed-time skip: for browser TTS (`SpeechSynthesis`), true mid-utterance seeking is not supported — the practical approach is to re-speak from a calculated offset in the text.
   - Decide and document which approach to implement; add `seekForward(units?: number)` / `seekBackward(units?: number)` to `ITTSService` and implement in `TTSService` and `browser-provider.ts`.

3. **Speed control** — `updateSettings({ rate })` already works. The component needs:
   - A `playbackRate` state variable (default `1`).
   - Speed buttons (1.5×, 2×) styled as toggles; active state visually indicated.
   - Selecting a speed calls `ttsService.updateSettings({ rate: selectedRate })`.
   - Speed persists across pause/resume within the same session.

4. **Keyboard navigation** — the panel should be a `role="group"` or `role="toolbar"` with `aria-label="Reading controls"`. Arrow key navigation between buttons inside (roving tabindex or arrow key handler).

5. **Shadow DOM considerations** — panel is inside `shadow: "open"`. Ensure focus management works correctly and that `--pie-*` tokens for the panel card (background, border, shadow) are defined.

### Constraints

- Use `--pie-button-*` and `--pie-focus-*` tokens for all interactive states (no hardcoded color literals).
- No DaisyUI / Tailwind dependency (self-contained scoped `<style>`).
- `prefers-reduced-motion` must suppress animations.
- Screen reader: `aria-live="polite"` status messages for speed changes, seek actions.
- The existing `size` prop should scale the trigger button; panel size can be fixed or size-relative.
- Backwards compatible: existing usage (no panel, just the trigger button) should still work if `panelMode` prop is false or absent — OR the panel approach replaces the old inline buttons entirely (decide which).

### Questions to resolve in the plan

1. Should fast-forward/rewind jump by sentence boundary or by a fixed word/character count? What is the fallback when the provider does not expose position?
2. Should 1× speed be an explicit button in the panel, or just the implicit state when neither 1.5× nor 2× is selected?
3. Should the panel be absolutely positioned (floating above content) or inline-flow? The design image shows a floating card.
4. Should `seekForward`/`seekBackward` be added to `ITTSService` as required methods, or as optional (`seekForward?`)?
5. Should speed selection persist across `stop()` + new `speak()` calls, or reset to 1× on stop?

### Deliverables expected from the plan

- Step-by-step implementation order (what to change first, what depends on what)
- Interface changes to `ITTSService` and `TTSService` for seek support
- Component structure for the panel (Svelte markup skeleton)
- State variables needed
- CSS outline for the panel card and speed button active state
- Accessibility checklist for the panel
- Test cases to add (unit + E2E)
