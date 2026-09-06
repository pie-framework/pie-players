import { dev } from "$app/environment";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url }) => {
	if (!dev) error(404, "Not found");
	const attemptId = url.searchParams.get("attempt") || crypto.randomUUID();
	if (!/^[a-zA-Z0-9_-]{1,80}$/.test(attemptId)) error(400, "Invalid lab attempt");
	return { attemptId };
};
