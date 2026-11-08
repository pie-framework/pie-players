import type { ResolvedSignLanguageAlternate } from "./sign-language-content.js";

/** Inputs shared by the component and its native element declaration. */
export interface SignLanguageElementProps {
	media?: ResolvedSignLanguageAlternate | null;
}
