---
"@pie-players/pie-theme": patch
---

Document and prove SchoolCity colour-scheme parity as host registration.

The SchoolCity parity report records "15 schemes against PIE's 10" as the
remaining delta on PIE-472, which reads as eleven missing palettes. It is not one
change of that size, and measuring it settled the shape: four of SchoolCity's 15
are already built in (Black on White, White on Black, Black on Rose, Yellow on
Blue), and the other eleven are registrable by a host today with no change here.

Adds a validated worked example, one scheme per cost class, and a README section
carrying SchoolCity's own palette values. The cost is the finding: it scales with
how far the background sits from white, because every semantic colour in the light
base was chosen against white. A white-background scheme needs 2 tokens. Green on
White needs 4 — its ink is the tightest of the set at 4.73:1 and misses the tinted
recessed surfaces. Pure black needs 10, borrowed from the dark base theme, which
authored its inks against `#000000` already. A mid-tone background — blue, red,
green, dark gray — needs about 18, because neither the light inks nor the dark
ones hold against it and the icons, control boundaries and focus rings all have to
be re-chosen.

All 15 clear 4.5:1 for ordinary text, so the text pair is never what blocks a
scheme; the other 24 enforced relationships are.

The example also pins the trap. Contrast diagnostics are warnings rather than
errors, deliberately, because a registered palette is host-owned — so a two-token
White on Blue registers successfully and returns fourteen warnings, and a host
filtering on `severity === "error"` ships cyan links on a mid-blue page. A test
holds that behavior so it cannot quietly become an error and break a host, or
quietly disappear.

No new built-in schemes. A built-in is a full 48-token palette because a
two-colour scheme is a promise the whole surface keeps, and which schemes a
programme wants is unsettled on PIE-472 — the story was deferred out of the SB v1
scope with its requirements still open, so eleven authored palettes would be
speculation with a published surface attached.
