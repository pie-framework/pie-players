# @pie-players/pie-print-player

`<pie-print>` renders a PIE item for paper: it loads the print build of each
element the item names and renders the item's markup with them,
non-interactively, as a student worksheet or an answer key. PIE stands for
Portable Interactions and Elements. For hosts that print items.

## Overview

- An element's print build is `dist/browser/print/index.js` in its package,
  published by the pie-elements-ng packages that support print
  ([Print support](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PRINT_SUPPORT.md)
  in pie-elements-ng). The player loads it through the shared ESM adapter, so
  React and React DOM resolve through the same import map as under
  [`strategy="esm"`](../../docs/item-player/loading-strategies.md#strategyesm).
- Each element registers under a print tag of its own,
  `<tag>-print-<hash>`, hashed from the module URL, so two versions of one
  element print side by side.
- Elements placed in the markup render in place. Floaters, models whose `id` has
  no tag in the markup, such as rubrics, render after it.
- An element without a print build renders as a placeholder that names its tag.
- The player renders into its light DOM, so page styles reach the item.

Built with Lit 3.

## Installation

```bash
bun add @pie-players/pie-print-player
```

## CDN Usage

The bundle carries its dependencies, so a script tag registers `<pie-print>`:

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@pie-players/pie-print-player@x.y.z/dist/print-player.js"></script>
```

## Usage

```html
<pie-print></pie-print>
<script>
  const player = document.querySelector('pie-print');
  player.config = {
    item: {
      markup: '<multiple-choice id="q1"></multiple-choice>',
      elements: { 'multiple-choice': '@pie-element/multiple-choice@x.y.z' },
      models: [{ id: 'q1', element: 'multiple-choice', prompt: '...', choices: [...] }]
    },
    options: { role: 'student' }
  };
</script>
```

Each print element applies `options.role` as it prepares its print model, with
interactions disabled under both roles:

- `student`: prompts and choices, without correct answers or rationales
- `instructor`: correct answers highlighted, and rationales

The player compares `config` by identity, so a change takes a new object:

```javascript
player.config = { ...player.config, options: { role: 'instructor' } };
```

## Content styles

The player installs `@pie-players/pie-theme/components.css` at import, with the
item player's detection and ownership opt-out
([content styles](../item-player/README.md#content-styles)). Its `@media print`
rules hide `.noprint` and `.kds-noprint`. Without the stylesheet, authored
passage titles and `kds-*` markup render unstyled, and content the author marked
`.noprint` prints.

## Rendering Pipeline

On each `config` assignment the player:

1. Resolves each entry of `item.elements` through `resolve(tagName, pkg)`. The
   print tag is `<tagName>-print-<hash of url>`, unless the resolution sets
   `printTagName`.
2. Sanitizes `item.markup` and replaces each element tag that has an `id` with
   its print tag, keeping the authored attributes and children and setting
   `id`, `pie-id` and `data-original-tag`.
3. Renders the markup, then the floaters, and mounts the
   [accessibility alternates](#accessibility-alternates) above the markup.
4. Checks each module `url` with a HEAD request and registers the module under
   its print tag. A missing or failing module registers the `missingElement`
   placeholder instead.
5. Sets `options` and `model` on each element. Print elements receive no
   session.

## API

### `<pie-print>` Custom Element

| Property | Type | Description |
|---|---|---|
| `config` | `Config` | The item (markup, elements map, models), rendering options, and the accessibility inputs |
| `resolve` | `ResolverFn` | Maps each element to its print module ([Custom Resolution](#custom-resolution)); the default resolves jsDelivr's browser print build |
| `missingElement` | `MissingElFn` | `(pkg, message) => CustomElementConstructor`, the placeholder registered for a module that failed to load. The default shows the tag and the message in the theme's `--pie-incorrect` color |
| `trustMarkup` (attr `trust-markup`) | `boolean` | Render authored markup without sanitizing it. Defaults to `false` |
| `sanitizeMarkup` | `ItemMarkupSanitizer \| null` | Custom sanitizer used instead of the default. Ignored when `trustMarkup` is set |

### Markup Sanitization

Authored `item.markup` passes through the shared sanitizer from
`@pie-players/pie-players-shared/security`, as in `<pie-item-player>`
([Sanitizer guarantees](../../docs/security/readme.md#sanitizer-guarantees)).
The shared sanitizer keeps only `pie-*` custom elements, so the print player
allow-lists the item's element tags and their print tags. It skips the
scroll wrappers the screen players put around overwide images and tables:
`overflow` clips in print media, which would cut off wide content.

`trustMarkup` and `sanitizeMarkup` move the guarantee to the host
([Escape hatches](../../docs/security/readme.md#escape-hatches)). Set
`trust-markup` only when the host has already validated the markup:

```html
<pie-print trust-markup></pie-print>
```

Both may be set before or after `config`; the markup is reprocessed when they
change.

### Config

```typescript
interface Config {
  item: Item;
  options?: {
    role?: 'student' | 'instructor';
  };
  accessibility?: PrintAccessibilityConfig;
}

interface Item {
  markup: string;           // HTML with element placeholders
  elements: Elements;       // Tag name -> package@version map
  models: Model[];          // Data for each element instance
  accessibilityCatalogs?: AccessibilityCatalog[]; // Catalogs on the item itself
  extractedCatalogs?: AccessibilityCatalog[];     // Catalogs generated from its content
}

interface PrintAccessibilityConfig {
  personalNeedsProfile?: PersonalNeedsProfile;
  settings?: AssessmentSettings;
  itemSettings?: ItemSettings;
  registrations?: readonly ToolRegistration[];
}
```

### Accessibility Alternates

An accommodation carried as an accessibility catalog card, such as an audio
prompt's transcript, prints when the item and the learner call for it.
`config.accessibility` says who the print job is for: the learner's
`personalNeedsProfile`, the program's `settings`, and the item's
`itemSettings`. The player resolves the item's catalogs (`accessibilityCatalogs`,
`extractedCatalogs`, and those on each model) against them with the policy
engine and catalog resolver the section player uses, once per `config`
assignment.

- Each alternate in play mounts into the `.pie-print-alternates` block
  (`ALTERNATES_CLASS`) above the markup, under a visible label that is also its
  region's accessible name.
- Only alternates that fill the in-flow slot above the content
  (`CONTENT_LEAD_SURFACE`) print. A signed alternate is a video and does not.
- The packaged set is the audio transcript, from `transcript` catalog cards. A
  card with `visibility: "always"` is authored presentation and prints with no
  profile; any other prints when the profile grants the `transcript` support.
- `registrations` replaces the packaged set, so print and delivery consider the
  same capabilities.

### Custom Resolution

`resolve(tagName, pkg)` returns a `PkgResolution` that says where an element's
print module comes from:

- `loader: "browser-esm"` loads the package through the ESM adapter from
  `cdnBaseUrl`, in the jsDelivr layout unless `cdnProvider` says otherwise,
  with the print view and no controllers.
- Without a `loader`, the player imports `url` directly, with no import map, and
  registers the module's default export. Only a self-contained module loads
  this way.
- `module` must be `true` when there is no `loader`: a `false` one fails the
  load, and no element of the item receives its model.
- `url` is the file the HEAD check requests and the source of the print tag's
  hash.

```javascript
const cdn = 'https://cdn.example.com/npm';
player.resolve = (tagName, pkg) =>
  Promise.resolve({
    tagName,
    pkg,
    url: `${cdn}/${pkg}/dist/browser/print/index.js`,
    module: true,
    loader: 'browser-esm',
    cdnBaseUrl: cdn,
  });
```

The pie-elements-ng side of print packaging is in the
[PIE element contract](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/PIE_ELEMENT_CONTRACT.md#legacy-compatible-print-packaging).
Hosts moving from `@pie-framework/pie-print` follow
[Print player](../../docs/item-player/migration-from-pie-player-components.md#print-player)
in the migration guide.

## Exports

| Export | Purpose |
|---|---|
| `PiePrint` | The `<pie-print>` class. Importing the package registers it |
| `define`, `status`, `whenDefined` | The guarded registry print elements register through: `define` registers a tag once, `status` reports `none`, `inProgress`, `inRegistry` or `error`, `whenDefined` waits for a tag |
| `defaultResolve` | The default resolver |
| `defaultLoadResolution` | Loads one resolution: the HEAD check, then registration |
| `hashCode` | The 32-bit string hash behind the print tag suffix |
| `processMarkup`, `printItemAndFloaters`, `mkItem` | The markup pipeline: sanitize and swap tags, split placed models from floaters, build the floater markup |
| `mountItemAlternates`, `ALTERNATES_CLASS`, `CONTENT_LEAD_SURFACE` | Accessibility alternates: `mountItemAlternates({ anchor, item, accessibility })` mounts an item's alternates into `anchor` and returns `{ destroy() }`; the class of the block `<pie-print>` mounts them into; the slot an alternate fills to print |

The types are `Config`, `Item`, `Elements` and `Model` for the config;
`ResolverFn`, `PkgResolution`, `LoadResolutionFn`, `LoadResolutionResult` and
`MissingElFn` for resolution and loading; `NodeResult` for `processMarkup`'s
node list; and `PrintAccessibilityConfig` and `MountedAlternates`.

## License

MIT
