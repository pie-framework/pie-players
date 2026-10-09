import type { SectionPlayerCardTitleFormatter } from "./card-title-formatters.js";

/**
 * Host-extension hook contract for the section-player layout custom elements.
 *
 * Hosts pass a `SectionPlayerHostHooks` value as the `hooks` JS property on
 * `<pie-section-player-*>` to override formatter / decoration behavior that
 * the engine intentionally leaves to the host. Each hook is optional; omitted
 * hooks fall back to documented defaults.
 *
 * Today the contract has a single member (`cardTitleFormatter`). The shape is
 * intentionally a struct, not a single callback prop, so future host-supplied
 * formatters / decorators can be added without renaming the surface.
 */
export type SectionPlayerHostHooks = {
	cardTitleFormatter?: SectionPlayerCardTitleFormatter;
};
