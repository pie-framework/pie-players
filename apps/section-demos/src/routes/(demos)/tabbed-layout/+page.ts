import { loadDemoRouteDataById } from '$lib/content/demo-load';
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const ssr = false;

function buildVariantUrl(url: URL, pathname: string): string {
	const next = new URL(url);
	next.pathname = pathname;
	next.searchParams.delete('layout');
	return `${next.pathname}${next.search}`;
}

export const load: PageLoad = ({ url }) => {
	const legacyLayout = (url.searchParams.get('layout') || '').trim().toLowerCase();
	if (legacyLayout === 'tabbed') {
		throw redirect(307, buildVariantUrl(url, '/tabbed-layout/tabbed'));
	}
	if (legacyLayout === 'splitpane') {
		throw redirect(307, buildVariantUrl(url, '/tabbed-layout/splitpane-tabbed-collapse'));
	}
	return loadDemoRouteDataById('tabbed-layout', url);
};
