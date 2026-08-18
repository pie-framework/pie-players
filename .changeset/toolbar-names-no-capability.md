---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

Move the calculator's toolbar and shell specifics out of the generic core into the
composition layer that owns them.

`ItemToolBar` branched on `toolId === "calculator"` in four places — the keyboard
bridge that lets Tab cross between the page and a shell, the design-system header
chrome, the close button's display value — mapped the FontAwesome icon from a
toolId, and defaulted its `tools` prop to
`calculator,textToSpeech,answerEliminator`. AGENTS.md says this package names no
capability.

Three declarations replace them: `faIconName` on a toolbar button definition,
`ndsHeaderControls` and `pageTabOrder` on a tool window's shell config. The
calculator registration sets all three, which is where a decision about which
capabilities a deployment renders in the host's design system belongs. The `tools`
default is now empty; every in-repo mount passes it explicitly, and no consumer
mounts `pie-item-toolbar` directly.

`check-capability-neutrality` could not see any of this: it read only `.ts` from a
hand-listed scope. It now covers the three toolbar components too, and its
comment-stripping is a state-tracking scan rather than ordered regex replaces —
the old order let a `/*` inside a line comment (`externalizes @pie-players/*`)
open a phantom block comment and hide the ~700 lines that followed it from the
check, in `.ts` files as much as in components.
