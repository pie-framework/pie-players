# @pie-players/pie-tool-calculator

## 0.1.6

### Patch Changes

- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.5

## 0.1.5

### Patch Changes

- ce22976: Release all public PIE packages with the latest toolkit/loader/tag-name updates, publish metadata fixes, and CI/publish hardening improvements.
- Republish packages with correctly resolved internal dependency versions in published metadata.

  This release uses publish-time workspace range resolution, so development keeps `workspace:*`
  while npm artifacts publish concrete dependency ranges.

- Updated dependencies [ce22976]
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.4
  - @pie-players/pie-players-shared@0.2.2

## 0.1.4

### Patch Changes

- 6f7d346: Fix Desmos calculator authentication by including API key in script URL query parameter. The Desmos API requires the API key to be passed when loading the calculator library script.
- Updated dependencies [6f7d346]
  - @pie-players/pie-assessment-toolkit@0.2.3

## 0.1.3

### Patch Changes

- Fix Desmos calculator authentication by including API key in script URL query parameter. The Desmos API requires the API key to be passed when loading the calculator library script.
- Updated dependencies
  - @pie-players/pie-assessment-toolkit@0.2.2

## 0.1.2

### Patch Changes

- Updated dependencies
- Updated dependencies [46295ee]
  - @pie-players/pie-assessment-toolkit@0.2.1
  - @pie-players/pie-players-shared@0.2.1

## 0.1.1

### Patch Changes

- Updated dependencies [8584a3f]
  - @pie-players/pie-assessment-toolkit@0.2.0
  - @pie-players/pie-players-shared@0.2.0
