import { loadDemoRouteDataById } from "#lib/content/demo-load.js";
import type { PageLoad } from "./$types";

export const ssr = false;

export const load: PageLoad = ({ url }) =>
	loadDemoRouteDataById("pie-512-asymmetric-sections", url);
