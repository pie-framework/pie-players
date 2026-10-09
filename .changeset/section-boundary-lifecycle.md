---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-players-shared": patch
---

Returning to a section fires `pie-loading-complete` once its newly mounted items load; it used to fire at once from the earlier visit's state. A shell's events after its section is left reach that section's controller: its unregister, its pending response and its errors, which were lost or reached the next section. A `session` set for a section that has not started yet no longer reaches the next section. `FrameworkErrorModel` gains `scope` (`cohort` or `runtime`): a fatal `cohort` error fails only its section, a `runtime` one every later section. A failed tool-state load or save and a failed controller dispose are now recoverable, and a provider that fails to register follows the tool start-failure policy. `section-ready` carries the section's `controller` and `attemptId`, and advances that section's stage chain to `engine-ready` in place of a 2.5-second wait.
