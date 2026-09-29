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
  after it: it re-requests on `context-provider` and polls every 50 ms for
  about 10 s
- `ContextRoot` for late-provider replay of pending subscribing requests

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

These semantics follow the core APIs of Lit's `@lit/context`.

## Svelte usage pattern

Keep Svelte reactivity for internal state and use this package for ambient
runtime dependencies between components:

```ts
import { onMount } from "svelte";
import { ContextConsumer, createContext } from "@pie-players/pie-context";

const toolkitContext = createContext<{ assessmentId: string }>(
  Symbol("toolkit-runtime"),
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
