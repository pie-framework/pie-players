---
"@pie-players/pie-assessment-toolkit": patch
---

`<pie-item-toolbar>` resubscribes its tools' active state only when the rendered tools change (R-07). Its first sync ran a tool's `sync()` inside a tracked effect, so any state that `sync()` read tore down and re-created every tool's subscription when it changed; the first sync is now deferred like the later ones.
