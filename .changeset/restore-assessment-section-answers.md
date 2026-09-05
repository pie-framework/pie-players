---
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-players-shared": patch
---

Preserve assessment answers when returning to a section. Capture the outgoing
section's complete snapshot before replacing its DOM, including navigation
through the assessment controller. Wait for the section's canonical engine-ready
event and apply its saved session before accepting input or replacement-session
updates. Cancel listeners and readiness waits when navigation or disconnection
retires the section; late restoration results cannot update its replacement.

A failed restore or controller-readiness timeout preserves saved answers and
reports the existing assessment error event and navigation error hook. Provide
localized, keyboard-accessible Retry and mark the section busy until restoration
succeeds. Keep the section event-contract import external in the assessment
bundle so it shares the existing custom-element registration.

The recorded consumer inventory lists no external assessment-player host;
downstream checkout verification is still pending. Public real-content fixtures
cover both section layouts, navigation, reload, delayed readiness/restoration,
failure, timeout, retry, and disconnection. Standalone section, toolkit, and
item-player contracts are unchanged. Persistence ordering and submission
acknowledgement remain a separate repair.
