# PIE Players CLI

Internal CLI utilities for package, local-pack, and preloaded-player workflows.

## Usage

From the repository root:

```bash
bun run cli --help
```

Common command families:

- `pie-packages:*` for preloaded-player package generation and local test
  project creation. Generated preloaded builds are transitional: hosts move to
  pie-elements-ng packages installed from npm, all from one release with exact
  pins, and registered as ESM with `registerPreloadedElements`
  ([Registering elements from npm](../../docs/item-player/loading-strategies.md#registering-elements-from-npm)).
- `pack:*` for local package packing workflows.

## Related Documentation

- [Preloaded player workflow](../../docs/preloaded-player/readme.md)
- [Local packaging strategy](../../docs/setup/library-packaging-strategy.md)
- [Publishing contract](../../docs/setup/publishing.md)
