---
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

The PNP debugger's buttons are styled by the panel itself: their rules never reached the build, so the toggles showed state only through a host's own `active` and `danger` classes. The toggles now report state with `aria-pressed` and use `pie-section-player-tools-pnp-debugger__toggle--on` and `__toggle--prohibited`, so host rules for those common names no longer reach them (R-02). The TTS settings panel types `toolkitCoordinator` structurally, so its declarations no longer need the toolkit installed (R-15).
