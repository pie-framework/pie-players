---
"@pie-players/pie-assessment-player": patch
---

`<pie-assessment-player-shell>` renders its scaffold in an open shadow root, so the host's children are kept and project into its `navigation` and default slots; it previously cleared them on connect and on every `show-navigation` change. The body fills the height left by the navigation, including when navigation is hidden.
