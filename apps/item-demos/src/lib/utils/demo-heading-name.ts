/** Leading "Level 1", "level 2:", etc. (common in sample content) — omit from demo list and page headings. */
const LEVEL_HEADING_PREFIX = /^(level\s+\d+)\s*[:.)\-–—]?\s*/i;

export function demoHeadingName(raw: string | null | undefined, fallback = "Demo"): string {
	const trimmed = String(raw ?? "").trim();
	if (!trimmed) return fallback;
	const stripped = trimmed.replace(LEVEL_HEADING_PREFIX, "").trim();
	return stripped || fallback;
}
