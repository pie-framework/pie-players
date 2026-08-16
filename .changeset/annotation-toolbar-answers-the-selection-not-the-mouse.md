---
"@pie-players/pie-tool-annotation-toolbar": patch
---

Trigger the annotation toolbar from the selection itself, and give its
`role="toolbar"` the key model that role promises.

The toolbar was shown from `mouseup` and `touchend` only. A selection that arrived
any other way produced nothing, so highlight, underline, remove-annotation and
read-aloud-selection had no keyboard route at all — WCAG 2.2 SC 2.1.1. The strip
also declared `role="toolbar"` while leaving every button its own tab stop, so the
arrow keys the role advertises did nothing and the control set cost as many tab
stops as it had buttons.

`selectionchange` is now the trigger, coalesced per animation frame. Pointer
gestures suppress the show between `pointerdown` and release, so dragging a
selection no longer drags a toolbar across the text mid-gesture; the suppression is
a bounded timestamp rather than a latch, because a release outside the window fires
no `pointerup` and a latch would disable the toolbar for the rest of the attempt.
`pointercancel` is handled for the same reason. Scrolling repositions the strip
instead of dismissing it — the previous behaviour dismissed on the very keystroke
that scrolled a selection into view — and withdraws it only once the selection's
rect leaves the viewport entirely.

The strip is now a single tab stop with a roving tabindex over whatever controls are
rendered, which is conditional: read-aloud is absent without a TTS service and
remove-annotation exists only over an existing annotation. Arrow keys are logical
rather than physical, so they run in reading order for `ar`. `Shift+F10` and the
Menu key move focus into the strip, matching the platform convention for a
context-sensitive affordance, because the strip is a floating layer whose DOM
position bears no relation to the selection. Escape returns focus where it was and
leaves the selection intact. Outside-click dismissal reads `composedPath()`, since a
document-level listener sees the retargeted host and `contains` reported false for
the strip's own buttons — dismissing on the click that was activating one.

One limit this does not remove, and cannot: Chromium does not extend a selection
with Shift+Arrow in non-editable content unless caret browsing is on, an OS-level
toggle absent on mobile. Screen reader users reach the toolbar, because JAWS and
NVDA set a real DOM selection in browse mode and `selectionchange` observes it, and
pointer and touch users are unaffected. A sighted keyboard-only user still cannot
originate the selection. Any capability offered *only* through this strip is
therefore unreachable for them and needs a second entry point.

Covered by `packages/tool-annotation-toolbar/tests/selection-keyboard.test.ts` for
the navigation, bounds and gesture-suppression logic, and by
`packages/section-player/tests/section-annotation-toolbar-keyboard.spec.ts` for the
browser behaviour that only a browser can settle — `selectionchange` timing, focus
crossing into a shadow root, and the roving tabindex. `section-player-tts-ssml.spec.ts`
no longer dispatches a synthetic `mouseup` to get the strip on screen; that it
needed one was the defect.
