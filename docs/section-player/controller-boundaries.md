# Controller Boundaries

This package follows a controller-first boundary:

- `SectionController` is the domain authority for section-level state (navigation, canonical item-session aggregation, persistence snapshots).
- Custom elements (`pie-section-player*`, shell elements) are transport adapters only (DOM events, context bridging, host wiring).
- Item-level controller behavior is aligned by shared session contracts, but section runtime does not create/manage per-item controller instances.

## Why section does not instantiate item controllers

Keeping `SectionController` aggregate-first avoids dual ownership of item state and lifecycle fan-out across many item instances.

Revisit this only if there is a concrete requirement for:

- independent per-item persistence/rehydration lifecycles,
- per-item conflict/version resolution,
- per-item plugin hook pipelines that cannot be represented as pure helpers.
