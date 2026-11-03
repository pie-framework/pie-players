---
"@pie-players/pie-section-player-tools-tts-settings": patch
---

The TTS settings panel styles itself. It renders into the host page's light DOM,
and it emitted DaisyUI utility classes (`btn`, `select`, `input`, `toggle`,
`alert`, `fieldset`, `join`, plus Tailwind spacing and typography utilities) it
never defined — so it depended on the host having loaded DaisyUI to be usable,
and a host that had loaded it had its CSS reaching into the panel's controls.
Every styled node now carries a `pie-tts-*` class hook the panel defines
itself, styled from the same `--pie-button-*` / `--pie-text` tokens the PnP
panel uses, with the status variants riding the border so the ink stays on a
certified pair. The new hooks are in the package's `custom-elements.json`; the
element tag, props and events are unchanged.
