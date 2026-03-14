import { loadDemoRouteDataById } from '$lib/content/demo-load';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = ({ url }) => loadDemoRouteDataById('three-questions', url);
