---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-answer-eliminator": patch
---

The answer eliminator is offered where an element declares the AfA PNP 3.0 `answer-masking` support as `static pieSupports` on its class, and takes its choices from the element's `pieSupportTargets('answer-masking')`, so an element built elsewhere gets it with no change here. `elementSupports(context)` reads the declarations from the registered classes, and the item toolbar re-checks when a lazily loaded element is defined. Multiple choice and EBSR releases that declare nothing keep the eliminator. Select-text releases that declare it get a toggle on each selectable token; earlier select-text releases and inline-choice no longer show it, since it found no choices there. When an element replaces its choices' markup, the eliminator reads them again and keeps their eliminations by id. `hasChoiceInteraction` is removed, as are the eliminator's `./adapters/adapter-registry` subpath and inline-dropdown adapter.
