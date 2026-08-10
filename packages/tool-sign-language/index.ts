/**
 * `@pie-players/pie-tool-sign-language` — the sign-language accommodation as a
 * self-contained capability package.
 *
 * Importing this module registers the `pie-tool-sign-language` element as a side
 * effect, so a host that imports the registration always has the element the
 * registration mounts. That is why `sideEffects` is `true` in `package.json`: a
 * bundler that dropped this import would leave a registration whose element does
 * not exist.
 *
 * A host opts in:
 *
 * ```ts
 * import { signLanguageRegistration } from "@pie-players/pie-tool-sign-language";
 * registry.register(signLanguageRegistration);
 * ```
 *
 * Nothing else is required. Signing is not in `createPackagedToolRegistry`,
 * because an accommodation with an authored-content dependency is a deployment's
 * decision rather than a default.
 */

// Registers `<pie-tool-sign-language>`.
import "./src/SignLanguageMediaRegion.svelte";

export {
	CONTENT_MEDIA_SURFACE,
	SIGN_LANGUAGE_ELEMENT_TAG,
	signLanguageRegistration,
} from "./src/sign-language-registration.js";

// Card validation and language matching: exported because an importer or a host
// writing its own region needs the same "is this card playable" answer, and a
// second implementation of it is how one fact acquires two spellings.
export type { SignLanguageMedia } from "./src/sign-language-cards.js";
export {
	AMERICAN_SIGN_LANGUAGE,
	describeSignLanguage,
	isSignLanguageCard,
	matchesRequestedSignLanguage,
	resolveSignLanguageMedia,
	SIGN_LANGUAGE_CATALOG_TYPE,
} from "./src/sign-language-cards.js";

// Content resolution: the resource half of the AfA pair, and the pieces a host
// needs to answer "does this item carry signing" outside a render.
export type {
	ResolvedSignLanguageAlternate,
	SignLanguageCatalogRef,
	SignLanguageLookupArgs,
} from "./src/sign-language-content.js";
export {
	collectSignLanguageCatalogRefs,
	resolveRequestedSignLanguage,
	resolveSignLanguageAlternate,
	resolveSignLanguageContent,
	SIGN_LANGUAGE_FEATURE_ID,
} from "./src/sign-language-content.js";
