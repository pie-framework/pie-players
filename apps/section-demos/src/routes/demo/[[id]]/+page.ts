import { getSectionDemoById } from '$lib/content/sections';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const demo = getSectionDemoById(params.id);

	if (!demo) {
		throw error(404, `Section demo not found: ${params.id}`);
	}

	return {
		demo,
		section: demo.section
	};
};
