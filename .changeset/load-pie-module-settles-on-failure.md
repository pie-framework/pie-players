---
"@pie-players/pie-players-shared": patch
---

Make `loadPieModule` reject on every failure instead of leaving its promise
pending for the life of the page.

`script.onerror` threw. A throw inside a DOM event handler does not propagate to
the surrounding async function — it becomes an uncaught error on the window —
and the promise the function awaited had no reject parameter and no `error`
listener at all. A 404, a blocked request, or a CSP refusal therefore left
`await loadPieModule(...)` pending forever, and so did a request that simply
stalled, because nothing bounded the wait. Two further paths never settled for
the same reason: `registerPieElementsFromBundle` throws synchronously for a
package missing from the bundle and for a client-player bundle with no
controller, and a rejection among the registration promises was dropped by a
one-argument `.then`.

All four now reject, and every rejection names the bundle URL and removes the
injected `<script>` so a retry starts from a clean head. `defaultLoadBundleScript`
in the IIFE `ElementLoader` adapter was already the right pattern; this brings
the older path to it.

The fifth case was reporting success. A script that loaded without populating
`window.pie` logged an error and *resolved*, which told the caller a bundle had
loaded when nothing had been registered. That is now a rejection.
`initializePiesFromLoadedBundle` still tolerates the same missing global,
deliberately: there the host's own `ElementLoader` owns registration and the
global is irrelevant. In `loadPieModule` this function owns registration, so
there is no other party whose work could still arrive — the same reasoning the
IIFE adapter already applies when `window.pie.default` is missing after its own
bundle load.

`LoadPieElementsOptions` gains an optional `loadTimeoutMs`, named and defaulted
to match `EnsureRegisteredOptions.loadTimeoutMs` on the `ElementLoader`
primitive — `DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.timeoutMs`, 120s — so a bundle
gets one budget whichever path a host loads it through. `0` disables the
deadline for a host that wants the old unbounded wait back.

This is an observable contract change on a published export: an error a host
previously saw as an uncaught window error now arrives as a rejected promise, and
a host that awaits `loadPieModule` (or `loadPieModuleFromString`, which routes
through it) without a `catch` gets an unhandled rejection where it used to get a
promise that never settled. No consumer in the dependency pad imports either
function: `pie-players-shared` reaches recorded hosts for instrumentation
providers and types only, and the one host with a `loadPieModule` call site calls
its own vendored fork of this module rather than the package. That fork is
unaffected and carries the original defect.
