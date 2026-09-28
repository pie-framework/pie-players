---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

A removed `pie-item-player` no longer writes a model or session into its
elements. The teardown commit re-ran the element update after the elements had
unmounted, and elements released before PIE-703 threw React error #409 on that
write, which a host on another origin sees as "Script error.".
