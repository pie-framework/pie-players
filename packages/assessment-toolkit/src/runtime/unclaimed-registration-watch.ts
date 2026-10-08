import { warnOncePerDocument } from "./page-warnings.js";
import {
	PIE_REGISTER_EVENT,
	type RuntimeRegistrationDetail,
} from "./registration-events.js";

/**
 * A toolkit stops every registration it claims, so one that reaches the
 * document went unclaimed: its item's catalogs are not filed and it does not
 * count toward its section's loading. Installed from a toolkit's host at
 * connect, once per document across every copy of the toolkit.
 */
export function watchForUnclaimedRegistrations(
	doc: Document | null | undefined,
): void {
	if (!doc) return;
	const slot = Symbol.for("pie.assessmentToolkit.unclaimedRegistrationWatch");
	const slots = doc as unknown as Record<symbol, unknown>;
	if (slots[slot]) return;
	slots[slot] = true;
	doc.addEventListener(PIE_REGISTER_EVENT, (event) => {
		const detail = (event as CustomEvent<Partial<RuntimeRegistrationDetail>>)
			.detail;
		const itemId = typeof detail?.itemId === "string" ? detail.itemId : "";
		warnOncePerDocument(
			doc,
			"unclaimedRegistration",
			`[pie-assessment-toolkit] Item "${itemId}" registered, but no toolkit claimed the registration, so its accessibility catalogs are not filed and it does not count toward its section's loading. Render its shell or scope inside the <pie-assessment-toolkit> that answered it. Reported once per page.`,
		);
	});
}
