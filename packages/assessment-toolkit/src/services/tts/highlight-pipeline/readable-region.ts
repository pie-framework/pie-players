const READABLE_REGION_SELECTOR = [
	"[data-pie-tts-region]",
	"[data-catalog-region]",
	"li",
	"p",
	"label",
	"section",
	"[role='group']",
	"[role='region']",
	"div",
].join(",");

export const resolveReadableRegion = (
	sourceElement: Element,
	contentRoot: Element,
): Element => {
	const region = sourceElement.closest(READABLE_REGION_SELECTOR);
	if (region && contentRoot.contains(region)) {
		return region;
	}
	return sourceElement;
};
