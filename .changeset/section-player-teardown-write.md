---
"@pie-players/pie-section-player": patch
---

Switching `section` on a mounted section player no longer leaves the new section's stage chain unfinished on Svelte 5.58.1 and later. The effect that installs the section controller factory wrote the previous factory back onto `<pie-assessment-toolkit>` from its teardown, and that property is a custom-element accessor that flushes synchronously, so the toolkit's pending section effect ran against the previous section's values. The effect now reads the section, attempt and coordinator untracked and its teardown only detaches the `toolkit-ready` listener.
