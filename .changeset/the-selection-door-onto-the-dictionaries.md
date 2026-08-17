---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-tool-annotation-toolbar": patch
---

Selecting a word now offers a dictionary lookup on the annotation strip, and the panel opens already answered.

The mechanism is a capability-agnostic one, because a selection gateway cannot name the tool it opens. `ToolkitCoordinator` gains `requestTool` / `canRequestTool` / `registerToolRequestTarget`: a surface names an unscoped tool id, and the toolbar hosting that tool turns it into a scoped instance, applies the request's params and shows it. Resolution is a claim rather than a broadcast — a broadcast would open a panel in every toolbar whose scope contains the selection, which in a section player is the item card's and the section's both. Params layer over the host's own, so a request carrying a term leaves a configured endpoint in place, and they arrive through `getToolRenderParams`, which means a tool needs nothing new to receive one.

The strip renders host-supplied `selectionActions` and knows nothing about what they do; the pairing to the two dictionaries lives in the composition layer, which is the only layer allowed to name capabilities. A host can contribute an action for a capability PIE does not ship. An action whose tool no toolbar hosts is absent rather than present and inert.

Acting on a selection now latches the strip down for that selection. The selection itself survives on purpose — the learner's place in the text is not ours to clear — and opening a panel moves focus, which fires `selectionchange`: without the latch the strip came straight back over the definition it had just fetched. Escape, focus leaving and an outside click do not latch, and Shift+F10 clears one, so dismissing never costs a learner the strip for good.

The door is a shortcut, not the way in. Chromium will not extend a selection with Shift+Arrow in non-editable content unless caret browsing is on, an OS toggle absent on mobile, so a sighted keyboard-only learner cannot originate a selection at all. Both dictionaries keep their toolbar button and their own term field.

Fixes both dictionary toolbar buttons rendering blank: `book-open` and `photo` had no entry in the toolbar's icon map, so an icon-only button drew nothing. The map moves to `services/tool-icons.ts` and is exported through `tools/internal`, so a gateway button and the toolbar button for one tool draw the same shape.
