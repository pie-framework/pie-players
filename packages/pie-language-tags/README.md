# @pie-players/pie-language-tags

BCP 47 language tag lookup and matching for the two PIE i18n engines: pie-players'
`@pie-players/pie-players-shared/i18n`, which re-exports it as
`@pie-players/pie-players-shared/i18n/language-tags`, and pie-elements-ng's
`@pie-element/shared-i18n`. The package carries no locale data, touches no DOM and
has no dependencies, so it imports in a browser, in Node.js and in a server bundle
alike.

```ts
import {
	canonicalLanguageTag,
	findBestLanguageMatch,
	findClosestLanguageMatch,
	languageTagLookupSequence,
	negotiateContentLanguage,
	normalizeLanguageTag,
	toLanguageTag,
} from "@pie-players/pie-language-tags";

languageTagLookupSequence("zh-Hans-CN"); // ["zh-hans-cn", "zh-hans", "zh"]
findBestLanguageMatch("es_MX", ["en-US", "es"]); // "es"
toLanguageTag("es_ES"); // "es-ES"
```

Lookup follows RFC 4647: a tag widens by dropping its last subtag, and a script
subtag is never crossed, so `zh-TW` reaches `zh-Hant` but not a bare `zh`. Widening
to a sibling (`es-MX` to `es-ES`, through `findClosestLanguageMatch`) reaches only a
sibling with the same variant subtags. POSIX forms (`es_ES`, `es_ES.UTF-8`) read as
their BCP 47 tag.

## Conformance spec

`@pie-players/pie-language-tags/i18n-conformance-fixtures.json` is the behaviour
the two engines share: lookup sequence, catalog matching, direction, plural
routing, interpolation and the fallback chain. Each repository runs it against its
own engine, so a case one engine passes and the other fails is drift, and the fix
goes to the engine.
