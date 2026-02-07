import { getDemoById } from '$lib/content/demos';
import { error } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ params }) => {
	const demo = getDemoById(params.id);

	if (!demo) {
		throw error(404, `Demo not found: ${params.id}`);
	}

	return {
		demo,
		demoId: params.id
	};
};
