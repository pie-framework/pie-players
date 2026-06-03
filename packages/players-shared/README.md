# PIE Players Shared

Shared runtime utilities for the `@pie-players/*` player suite. This package is
for framework code and host integrations that need the same loader, PIE config,
security, object, i18n, or type helpers used by the player packages.

## Public Exports

```ts
import { safeLocalStorageGet } from "@pie-players/pie-players-shared";
import { makeUniqueTags } from "@pie-players/pie-players-shared/pie";
import { normalizeItemPlayerStrategy } from "@pie-players/pie-players-shared";
```

Supported subpaths are declared in `package.json`:

- `@pie-players/pie-players-shared`
- `@pie-players/pie-players-shared/loader-config`
- `@pie-players/pie-players-shared/security`
- `@pie-players/pie-players-shared/object`
- `@pie-players/pie-players-shared/types`
- `@pie-players/pie-players-shared/pie`
- `@pie-players/pie-players-shared/pie/tag-names`
- `@pie-players/pie-players-shared/loaders`
- `@pie-players/pie-players-shared/server/npm-registry`
- `@pie-players/pie-players-shared/i18n`

## Browser ESM Element Contract

The canonical producer-side contract lives in
`pie-elements-ng/docs/PIE_ELEMENT_CONTRACT.md`. The loader assumptions here must
stay aligned with that document.

The ESM element loader consumes static `@pie-element/*` browser entries such as
`dist/browser/delivery/index.js`; it does not transform element packages through
CDN `+esm` entry points. Browser ESM elements must publish exact shared runtime
metadata in `package.json` under `pie.browserSharedDependencies`.

jsDelivr is the default npm CDN provider. Hosts can opt into `esm.sh` with
`loaderOptions.esmCdnProvider = "esm.sh"` and `loaderOptions.esmCdnUrl =
"https://esm.sh"`. For `esm.sh`, PIE package artifacts are loaded from
`raw.esm.sh` while shared browser dependencies are loaded from `esm.sh`.
Provider names are open-ended: custom/internal providers can pass their own name
when they follow the jsDelivr-compatible package-file URL layout, or pass a
provider object when package artifacts and shared dependencies need different
route builders.

`dependencies` and `peerDependencies` are not used as fallback runtime contracts.
If multiple elements request different minor or patch versions of a shared
singleton such as React, the loader chooses the highest same-major version and
emits console plus instrumentation warnings. Different major versions fail the
load and are also reported through console and instrumentation.

Preloaded mode means the host has already registered the expected custom element
tag; it is not a separate package format. IIFE mode remains supported through the
same package exports and controller compatibility shim used by legacy builders.

## Related Documentation

- [PIE utilities README](src/pie/README.md)
- [i18n README](src/i18n/README.md)
- [PIE element tag/id contract](../../docs/architecture/types-and-utilities-contract.md)
