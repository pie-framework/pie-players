---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

A listener on a section-player layout element now receives each toolkit event
once: `session-changed`, `composition-changed`, `runtime-owned` and
`runtime-inherited` used to arrive three times and `framework-error` twice.
Errors reported by a coordinator passed as `runtime.coordinator`, as Host R
passes one, now also reach the layout's `framework-error` event and
`onFrameworkError`, without the toolkit's initialization banner. The runtime's
internal registration and session events stop at the toolkit, and an answer no
longer re-registers every item shell. A second item shell's identical response
is no longer dropped; apart from that response, `document` listeners, which
Hosts A and R use, receive what they did before.
