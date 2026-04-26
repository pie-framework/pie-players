import type { SectionPlayerCardTitleFormatter } from "./card-title-formatters.js";

/**
 * Host-extension hook contract for the section-player layout custom elements.
 *
 * Hosts pass a `SectionPlayerHostHooks` value via the `host-hooks` attribute
 * (or the `hostHooks` prop, mirroring per the two-tier policy in
 * {@link ../../ARCHITECTURE.md}) on `<pie-section-player-*>` to override
 * formatter / decoration behavior that the engine intentionally leaves to the
 * host. Each hook is optional; omitted hooks fall back to documented defaults.
 *
 * Today the contract has a single member (`cardTitleFormatter`). The shape is
 * intentionally a struct, not a single callback prop, so future host-supplied
 * formatters / decorators can be added without renaming the surface.
 *
 * The naming/expansion of this contract is part of the
 * "Coherent Options Surface" review; the broader expansion (additional hook
 * fields produced as the section host runtime engine consolidates) is owned
 * by the M7 follow-up plan in `coherent_options_surface_review_0133a7cd.plan.md`.
 * Keeping the current name (`SectionPlayerHostHooks`) is deliberate so that
 * additions there do not require a breaking rename across the layout CEs.
 */
export type SectionPlayerHostHooks = {
	cardTitleFormatter?: SectionPlayerCardTitleFormatter;
};
