# TestAttemptSession + Activity Wire Alignment

This note summarizes the recent alignment work between `pie-players` runtime contracts and PIE backend `activity*` wire contracts.

## What We Changed

- Standardized runtime/session naming in `pie-players` to `TestAttemptSession*`.
- Kept backend wire terminology canonical as `activity*` (`activity`, `activityDefinition`, `activitySession`).
- Preserved backend agnosticism in `pie-players` (no backend calls from toolkit/player packages).

## Naming Decisions

- **Backend/domain wire**: `activityDefinition`, `activitySession`, `activity/load|save|score`
- **Player runtime**: `TestAttemptSession`, `TestAttemptSessionTracker`
- **Toolkit/coordinator API**:
  - `testAttemptSessionTracker`
  - `initializeTestAttemptSession(...)`
  - `updateTestAttemptSessionPosition(...)`
  - `recordTestAttemptSessionItemChange(...)`

## Integration Boundary

`pie-players` consumes data and emits runtime updates, but does not persist them.

- Host app responsibilities:
  1. Call backend `activity/load`.
  2. Normalize backend payloads to player/runtime state (`TestAttemptSession` + item sessions).
  3. Feed section navigation/session changes into `TestAttemptSessionTracker`.
  4. Persist via backend `activity/save` and obtain aggregated outcomes via `activity/score`.

## Separation Of Concerns

To avoid muddying contracts, client integrations should keep these concerns separate:

- **Tool state** (`ElementToolStateStore`): ephemeral UI/tool data only.
- **PIE item session data**: authoritative response/scoring input per item.
- **TestAttemptSession**: navigation/progress and item-to-session linkage metadata.

`TestAttemptSession` is intentionally an orchestration layer, not a duplicate store of full item responses or tool state payloads.

## Why This Split

- Keeps open-source `pie-players` reusable across hosts/backends.
- Maintains consistency with existing PIE backend entity model (`Activity*`).
- Avoids ambiguity of `testSession` naming in JS/TS ecosystems by using explicit `TestAttemptSession`.

## Current Scope

- Implemented: naming refactor in `pie-players`, backend activity endpoint alignment (`load`, `save`, `score`), and docs updates.
- Deferred intentionally: host-specific wiring/testing in pieoneer.
