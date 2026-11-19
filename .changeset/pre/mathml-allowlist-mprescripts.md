---
"@pie-players/pie-players-shared": patch
---

`sanitizeItemMarkup` no longer lists `mprescripts` among the MathML tags it adds
to DOMPurify's allowlist, since DOMPurify keeps it already. Markup sanitizes as
before.
