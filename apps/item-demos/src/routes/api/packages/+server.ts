import { getNpmPackageVersions } from "@pie-players/pie-players-shared/server/npm-registry";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const DEFAULT_PACKAGE = "@pie-element/multiple-choice";

export const GET: RequestHandler = async ({ url, fetch }) => {
	const packageName = url.searchParams.get("package") || DEFAULT_PACKAGE;
	const searchTerm = url.searchParams.get("search") || "";
	const limit = searchTerm ? undefined : 20;

	const versions = await getNpmPackageVersions(
		packageName,
		fetch,
		undefined,
		limit,
		searchTerm,
	);
	return json(versions);
};
