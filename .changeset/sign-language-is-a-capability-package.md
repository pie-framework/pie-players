---
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-theme": patch
---

Signing becomes a capability package. New `@pie-players/pie-tool-sign-language`, and no package in the player names signing any more.

The last capability-specific code in the generic core was signing's: the toolkit validated `sign-language` catalog cards, and section-player's item card knew the `signLanguage` support id, the catalog type, the language-matching rule and the region element by name. So the one accommodation PIE most needs hosts to be able to add was the one thing only we could add.

## The new package

`@pie-players/pie-tool-sign-language` owns `signLanguageRegistration` (`activation: "region"`, `surfaces: ["item-media"]`, `supportedLevels: ["item"]`, `requiresAuthoredContent`), the card validators and language matching that were `services/sign-language-cards.ts` in the toolkit, the content resolver that was the signing half of section-player's `section-item-media.ts`, and `<pie-tool-sign-language>`, which was `SectionItemMediaRegion.svelte`.

It is authored against `@pie-players/pie-assessment-toolkit/tools/internal` — the same entry point our packaged registrations use — and it is the worked example of a capability contributed from outside the player. A host opts in with two lines:

```ts
import { signLanguageRegistration } from "@pie-players/pie-tool-sign-language";
registry.register(signLanguageRegistration);
```

Importing the package registers the element, so there is no module-loader entry to add.

**Deliberately not in `createPackagedToolRegistry` or `DEFAULT_TOOL_MODULE_LOADERS.`** An accommodation with an authored-content dependency is a deployment's decision: a default that granted it would hand signing to every learner whose item happened to carry a card. The `apps/section-demos` `sign-language` route now registers it itself, which is the demonstration that a host can contribute a capability with no id of ours involved.

## What section-player kept and what it lost

`SectionItemCard.svelte` iterates `getToolsBySurface("item-media")`, decides each capability against **its own** `pnpSupportIds`, calls its `requiresAuthoredContent.resolve`, and mounts through `ToolRegistry.renderForSurface`. It names no capability, no support id, no catalog type and no element tag, and it does not depend on the signing package — `check:player-tool-boundaries` forbids even the string.

The region's own layout stays here, because it is the card's geometry rather than the capability's: `MEDIA_REGION_*`, `clampMediaRegionPercent`, `mediaRegionPercentFromDrag` and `SectionCardSplitDivider`. The three `--pie-section-player-item-media-*` tokens keep their names — hosts set them and PIE-880 is in testing against them — but the registry now records the signing package as their owner.

Two behaviours the old file documented are preserved and re-keyed generically, because both were load-bearing: the `onCatalogsChange` re-resolve with a resolve-once-on-subscribe, and the write-only-when-the-signature-changed guard. That guard is not an optimisation. Re-rendering the card re-applies `item` on `<pie-item-shell>`, which re-registers the item's catalogs, which makes the resolver emit again; one unconditional write per emission makes the cycle self-sustaining and Svelte aborts at its depth limit with the DOM half-applied.

## Contract changes

`isVisibleInContext` is now optional on `ToolRegistration`, required for the two toolbar activations and rejected only when present and not a function. A region capability has no toolbar presence to be relevant to, and the question it would answer — is there anything to show here — is `requiresAuthoredContent`. A registration that omits it is never returned by `getVisibleTools`. Callers that invoke it on a registration they wrap need `?.` — the one in-repo case was a demo decorator.

`applyMediaFragment` reached the public surface through `sign-language-cards.js`; it is now exported from `services/catalog-media.js` directly, along with `isSafeMediaSrc`, `normalizeMediaSources`, `normalizeMediaFragment` and `trimmedOrUndefined` — the validators any capability package needs to read a media payload. The signing-specific exports (`SIGN_LANGUAGE_CATALOG_TYPE`, `AMERICAN_SIGN_LANGUAGE`, `describeSignLanguage`, `isSignLanguageCard`, `matchesRequestedSignLanguage`, `resolveSignLanguageMedia`, `SignLanguageMedia`) move to the new package.

`packages/players-shared`'s `SignLanguageCardPayload` stays. It is authored wire data alongside `CatalogCard`, and a published shape for a standard support id is not a core dependency on a capability — the same argument that exempts `pnp-standard-features.ts`.

## Behaviour

Unchanged, and that is the whole point. PIE-880 is in testing, so the guard is that its specs pass with import-path edits and **no assertion changes**: `section-player-sign-language-region.spec.ts` and `pie881-imported-asl-integration.spec.ts` (14 specs, including the re-registration-loop and keyboard-divider cases), plus the unit tests, now split between `sign-language-content.test.ts` in the new package and the sizing half left behind.

`check:fixed-versioning` treated a 404 from npm as a failure, so adding any publishable package broke it. A never-published package is now reported and excluded from the version-sequence comparison; a network or auth failure still stops the gate, because "cannot tell" must not read as "fine".
