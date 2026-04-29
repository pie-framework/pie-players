import { demo3Section } from '$lib/content/demo3-three-questions';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = () => ({
	section: demo3Section
});
