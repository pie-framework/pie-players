# PIE Players CLI

Internal CLI utilities for package, local-pack, and preloaded-player workflows.

## Usage

From the repository root:

```bash
bun run cli --help
```

Common command families:

- `pie-packages:*` for preloaded-player package generation and local test
  project creation. Generated preloaded builds are transitional; see
  [Registering elements from npm](../../docs/item-player/loading-strategies.md#registering-elements-from-npm).
  The build commands' `--speechLocales` sets the math speech locales a build
  ships ([configs](../../configs/preloaded-player/README.md)).
- `pack:*` for local package packing workflows.

## Related Documentation

- [Preloaded player](../../docs/preloaded-player/readme.md) and its [builds and CI/CD](../../configs/preloaded-player/README.md)
- [Local packaging strategy](../../docs/setup/library-packaging-strategy.md)
- [Releasing](../../docs/setup/publishing.md)
