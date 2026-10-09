# @pie-players/pie-context

## 0.3.75

### Patch Changes

- bb9c165: A subscribing `ContextConsumer` installs one `ContextRoot` per document, on `documentElement` and shared by every copy of the package on the page, so a provider that connects late answers requests made before it. `ensureDocumentContextRoot` is exported. `connectContextWithRetry` relies on that replay and no longer polls. A provider answering a consumer again keeps its subscription, so updates keep reaching it after a re-request.
  
  The toolkit and the shells no longer attach context roots of their own. A shell's registration carries the `runtimeId` of the toolkit that answered it, a toolkit claims an event carrying a `runtimeId` only when the id is its own, and a shell that a nearer toolkit takes over moves its registration to it. `ShellScope.send` dispatches an event addressed the same way, holding up to 50 until a toolkit answers, and the shells and `<pie-item-scope>` send their internal events through it. A nested toolkit inherits an outer one that is already providing when it connects; one that finds none keeps the coordinator it builds.
  
  `waitForSectionController` resolves on `toolkit-ready` instead of polling, with the same timeout and result.
- 9464e2b: Default section and assessment persistence store a session only under an attempt id, and without one neither read nor write, so a later learner on a shared device no longer resumes the previous learner's session. A context provider that disconnects hands its subscribers to the nearest provider left, or back to itself when it reconnects, and the context events are built on the `Event` of their target's window, so a copy of pie-context loaded before a DOM emulator registered dispatches on it.
- d9f56e8: The toolkit root exports 185 names instead of 326: the names only tool packages use moved to `./tools/registration`, and the names nothing imports are removed, among them the backend activity-session adapters, the item loader and the session-storage helpers. The TypeScript examples in the READMEs match the current API.

## 0.3.74

### Patch Changes

- fe5557f: Adds `connectContextWithRetry`, which subscribes a host to a context whose
  provider may connect after it.

## 0.3.73

No changes in this release.

## 0.3.72

## 0.3.71

## 0.3.70

## 0.3.69

## 0.3.68

## 0.3.67

## 0.3.66

## 0.3.65

## 0.3.64

## 0.3.63

## 0.3.62

## 0.3.61

## 0.3.60

## 0.3.59

## 0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.55

## 0.3.54

## 0.3.53

## 0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.

## 0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.

## 0.3.2

## 0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

## 0.1.2

### Patch Changes

- beffcc0: Release all publishable packages.

## 0.1.1

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
