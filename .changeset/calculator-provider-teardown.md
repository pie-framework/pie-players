---
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-calculator-geogebra": patch
---

Destroy the calculators a provider created when the provider is destroyed.

`destroy()` is a host's one call to release a calculator provider, and both
adapters released only their own fields: every calculator they had handed out
stayed mounted, with its vendor instance running and its container populated. A
host that swaps providers, or tears a section down without walking its
calculators first, leaked all of them. Both providers now track live instances
and destroy them, matching the Cortex adapter, and each calculator is destroyed
at most once however many times it is asked.

The Desmos adapter's four `console.log` calls are gone. The warnings that carry
a diagnostic — the legacy unkeyed URL, a failed `setState`, a failed `focus`, a
throwing telemetry callback — stay.
