import { dev } from "$app/environment";
import type { Handle } from "@sveltejs/kit";

// Reject before page rendering (the lab uses CSR) or endpoint execution. The
// endpoint also loads its SQLite adapter lazily, only in development.
export const handle: Handle = ({ event, resolve }) => {
	if (!dev && (event.route.id === "/persistence-lab" || event.route.id === "/api/persistence-lab/[attemptId]")) {
		return new Response("Not found", { status: 404 });
	}
	return resolve(event);
};
