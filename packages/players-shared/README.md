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

## Related Documentation

- [PIE utilities README](src/pie/README.md)
- [i18n README](src/i18n/README.md)
- [PIE element tag/id contract](../../docs/architecture/types-and-utilities-contract.md)
