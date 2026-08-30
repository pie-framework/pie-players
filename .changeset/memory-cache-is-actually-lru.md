---
"@pie-players/tts-server-core": patch
---

Make `MemoryCache` the LRU its documentation has always claimed, and state
plainly that it is a development and testing cache.

`get` returned an entry without touching its position in the backing `Map` and
`set` evicted `cache.keys().next().value`, so eviction took the oldest *insertion*
while the class doc said "Simple LRU cache" and the comment in `set` said "simple
LRU". With a working set larger than `maxSize` that inverted the intent: the
passage a learner replays most is also the oldest insertion, so it was the first
thing evicted and got re-synthesized on every pass — a provider call and its
latency per repeat, against a cache reporting a hit rate that looked fine because
the hits it did serve were counted. A `get` hit now re-inserts its key, which
moves it to the end of the iteration order, and eviction takes the front.

Two smaller things went with it. Eviction is a loop rather than a single delete,
so a cache that is over capacity converges instead of staying over by the same
margin for every subsequent insertion. And eviction now drops every expired entry
before it considers a live one: expired entries can never be served, so spending a
live entry while one of them holds a slot costs a hit for nothing. Reclamation is
still driven by traffic — a `get`, a `has`, or an insertion at capacity — because a
background sweep in a library keeps a host's process alive, and the bound that
matters is `maxSize`, which held before and holds now.

Nothing about the key format, the TTL default, the `ITTSCache` shape or the stats
changes, so a host swapping in its own cache is unaffected. The class doc and the
package README now say the part that was implied: `MemoryCache` holds audio
buffers in one process's heap, so it is lost on restart and every replica of a
scaled deployment synthesizes the same passage into its own copy. A production
host implements `ITTSCache` over shared storage, and both now point at the Redis
shape sketched in
`packages/tts-server-polly/examples/sveltekit/synthesize-server.ts`.

Found in a project-wide performance and security review on 2026-08-30.
