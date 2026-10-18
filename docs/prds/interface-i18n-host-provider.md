# Host-Supplied Interface Locale Provider

Status: Accepted, 2026-10-18

Owner: PIE Players maintainers

This PRD adds the one seam interface-locale adoption left out: how a host hands
the players the provider that resolves their chrome strings. It is for
maintainers of the toolkit, the players and the demo apps, and for a host wiring
the generated locale tier, a message override, or a provider of its own.

Related architecture:

- [Interface locale](../architecture/internationalization.md#interface-locale)
  and [Rollout](../architecture/internationalization.md#rollout) in the
  internationalization note — the composition context this PRD feeds, and the
  rollout item it is
- [Interface locale adoption](../architecture/i18n-interface-locale-adoption.md) —
  the shipped decisions this PRD leaves in place: `locale` names the locale,
  `en-US` with no input, no browser detection
- [Composition context](../architecture/composition-context.md) — publisher,
  resolver, change signal and graceful default, which the seam must preserve
- [The optional generated tier](../../packages/pie-i18n-generated/README.md) —
  the first consumer

## Problem

`@pie-players/pie-players-shared/i18n` publishes a host-facing engine.
`createPieI18n(config)` takes an `I18nConfig` whose `availableLocales`,
`loadCatalog` and `customMessages` are documented for a deployment that "can
override one label without forking a catalog, and can supply a locale we do not
ship", and the `I18nProvider` contract says "a host is free to implement it over
i18next, ICU MessageFormat or its own catalog rather than take ours". The
toolkit's runtime context declares `i18n?: I18nProvider` "so a host that supplies
its own `I18nProvider` implementation reaches all of them".

No element surface accepts one. Four sites construct the provider, each with no
host input: `PieAssessmentToolkit.svelte` (published on the runtime context, so
it is the provider every tool, section card and overlay resolves),
`PieItemPlayer.svelte` in `item-player` (the standalone element's own chrome),
`AssessmentPlayerDefaultElement.ts` (the reference assembly's navigation chrome)
and `ItemSessionDebugger.svelte`. Each calls `createPieI18n()` and drives
`setLocale` from its `locale` attribute. Three consequences:

- `@pie-players/pie-i18n-generated` cannot be wired into any player. Its README
  shows how to compose its loaders into `createPieI18n`; the composed provider
  has nowhere to go. The tier exists and is unreachable.
- `customMessages` cannot reach chrome: a one-label override, a locale this
  repository does not ship, or the `en-XA`/`ar-XB` pseudo-locales `pseudoLocalize`
  produces — the practice
  [Pseudo-localization](../architecture/internationalization.md#pseudo-localization)
  documents, which a host can register but no player can receive.
- A host's own `I18nProvider` cannot be installed. The contract is a promise the
  runtime does not keep, which the design principles call a defect.

A second gap surfaced while tracing the chain. `getItemPlayerParams` and
`getPassagePlayerParams` in `section-player-view-state.ts` hand each
`<pie-item-player>` a section mounts its `config`, `env`, `session`, the player
definition's attributes, and the heading context — and neither `locale` nor a
provider. Every nested item player therefore constructs its own English provider
whatever the section's `locale`, and its five chrome strings
(`player.configurationError`, `player.playerError`,
`player.authoringBackendError`, and the resize-handle `aria-label`s
`player.passageWidthA11y` and `player.resizePassageAndQuestionA11y`) render
English inside a Dutch section. The seam closes this as a by-product, because the
right thing to forward is the provider.

## Goals

- One property, one type, every level: `i18n: I18nProvider` — the name the
  runtime context, `ToolSurfaceServices`, and every tool and card component
  already use for the same object.
- A provider a host supplies reaches all chrome: the toolkit's toolbar and
  panels, every tool, the section's cards and overlays, the item players the
  section mounts, a standalone item player, and the reference assembly's
  navigation.
- The generated tier, host message overrides, pseudo-locales, and a host-built
  provider all wire through it with no further surface.
- Everything the adoption record settled stays: `locale` names the locale, no
  input renders `en-US`, the browser's language is never read, a failed load
  renders English, and a resolver with no publisher gets `getDefaultI18n()`.
- Additive, with no listed host affected.

## Non-Goals

- Strings PIE elements render. pie-elements-ng's catalogs resolve through its
  own page registry and `registerMessages`; its Phase 2 gives elements the
  interface *locale* through `@pie-players/pie-context`, not the players'
  provider, because element bundles are third-party and release independently.
- Content language (`Env.locale`, rollout item 2) and in-item alternates.
- The print player, which resolves the English default and has no `locale`
  attribute either; see [Open Questions](#open-questions).
- Changes to `SimpleI18n`'s resolution, fallback or loading.
- A second, configuration-shaped channel beside the provider; see
  [Rejected alternatives](#rejected-alternatives).

## Package And Export Ownership

- Owning package of the type: `@pie-players/pie-players-shared`. `I18nProvider`
  is already exported from `@pie-players/pie-players-shared/i18n` and
  `…/i18n/types`; this PRD adds no export there.
- Owning package of the runtime key: `@pie-players/pie-assessment-toolkit`.
  `RuntimeConfig` in `runtime/core/engine-resolver.ts`, exported through
  `@pie-players/pie-assessment-toolkit/runtime/engine`, gains `i18n?`.
- Element surfaces: the `i18n` JS property on `<pie-assessment-toolkit>` and on
  `<pie-item-player>`; `runtime.i18n` on the four section-player layouts and
  `pie-section-player-base`; `sectionPlayerRuntime.i18n` passes through
  `<pie-assessment-player>` unchanged.
- Consuming packages and apps: `section-player`, `item-player`,
  `assessment-player`; `apps/section-demos` as the acceptance demo.
- Runtime environment: browser custom elements. The type carries no DOM or
  framework reference, so a host composes the provider in any module and a test
  constructs one in Node.

## Contract Shape

```ts
import type { I18nProvider } from "@pie-players/pie-players-shared/i18n";

// @pie-players/pie-assessment-toolkit/runtime/engine
export type RuntimeConfig = {
	// …existing keys…
	/**
	 * The interface-locale provider the toolkit publishes on its runtime
	 * context, in place of the one it would construct: the catalogs it can
	 * serve, their loaders, and any host messages. `locale` on the element
	 * still names the locale; a provider given with none set keeps the locale
	 * its owner gave it.
	 */
	i18n?: I18nProvider;
};
```

| Element | Surface | Reaches |
| --- | --- | --- |
| `pie-section-player-*` (four layouts, base) | `runtime.i18n` | forwarded to the inner toolkit's `i18n`, the way `runtime.toolContextResolvers` and `runtime.contentLanguage` are forwarded today |
| `<pie-assessment-toolkit>` | `i18n` JS property, `type: "Object", reflect: false` | published as `runtimeContext.i18n`; every tool, card, overlay, and nested item player |
| `<pie-item-player>` | `i18n` JS property | the element's own chrome and the renderer it wraps |
| `<pie-assessment-player>` (reference) | `sectionPlayerRuntime.i18n` | its own navigation chrome and, through the section player, everything below |

A host wiring the generated tier and one override:

```ts
import {
	BUNDLED_LOCALES,
	createPieI18n,
	loadBundledCatalog,
} from "@pie-players/pie-players-shared/i18n";
import {
	GENERATED_LOCALES,
	loadGeneratedCatalog,
} from "@pie-players/pie-i18n-generated";

const i18n = createPieI18n({
	availableLocales: [...BUNDLED_LOCALES, ...GENERATED_LOCALES],
	// Bundled first: a reviewed catalog wins over a generated one for the
	// same tag, which is what makes generated-to-reviewed promotion a no-op
	// for a wired host.
	loadCatalog: (locale) =>
		loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale)),
	customMessages: {
		"nl-NL": { toolkit: { resizeWindow: "Venstergrootte aanpassen" } },
	},
});

const player = document.querySelector("pie-section-player-splitpane");
player.runtime = { assessmentId, i18n };
player.setAttribute("locale", "th-TH");
```

### Rules

1. **Source.** A player uses the provider it is given, else constructs
   `createPieI18n()` exactly as today. Given means the `i18n` property on the
   toolkit or the item player, `runtime.i18n` on a layout, or
   `sectionPlayerRuntime.i18n` on the reference assembly.
2. **Locale driver.** The element's `locale` attribute, and nothing else, drives
   `setLocale` on whichever provider the player uses. With no attribute, a
   provider the player constructed resolves `en-US`, as today; a provider the
   player was given keeps the locale its owner set and is never auto-driven.
   Two cases need that: a nested item player holds the section's shared provider
   and must not reset it, and a given provider's `getLocale()` is its owner's
   statement, so the browser's language still never enters. The recommended host
   pattern is therefore a provider without `locale` and the attribute with it:
   `createPieI18n({ locale })` names a tag without loading its catalog — that is
   `initialize`'s or `setLocale`'s job — and the attribute does both.
3. **One provider, one driver.** A provider belongs to one `locale` driver. A
   host mounting two players at different locales constructs two providers; the
   catalog modules are shared by the module loader's cache, so the second costs
   a `Map`, not a fetch. `withLocale` views stay a component-level facility, not
   this seam's.
4. **Publication and change signal.** Unchanged in mechanism: the toolkit
   publishes the provider as `runtimeContext.i18n` and its `getLocale()` as
   `locale`, subscribes to it, and republishes on every notification. The
   property is reactive like `toolContextResolvers`: a host that sets it after
   mount gets a resubscribe, a re-applied `locale`, and a republish.
   `subscribe` is optional on the contract and the toolkit treats it so; a host
   implementation without it has no change signal of its own, and its strings
   refresh only when the context republishes for another reason. The host
   documentation says so.
5. **Forwarding to nested item players.** `getItemPlayerParams` and
   `getPassagePlayerParams` add `i18n` to `props`, beside the heading context
   and before the host's `runtime.player` props, so a host naming the same prop
   there overrides the composition's value deliberately, as it does for
   `baseHeadingLevel`. The value is `runtimeContext.i18n` — the provider
   instance, whose identity is stable — and not the facade
   `resolveInterfaceI18n` returns, whose identity changes on every republish
   and would re-set the property on each. The nested player subscribes to it
   for its own re-render and, by rule 2, sets no locale.
6. **Minimal providers.** A host implementation may omit the optional members.
   Consumers already go through the facade `resolveInterfaceI18n` returns,
   which fills `plural`, `getDirection` (defaulting `ltr`), `hasKey` and
   `subscribe`. An RTL deployment's implementation must provide
   `getDirection`, since the chrome's `dir` comes from it.
7. **Graceful defaults.** Unchanged: no input renders English; a failed catalog
   load is reported as a recoverable `i18n-locale-load` framework error and
   every key resolves through the fallback chain; a resolver with no context
   gets `getDefaultI18n()`.

A host must be able to set the property before the element upgrades: Host P
assigns item-player properties before `pie-item-player` is defined, and Svelte
adopts a pre-upgrade value only for a name in the element's declared `props`
map. Both `i18n` properties are therefore declared in their `props` maps as
object properties with `reflect: false`, beside `toolContextResolvers`.

### Where each constructor goes

| Site | Today | After |
| --- | --- | --- |
| `PieAssessmentToolkit.svelte` | `createPieI18n()` | `i18n ?? createPieI18n()`, driven by `locale` per rule 2 |
| `PieItemPlayer.svelte` (`item-player`) | `createPieI18n()` | `i18n ?? createPieI18n()`; the renderer already takes the player's provider through its `i18n` prop, and `ItemSessionDebugger` takes one through the same prop instead of being hardwired to its own |
| `AssessmentPlayerDefaultElement.ts` | `createPieI18n()` | `sectionPlayerRuntime?.i18n ?? createPieI18n()`; the runtime passes through to the section player unchanged |
| `PieSectionPlayerBaseElement.svelte` | resolves the toolkit's context | unchanged; forwards `runtime.i18n` to the toolkit's `i18n` |

### Rejected alternatives

- **A configuration struct** — `runtime.i18n = { availableLocales, loadCatalog,
  customMessages }`, the player constructing from it. It restates `I18nConfig`
  under a second name, cannot carry a host's own implementation, and every
  documented host example — `createPieI18n` in the generated tier's README,
  `initialize`, `addCustomMessages` — already yields a provider instance. If a
  host ever wants the struct form, widening the accepted type is additive.
- **A page-level registry** keyed by `Symbol.for`, as pie-elements-ng uses for
  element catalogs. Elements need one because they are third-party bundles with
  no container contract. Players have a container: the provider is already a
  composition context the toolkit publishes, per-instance so two players on a
  page can speak two languages, and a global would bypass the publisher and its
  change signal.
- **`hooks.i18n`** on the layout shells. `hooks` is layout-shell host data the
  runtime engine never sees — `engine-resolver.ts` lists it among the surfaces
  with no runtime mirror — and the provider is engine data, published on the
  runtime context and consumed by tools. That file's tiering rule puts objects
  and callbacks on `runtime` and primitives on attributes, which is exactly
  `i18n` beside `toolContextResolvers` and `locale` as an attribute.
- **Attribute-only** — a `locales` attribute naming extra tags, with the core
  importing the generated package. It binds the core to the optional package
  the tier exists to keep out of it, and carries neither messages nor an
  implementation.
- **Extending `BUNDLED_LOCALES`** in the core. That is the bundle-size trade the
  generated tier was created to avoid, and it is not a seam for host messages
  at all.
- **A readable property exposing the toolkit's active provider.** A host that
  wants runtime overrides supplies the provider and keeps the reference; the
  getter earns nothing until a host asks for one.
- **An eager catalog load in `createPieI18n({ locale })`.** It would move the
  locale tag before the strings — `getLocale()` ahead of a catalog still in
  flight — and swallow the load error the attribute path reports as a
  recoverable framework error. The attribute names the locale and does both.

## Compatibility

Surfaces this PRD touches:

- `pie-item-player` properties: one new optional `i18n`. Hosts V, P, M and R
  mount the element and set properties imperatively; a new optional property
  collides with none of theirs, and pre-upgrade assignment is covered by the
  `props`-map declaration above. No event, method, or attribute changes.
- Section-player `runtime` keys: one new optional `i18n`. Hosts A, R, C and S
  build `runtime` objects; none carries an `i18n` key, so none collides.
- `<pie-assessment-toolkit>`: one new optional `i18n` property. No host mounts
  the toolkit element — Host A declares the package but its source imports only
  the splitpane layout element — so the property is consumed by the section
  player's forwarding, not by a host.
- The runtime context: `i18n?: I18nProvider` and `locale` already exist on
  `AssessmentToolkitRuntimeContext`; neither changes type or meaning.

Not touched: PIE element runtime or controller contracts, versioned
`pie-*--version-*` tag names, contract attributes, section session or
completion state, assessment routing or submission, persisted or wire data.

The [consumer pad](../integrations/consumer-api-dependencies.md) records that no
host passes `locale` to any `pie-*` element, so the one rendering change — the
section's nested item players following its `locale` — is visible to no host
today, and a host that supplies nothing renders what it renders now.
`PieAssessmentToolkit.svelte`, `PieItemPlayer.svelte` and `engine-resolver.ts`
are `check:consumer-pad` trigger files, so the implementation records the
addition in the pad the way the chrome i18n adoption paragraph did, under the
same additive classification.

No `pie-item` contract compatibility exception is needed; nothing is stripped,
normalized, or shimmed.

## Data Ownership And Host Responsibilities

PIE owns:

- The default provider, the English catalog, and the bundled and generated
  catalogs with their loaders.
- Resolution, fallback and loading semantics; publication on the runtime
  context; the change signal; forwarding to nested players.
- Driving the provider's locale from the `locale` attribute, and nothing else.

Hosts own:

- Which locales a deployment offers and where their catalogs come from
  (`availableLocales`, `loadCatalog`), any message overrides
  (`customMessages`), and any provider implementation of their own.
- The deployment's locale decision — an LTI `launch_presentation_locale`, an
  AfA `language-of-interface` preference resolved through policy, or a setting —
  which lands in the attribute.
- The lifetime of a provider they supply. The player never disposes it, and one
  instance serves one `locale` driver (rule 3).

## Serialization And Versioning

No persisted or wire-facing data. The provider is a live object: it is never
serialized, never reflected to an attribute, and never reaches `model`,
`session` or `env`. A host that stores a locale choice stores the tag, as it
does today.

## Accessibility

No new UI. Two effects on existing output:

- Inside a section, the item players' chrome strings and accessible names — in
  particular the `aria-label` of the passage-and-question resize divider —
  follow the interface locale, where today they stay English under a chrome
  subtree stamped with another `lang`. That is WCAG 2.2 3.1.2 hygiene: an
  English accessible name inside a `lang="nl"` subtree is announced with the
  wrong voice.
- Direction keeps coming from the provider's `getDirection()`; a host
  implementation that omits it renders `ltr`, which rule 6 states.

Pseudo-localization becomes exercisable end to end: a host registers the
transformed English catalog under `en-XA` or `ar-XB` through `customMessages`
and sets the attribute, and the chrome shows truncation, concatenation and bidi
defects before a reviewer sees a string.

## Standards Or Adapter Impact

No adapter data is produced. The seam is where the host's side of the standards
in the
[standards section](../architecture/internationalization.md#the-chrome-engine-against-web-and-unicode-standards)
meets the players: the locale an LTI launch or a PNP preference resolves to
arrives as the attribute, and the catalogs a host's localization toolchain
produces arrive as the provider. No conformance is claimed.

## Test Plan

Required coverage:

- Toolkit (`bun test`): a given `i18n` is the instance the context publishes;
  `locale` drives it; with no attribute its locale is untouched; setting the
  property after mount re-publishes; a provider without `subscribe` mounts.
- Section player: `getItemPlayerParams` and `getPassagePlayerParams` carry
  `props.i18n` holding the context's provider, by identity, and a
  `runtime.player` prop of the same name wins.
- Item player: a given provider's `customMessages` render; with no attribute
  `setLocale` is not called on it; with one, it is.
- Reference assembly: `sectionPlayerRuntime.i18n` reaches both its own chrome
  and the section element's `runtime`.
- Demos (Playwright, outside the sandbox): the `interface-locale` demo renders
  a generated locale and `en-XA` through `runtime.i18n`, which is the
  acceptance demo for the generated tier.

Commands:

```sh
bun run typecheck
bun run test
bun run check:api-report
bun run check:custom-elements-manifest
bun run check:consumer-pad
bun run check:capability-neutrality
bun run check:player-tool-boundaries
```

For the custom-element packaging and consumer-boundary surface, also run the
checks [AGENTS.md](../../AGENTS.md#custom-element-import-and-packaging-boundaries)
lists, then `check:custom-elements:dist` after a build. Playwright-backed tests
run outside the sandbox; see
[Playwright and sandboxed execution](../../AGENTS.md#playwright-and-sandboxed-execution).

## Rollout And Release Notes

- Changeset required: yes, `patch`, for `@pie-players/pie-assessment-toolkit`,
  `@pie-players/pie-section-player`, `@pie-players/pie-item-player` and
  `@pie-players/pie-assessment-player`, stating that no listed host is
  affected.
- Migration notes: none. A host opts in by supplying a provider; everything
  else renders as before.
- Documentation updates: the players-shared i18n README gains the wiring step
  after the construction step; the generated tier's README example ends by
  setting `runtime.i18n` instead of stopping at `createPieI18n`; the section
  player's README lists `runtime.i18n` with the other runtime keys; the item
  player's documentation lists the property; the internationalization note's
  rollout item 7 moves to done; the consumer pad records the addition.
- Sequencing: the generated tier's wave-1 catalogs (pie-players PR #789) merge
  independently; this PRD's implementation is what makes them, and
  `pseudoLocalize`, reachable from a player.
- Release risk: low. Additive surfaces, behavior-preserving without input, and
  the only rendering change needs a `locale` no host sets.

## Open Questions

- Should `pie-print` take the same `i18n` property? Its labels (the
  accessibility-alternates headings) resolve the English default today, and it
  has no `locale` attribute either; both would come together, and print's
  language story mostly *is* content language, which is rollout item 2.
