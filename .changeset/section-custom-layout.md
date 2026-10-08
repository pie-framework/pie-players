---
"@pie-players/pie-section-player": patch
---

`<pie-section-player-kernel-host>` takes a host-built layout: its element children are the layout, and `<pie-section-player-items-pane>` and `<pie-section-player-passages-pane>` placed among them render the section; with no element children it renders its stock body. The panes take no properties or attributes and fire no events of their own, so values set on a pane are ignored and a listener on a pane no longer hears `elements-loaded-change`, `element-preload-retry` or `element-preload-error`; the layout elements still fire the last two. A layout element inside another component's shadow root dispatches its events on itself instead of on that component, the kernel host's events carry `sourceCe: "pie-section-player-kernel-host"`, and split-pane's pre-warm reports name `pie-section-player-splitpane` in its narrow layout too.
