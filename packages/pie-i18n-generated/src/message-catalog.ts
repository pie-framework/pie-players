/**
 * The shape of a locale catalog, as `@pie-players/pie-players-shared/i18n`
 * defines `MessageCatalog`.
 *
 * Restated here because the generated catalogs are pure data: a declaration that
 * named players-shared would make every host that installs them install it for
 * one type. `test/message-catalog-contract.test.ts` fails the typecheck when the
 * two stop accepting each other, which is what lets a host hand
 * `loadGeneratedCatalog` straight to the provider's `loadCatalog`.
 */

/** A plural group; `other` is the one category every language has. */
interface PluralTranslation {
	zero?: string;
	one?: string;
	two?: string;
	few?: string;
	many?: string;
	other: string;
}

/** A catalog node: a leaf string, a plural group, or a namespace. */
type MessageNode = string | PluralTranslation | { [key: string]: MessageNode };

/** A whole catalog, as one locale module default-exports it. */
export type MessageCatalog = { [key: string]: MessageNode };
