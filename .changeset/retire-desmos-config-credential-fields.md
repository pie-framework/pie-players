---
"@pie-players/pie-calculator-desmos": patch
"@pie-players/pie-assessment-toolkit": patch
---

Delete the Desmos adapter's deprecated configuration surface: the `apiKey` and
`proxyEndpoint` fields on its settings type, and the
`DesmosCalculatorProviderConfig.desmos` option bag that held them. Vendor options
are `settings`, the same field every adapter uses, and credentials are
provider-level -- `initialize()`, typed by `CalculatorProviderInit`, which is
untouched and still the canonical production path.

Verified against all three consumer checkouts on 2026-08-27 before removing:
neither host that offers Desmos passes a config bag at all. Both configure it
through `provider.runtime.authFetcher` alone, nothing names
the settings type or `DesmosCalculatorProviderConfig`, and nothing sets a
credential in a config bag. Three source breaks with no source to break; the
consumer dependency pad records the check.

Nothing changed about what reaches Desmos. The credentials were already inert in
a per-instance bag -- deleted before the vendor constructor, since Desmos rejects
an unknown option and a key there has no effect -- and `settings` already won
whenever both forms were present, so the merge that consulted the bag could only
supply keys `settings` had omitted. The stripping stays and is now one helper
rather than four `delete` statements; because the settings type keeps its
index signature, `settings` still accepts both credential names from a stale
caller and still drops them.

`DesmosCalculatorProviderConfig` is now `CalculatorProviderConfig` with `settings`
narrowed to the settings type, which is what makes the removal an
improvement rather than a subtraction: a client on the canonical field previously
traded every Desmos option name for `Record<string, unknown>`, so the deprecated
bag was the only typed way to configure the calculator. The narrowing is
assignment-compatible in both directions with a plain `Record<string, unknown>`.

Two pending changesets and one ADR promised the option bag or named it in a
trade-off; all three now describe `settings`. The calculators README also read as
though `proxyEndpoint` were deprecated alongside it.
