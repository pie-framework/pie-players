# TTS Highlight Target Resolver

Status: Accepted, 2026-06-25

Implementation status: shipped in pie-players. pie-qti, the first host with a
non-identity resolver, adopts it in its own repository.

Owner: PIE Players maintainers

This PRD defines the runtime seam through which a host remaps the DOM range a
TTS speech mark produced to the text the learner sees, while PIE Players keeps
painting and cleanup. It is for hosts that render projected or transformed
content and for maintainers of the TTS pipeline, and it is the only reference
for the seam.

Related architecture:

- [TTS architecture](../accessibility/tts-architecture.md)
- [P0 shared contracts](../architecture/shared-contracts-p0.md)
- [Accessibility runtime patterns](./shared-contracts/accessibility-runtime-patterns.md)

## Problem

TTS highlighting painted the native DOM range each speech mark produced. For
ordinary visible text that range is the text on screen; for projected or
transformed content it is not, because the spoken text and the visible node
differ.

QTI section rendering in `pie-qti` hit this first: its readable TTS projection
differs from the visible interaction markup. Mapping the projection back to
visible content meant monkey-patching private `HighlightCoordinator` methods and
keeping fallback highlight state outside the PIE Players cleanup lifecycle.

## Goals

- Provide an additive, runtime-only TTS highlight target resolver API.
- Keep existing PIE Players TTS word and sentence highlighting behavior as the
  default identity path.
- Let host packages map spoken browser `Range` targets to visible `Range` or
  `HTMLElement` targets without importing or patching private coordinator
  internals.
- Keep QTI-specific projection extraction and mapping in `pie-qti`.
- Keep highlight painting, clearing, and lifecycle cleanup owned by PIE Players.
- Give `pie-qti` a supported seam in place of its private highlight fallback.

## Non-Goals

- No QTI selectors, projection attributes, or QTI text normalization in PIE
  Players.
- No persisted model, session, assessment, tool configuration, or wire-schema
  changes.
- No new readable-content schema.
- No replacement of existing TTS speech mark generation.
- No export of `HighlightCoordinator` as a public API.
- No compatibility layer for older toolkit internals. Compatibility is limited
  to preserving current TTS behavior for consumers that do not provide a
  resolver.

## Package And Export Ownership

Owning package: `@pie-players/pie-assessment-toolkit`, in
`src/services/tts/highlight-target-resolver.ts`.

Public type exports: the package root exports `TTSHighlightContext`,
`TTSHighlightTargetResolver`, `TTSHighlightTargetResolverRuntime` and
`TTSHighlightTargetResolverProvider`. There is no subpath, because the root is
the narrowest existing public path and a `services/` subpath would publish a
directory whose other contents are internal.

Consuming packages or apps:

- `@pie-players/pie-assessment-toolkit` (`<pie-item-scope>`) and
  `@pie-players/pie-section-player` (`<pie-passage-shell>`), which carry a
  host's resolver into the region scope context.
- `@pie-players/pie-tool-tts-inline`, which installs the provider on the TTS
  service.
- `pie-qti`, as the first non-identity resolver consumer.
- Future hosts with projected, virtualized, or shadow-DOM-backed visible text.

The resolver is runtime-only. It must not be placed in serialized tool config,
`QtiSectionToolConfig.provider`, item models, sessions, assessment state, or
published QTI data.

## Contract

```ts
export interface TTSHighlightContext {
  scopeElement?: HTMLElement | null;
  itemId?: string;
  canonicalItemId?: string;
  kind?: string;
  contentKind?: string;
  regionPolicy?: string;
}

export interface TTSHighlightTargetResolver {
  resolveWordRange?(
    range: Range,
    context: TTSHighlightContext,
  ): Range | null | undefined;

  resolveSentenceRanges?(
    ranges: Range[],
    context: TTSHighlightContext,
  ): Array<Range | HTMLElement> | null | undefined;
}

export interface TTSHighlightTargetResolverRuntime {
  context: TTSHighlightContext;
  resolver?: TTSHighlightTargetResolver | null;
}

/** Read at every highlight; a throw counts as no resolver. */
export type TTSHighlightTargetResolverProvider = () =>
  | TTSHighlightTargetResolverRuntime
  | null
  | undefined;
```

The identity fields come from the enclosing shell: `kind` is `"item"` or
`"passage"`, and `itemId`, `canonicalItemId`, `contentKind` and `regionPolicy`
mirror the `<pie-item-scope>` or `<pie-passage-shell>` properties of the same
names (`regionPolicy` defaults to `"default"`).

### Ingress

`TTSService.setHighlightTargetResolverProvider(provider)` takes a provider and
returns a disposer. The service calls the provider at every highlight, so a
service constructed before mount sees a resolver that appears later or changes
on rerender. The provider hands over context and resolver together; the service
reads no runtime context of its own. A disposer clears only the provider it
installed, so an older disposer cannot remove a newer provider, and stopping
playback leaves an installed provider in place.

Custom-element hosts set the `ttsHighlightTargetResolver` property on
`<pie-item-scope>` or `<pie-passage-shell>`. The shell carries it into
`assessmentToolkitRegionScopeContext`, and `pie-tool-tts-inline` installs a
provider for each read that returns the scope's resolver with a context built
from the scope element and the shell's identity. The tool disposes
that provider when the read ends or the tool unmounts.

### Resolution

- The resolver pipeline always runs. Its default is identity: a word returns
  its native `Range`, and a sentence returns its native `Range[]`.
- A missing provider, a provider that returns `null` or throws, a missing
  resolver, or a missing method for the highlight kind uses the identity
  target.
- A method that returns `null` or `undefined` keeps the identity target.
- A method that throws fails open: the error is caught, the identity target is
  painted, and playback continues.

### Validation

The scope is `context.scopeElement`, falling back to the content element being
read; an absent scope accepts every target. A range is in scope when both of
its boundary elements are inside the scope, including across shadow roots.

- A word target that is out of scope, detached, or not a `Range` falls back to
  its native range.
- One sentence entry that is out of scope or neither a `Range` nor an
  `HTMLElement` returns the whole set to native ranges, because a partially
  remapped sentence paints two highlights for one utterance.

## Runtime Flow

![Highlight target resolution: a TTS speech mark gives a native range, the late-bound region scope context is read at every highlight, and the resolver pipeline in TTSService runs an optional host resolver set on the item scope or passage shell; a valid remap inside the scope gives a visible Range or HTMLElement, and a missing, null, invalid or throwing resolver falls back to the default identity resolver; HighlightCoordinator paints either target and clears it on the next highlight, seek, stop, end or error](../img/design-tts-highlight-resolver.excalidraw.svg)

PIE Players owns the full resolver, painter, and cleanup pipeline. The custom
resolver overrides only target selection; it does not replace the default
identity behavior, painting, or cleanup.

## Painting And Cleanup

`HighlightCoordinator` paints every target type the contract allows, with no
separate painter:

- `Range` targets paint through the CSS Custom Highlight API. Where the
  Highlight API is unsupported, no highlight paints.
- `HTMLElement` sentence targets are marked with
  `data-pie-tts-sentence-element` and cleared on the same path as range
  targets.
- A sentence set mixing ranges and elements paints as ranges, each element
  selected by its contents.
- A range over replaced content escalates to an element target, since a range
  highlight does not render there: SVG, images, canvas and `role="img"` for
  words and sentences, plus `math` and `mjx-container` for sentences. Math words
  are tracked per token in the highlight pipeline.

A painted target clears on the next highlight, on seek, and when playback
stops, ends or errors. Section navigation in the assessment player stops TTS,
which clears through the stop path. Unmounting the TTS tool disposes its
provider without clearing a painted target, and a target that becomes invalid
after it is painted stays until one of those triggers.

A host that adopts the resolver keeps no TTS overlay painter of its own and does
not touch `HighlightCoordinator` internals, `ttsSentenceElementHighlights` or
any parallel highlight state.

## Compatibility

This is an additive API. Consumers that do not provide a resolver see the same
TTS highlight behavior as before it.

The resolver must not alter PIE element tag names, IDs, model IDs, session IDs,
slots, `data-*`, `aria-*`, `pie-*`, `config-*`, or `context-*` attributes.

No persisted data migration is required because the resolver is runtime-only.

## Accessibility

TTS highlighting is a visible reading aid used alongside other accommodations.

Acceptance criteria:

- Word and sentence highlights remain perceivable at the same contrast and zoom
  expectations as current TTS highlights.
- Highlight remapping must not obscure captions, transcripts, media controls,
  or essential item content.
- TTS playback continues when resolver logic fails.
- Keyboard and screen-reader operation of the TTS tool must not regress.
- Manual review covers at least one remapped-content scenario where the spoken
  projection differs from visible content.

## Test Plan

`packages/assessment-toolkit/tests/tts-service-highlight-target-resolver.test.ts`
covers:

- the public types and a late-bound provider;
- identity behavior for word and sentence highlighting;
- a word spanning text nodes;
- word remapping from a native `Range` to a visible `Range`;
- sentence remapping from native `Range[]` to visible `HTMLElement` blocks,
  including sentence tracking with word boundaries;
- a throwing resolver failing open to native highlighting;
- a detached range rejected to its native target;
- the latest context read after a scope change;
- an older disposer leaving a newer provider in place;
- a host provider kept across an external stop.

`packages/tool-tts-inline/tests/tool-tts-inline-run-owner.test.ts` covers the
tool dropping its provider when another read takes over.

The section-player Playwright spec `section-player-tts-ssml.spec.ts` proves
propagation through the public runtime surface:

```text
ttsHighlightTargetResolver on pie-item-scope / pie-passage-shell ->
region scope context -> pie-tool-tts-inline setHighlightTargetResolverProvider ->
TTS service/highlight coordinator -> painted highlight target
```

Commands:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

For Playwright-backed TTS checks, run outside the sandbox.

## Rollout And Release Notes

- Changeset required: yes, a patch under the repository's lockstep release
  policy, because this adds public TypeScript and runtime surface.
- Release notes describe this as an additive TTS highlight target resolver for
  projected or transformed content, without QTI-specific framing.
- `pie-qti` verifies its adoption against a published or locally packed fixed
  version set, without local source linking.
