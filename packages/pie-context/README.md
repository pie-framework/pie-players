# @pie-players/pie-context

Framework-agnostic Context Protocol helpers for PIE web components.

This package implements the Web Components community `context-request` protocol
so orchestration/runtime dependencies can be shared without prop drilling.

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

- Events are emitted with `bubbles: true` and `composed: true`.
- Provider matching uses strict key identity (`===`).
- `ContextRequestEvent.subscribe` defaults to `false` (one-shot request).
- Providers call `stopPropagation()` when they satisfy a matching request.
- Providers re-dispatch existing subscriptions when a nested provider for the
  same context announces itself.
- Subscriptions are opt-in (`subscribe: true`) and include unsubscribe callbacks.
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
