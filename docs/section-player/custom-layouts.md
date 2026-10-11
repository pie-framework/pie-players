# Custom Section Layouts

This guide is for hosts that arrange a section's items and passages themselves
in place of a stock layout (split pane, vertical or tabbed). It covers
`<pie-section-player-kernel-host>`, the two panes, and the rules a layout
follows. The inputs, host methods and events are listed in the
[section player README](../../packages/section-player/README.md); the internals
are in the package's [architecture notes](../../packages/section-player/ARCHITECTURE.md#custom-layouts).

A layout is built from `pie-section-player-kernel-host` and two panes. The
kernel host is a section player without a layout of its own. It runs the
section: the toolkit, the section controller, readiness, the element pre-warm
(the section-wide step that loads every element the items name before they
mount) and the section toolbar. Its element children are the layout, and the
panes inside them render the section's items and passages. The stock layouts are
built from the same panes.

## A two-column page

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      body { margin: 0; }
      pie-section-player-kernel-host { display: block; height: 100vh; }
      .columns { display: grid; grid-template-columns: 3fr 2fr; height: 100%; }
      .column { min-height: 0; overflow: auto; }
    </style>
    <script type="module">
      import "https://cdn.jsdelivr.net/npm/@pie-players/pie-section-player@x.y.z/dist/browser/pie-section-player.js";

      const player = document.querySelector("pie-section-player-kernel-host");
      player.addEventListener("pie-loading-complete", () => {
        console.log("ready", player.getSnapshot().navigation);
      });
      player.runtime = { env: { mode: "gather", role: "student" } };
      player.section = {
        identifier: "water-cycle",
        rubricBlocks: [
          {
            identifier: "passage-1",
            class: "stimulus",
            view: ["candidate"],
            passage: {
              id: "passage-1",
              config: {
                markup: "<p>Water evaporates, condenses into clouds and falls as rain.</p>",
                elements: {},
                models: [],
              },
            },
          },
        ],
        assessmentItemRefs: [
          {
            identifier: "item-1",
            item: {
              id: "item-1",
              config: {
                markup: "<p>Name the stage in which water vapor forms clouds.</p>",
                elements: {},
                models: [],
              },
            },
          },
        ],
      };
    </script>
  </head>
  <body>
    <pie-section-player-kernel-host section-id="water-cycle" attempt-id="attempt-1">
      <div class="columns">
        <div class="column"><pie-section-player-items-pane></pie-section-player-items-pane></div>
        <div class="column"><pie-section-player-passages-pane></pie-section-player-passages-pane></div>
      </div>
    </pie-section-player-kernel-host>
  </body>
</html>
```

The page loads the
[browser build](../install/cdn.md#section-player-browser-build); replace
`x.y.z` with the exact version you deploy. A bundled host imports
`@pie-players/pie-section-player`, which defines the kernel host and the panes
too. An item with PIE elements names them in `config.elements` and carries their
`config.models`, as in any section. The `/custom-layout` route of
`apps/section-demos`
([source](../../apps/section-demos/src/routes/%28demos%29/custom-layout/+page.svelte))
builds the same two columns in Svelte.

## Kernel host

- **Inputs and host methods.** Those of the stock layout elements
  ([inputs](../../packages/section-player/README.md#inputs),
  [host methods](../../packages/section-player/README.md#host-methods)), without
  the layout dimensions (`narrow-layout-breakpoint`, `content-max-width-*`,
  `split-pane-*`).
- **DOM.** The open shadow root holds the toolkit and the section toolbar around
  one default slot; `show-toolbar` and `toolbar-position` place the toolbar
  around the layout. The children, the panes and the content they render stay in
  light DOM, where page styles and the content stylesheet reach them. The element
  has no styles of its own, so the host gives it `display` and a height.
- **Stock body.** With no element children it renders its own layout: the
  passages pane above the items pane, the passages pane only for a section with
  passages. The stock body leaves when the first element child arrives and
  returns when the last one leaves. Text and comment children do not count, so
  markup whitespace and a framework's placeholder comments leave it in place.
- **Navigation and state.** The host methods (`navigateNext`,
  `navigatePrevious`, `navigateTo`, `getSnapshot`, `getSectionController`,
  `waitForSectionController`) and the events (`pie-stage-change`,
  `pie-loading-complete`, `composition-changed`, `session-changed`,
  `framework-error`, `toolkit-ready`) are those of the stock layouts.
  `detail.sourceCe` on its `pie-stage-change` and `pie-loading-complete` events
  reads `pie-section-player-kernel-host`.

## Panes

`<pie-section-player-items-pane>` renders the item cards of the current
composition, with their toolbars, and runs the element pre-warm;
`<pie-section-player-passages-pane>` renders the passage cards. A pane takes no
attributes or properties, and its pre-warm failures arrive as the section
player's `framework-error` and `element-preload-error` events. It reads the
section player it belongs to from a context the kernel host publishes, so it
renders at any depth below the kernel host, and outside a section player it
renders nothing.

- **One pane of each kind renders**: the first connected. A second pane of a
  kind renders nothing and takes over when the first disconnects; the player
  reports the duplicate once in the console.
- **Readiness follows the rendering items pane.** The `interactive` stage and
  `pie-loading-complete` wait for its element pre-warm, and reports from any
  other pane are ignored. A section with items and no items pane reaches
  neither; the player reports it once in the console, a task after
  `section-ready`.
- **The passages pane is optional.** A section without passages needs none, and
  readiness does not wait for it.
- **Scrolling belongs to the layout.** The items pane's scroll hint follows the
  nearest ancestor with `overflow-y: auto` or `scroll`, so the layout gives each
  pane's container that overflow and a bounded height. The stock layouts' pane
  backdrops and margins stay with those layouts; the cards keep their tags and
  [styling hooks](../../packages/section-player/README.md#card-header-styling-hooks).
