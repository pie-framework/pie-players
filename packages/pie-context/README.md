# @pie-players/pie-context

Framework-agnostic Context Protocol helpers for PIE web components.

This package implements the Web Components community
[`context-request` protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md)
so orchestration/runtime dependencies can be shared without prop drilling.

A tool, PIE element or player component needs it to read a fact only its
container knows, such as its heading depth, the width its layout gives it or
the toolkit coordinator, or to publish such a fact to its descendants. Which
facts the players publish, and how a descendant resolves them, is in
[Composition context](../../docs/architecture/composition-context.md).

## Included APIs

- `createContext<T>(key)` for typed context keys
- `ContextRequestEvent` and `ContextProviderEvent`
- `ContextProvider` and `provideContext(...)`
- `ContextConsumer`, `consumeContext(...)`, and `requestContext(...)`
- `connectContextWithRetry(...)` for a consumer whose provider may connect
  after it: the document root replays its request, and it re-requests when a
  `context-provider` event reaches its host
- `ContextRoot` for late-provider replay of pending subscribing requests
- `ensureDocumentContextRoot(doc)`, which installs the one `ContextRoot` a
  document shares

## Design notes

- Events are emitted with `bubbles: true` and `composed: true`, each on the
  `Event` of its target's window, so a copy of this package evaluated before a
  DOM emulator registered still dispatches on the emulator's elements. Without
  a window the base is the `Event` global at construction.
- `instanceof ContextRequestEvent` and `instanceof ContextProviderEvent` hold
  for the events that copy of the package constructed. Providers match a request
  by `event.context === key` and never by its class, so requests from any copy
  match.
- Provider matching uses strict key identity (`===`).
- `ContextRequestEvent.subscribe` defaults to `false` (one-shot request).
- Providers call `stopPropagation()` when they satisfy a matching request.
- Providers re-dispatch existing subscriptions when a nested provider for the
  same context announces itself.
- A provider that disconnects re-dispatches each subscription whose consumer is
  in the document, which reaches the nearest provider left or the document root.
  A subscription whose consumer is out of the document is held and re-dispatched
  when the provider reconnects, so a subtree moved with its provider keeps its
  subscriptions.
- `ContextConsumer` subscribes unless given `subscribe: false`. Subscriptions
  include unsubscribe callbacks.
- `ContextRoot` only tracks subscribing requests to avoid unnecessary retention.
- `ContextRoot` dedupes pending replay by `(requestor, callback)` pair.
- `ContextRoot` skips a request a provider has already answered, never stops
  propagation, and reads both events by shape, so requests from another copy of
  this package or from `@lit/context` are replayed too.
- A subscribing `ContextConsumer` calls `ensureDocumentContextRoot` on its host's
  `ownerDocument` when it connects, before its first request. Each document gets
  one root, on its `documentElement`, kept in a `Symbol.for` slot so every copy
  of this package on the page shares it. Nothing is installed at import.
- A consumer whose provider never connects is never answered and keeps its own
  defaults.
- A provider answering the same callback again hands back the same unsubscribe,
  so a consumer re-requesting keeps its subscription.
- Keys shared across bundles must be `Symbol.for(...)`: each copy of a module
  that calls `Symbol()` gets a different key, and its providers and consumers
  never match.

These semantics follow the core APIs of Lit's `@lit/context`.

## Svelte usage pattern

Keep Svelte reactivity for internal state and use this package for ambient
runtime dependencies between components:

```ts
import { onMount } from "svelte";
import { ContextConsumer, createContext } from "@pie-players/pie-context";

const toolkitContext = createContext<{ assessmentId: string }>(
  Symbol.for("my-app.toolkit-runtime"),
);

let host: HTMLElement;
let assessmentId = "";
let consumer: ContextConsumer<typeof toolkitContext>;

onMount(() => {
  consumer = new ContextConsumer(host, {
    context: toolkitContext,
    subscribe: true,
    onValue: (value) => {
      assessmentId = value.assessmentId;
    },
  });
  consumer.connect();
  return () => consumer.disconnect();
});
```
