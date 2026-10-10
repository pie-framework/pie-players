---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

The layouts' `element-preload-retry` and `element-preload-error` events bubble and are composed, and a section readies only on a `section-ready` for its own section that carries a controller. A failure from a toolkit nested in the section no longer fails its stage chain. The toolkit keys a section with no `section-id` or identifier by its `assessment-id` alone, as the layout does, where a toolkit without one keyed it by a generated id and the section never reached `engine-ready`. A toolkit's unmount leaves the section controllers of a coordinator the host passes or an outer toolkit lends to that coordinator's owner, and a shell holds its events while its toolkit is replaced, delivering them to the next one.
