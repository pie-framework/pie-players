---
name: svelte-subscription-safety
description: Prevent reactive loops and stale subscriptions in Svelte 5 + runes code. Use when writing or reviewing `$effect`, controller subscriptions, debugger panels, lifecycle resubscribe logic, or any code that wires reactive state to imperative APIs. Trigger on cues like "$effect", "untrack", "subscribe", "resubscribe", "lifecycle", "queueMicrotask", "infinite loop", "reactive loop", "debugger panel", "controller".
---

# Svelte Subscription Safety

Canonical rule: [`.cursor/rules/svelte-subscription-safety.mdc`](../../../.cursor/rules/svelte-subscription-safety.mdc).

## Why this exists

`$effect` tracks every reactive read in its body. If setup logic mutates
reactive state it just read (or read indirectly through a controller
getter), the effect re-runs every microtask and produces hard-to-debug
loops. Subscriptions also need stable-key idempotency so React-style
"re-render and resubscribe" doesn't churn the controller.

## Effect body rules

- Treat `$effect` as **wiring-only**: setup/teardown subscriptions and
  observers, not UI state mutation.
- If setup must read/write reactive state (for example seeding debugger
  rows from `getRuntimeState()`), wrap it in
  `untrack(() => { ... })` so it does not contribute to the effect's
  dependency set.
- Always return a teardown function that unsubscribes, removes listeners,
  and clears observers.

## Subscription rules

- Make subscription setup **idempotent**: if the target keys
  (`sectionId` / `attemptId`) are unchanged and a subscription exists,
  return early.
- Compare **stable keys**, not controller / object identity. Controllers
  may be reassigned across HMR or lifecycle events without the underlying
  target changing.
- For lifecycle-triggered resubscribe, queue with `queueMicrotask` to avoid
  synchronous re-entrant update chains.
- On `"disposed"` lifecycle events, **explicitly detach** the current
  subscription before queueing a rebind.

## Quick pattern

```ts
$effect(() => {
  void sectionId;
  void attemptId;
  untrack(() => {
    ensureSubscription();
    setupLifecycleListener();
  });
  return () => teardownAll();
});
```

## Debugger / tooling panels

- Debugger panels are **consumers, not state owners**. Read controller
  state via `getRuntimeState()` / `getSession()` and forward controller
  events; do not maintain a parallel store seeded by event replay.
- Initialize panel state by reading controller state explicitly. Event
  replay is for streaming updates, not for baseline.

## Custom-element package workflow note

Consumer apps import package `dist`, not `src`. After changing a
custom-element package source file, **rebuild that package** before
validating. If runtime behavior appears unchanged after source edits,
suspect stale `dist` first. See the `build-before-tests` skill.

## Related skills

- `build-before-tests` — for the rebuild-then-test discipline.
- `custom-elements-boundaries` — for consumer import rules.
