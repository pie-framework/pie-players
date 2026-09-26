import { strategyElementVersions } from "@pie-players/demo-ui/element-versions";
import {
	type ElementOverrides,
	parseElementOverridesFromUrl,
} from "@pie-players/pie-players-shared/pie";

/**
 * The element versions a demo loads: those of its `?player` strategy, with the
 * `pie-overrides[...]` URL params on top.
 */
export function demoElementOverrides(
	searchParams: URLSearchParams,
): ElementOverrides {
	return {
		...strategyElementVersions(searchParams.get("player")),
		...parseElementOverridesFromUrl(searchParams),
	};
}
