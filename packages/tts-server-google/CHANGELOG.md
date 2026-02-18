# @pie-players/tts-server-google

## 0.1.3

### Patch Changes

- Release patch versions for all deployable packages.
- Updated dependencies
  - @pie-players/tts-server-core@0.1.3

## 0.1.2

### Patch Changes

- ce5211a: Release all packages after the NodeNext/ESM migration updates.

  This includes explicit `.js` relative import specifiers, NodeNext TypeScript configuration alignment, and dependency/version housekeeping needed for consistent package builds and publishing.

- Updated dependencies [ce5211a]
  - @pie-players/tts-server-core@0.1.2

## 0.1.1

### Patch Changes

- ce22976: Release all public PIE packages with the latest toolkit/loader/tag-name updates, publish metadata fixes, and CI/publish hardening improvements.
- Republish packages with correctly resolved internal dependency versions in published metadata.

  This release uses publish-time workspace range resolution, so development keeps `workspace:*`
  while npm artifacts publish concrete dependency ranges.

- Updated dependencies [ce22976]
  - @pie-players/tts-server-core@0.1.1
