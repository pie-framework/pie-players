import { redirect } from "@sveltejs/kit";

export const ssr = false;

export function load() {
	throw redirect(307, "/delivery/backend-delivery-planets");
}
