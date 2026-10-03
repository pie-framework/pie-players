/**
 * Names each chunk a Vite build emits after the module it starts from, so a
 * chunk keeps its file name from one build to the next.
 *
 * The key is the module's path with everything up to `node_modules/` or `src/`
 * dropped, or, for a module elsewhere in the workspace such as a sibling
 * package's `dist`, its path relative to the workspace root. No part of the
 * checkout path reaches the name, because turbo's cache restores a build into
 * whichever worktree asks for it.
 *
 * Lives at the package root beside `svelte-source-aliases.ts`, outside `src/`,
 * so it never lands in `dist`.
 */
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";

interface ChunkInfo {
	name: string;
	facadeModuleId?: string | null;
	moduleIds?: string[];
}

const toPosix = (path: string) => path.replace(/\\/g, "/");

/** `workspaceRoot` is the repository root, which every module id under it starts with. */
export const chunkFileNamesFromSource = (workspaceRoot: string) => {
	const rootPrefix = `${toPosix(realpathSync(workspaceRoot)).replace(/\/$/, "")}/`;

	const sanitizeChunkKey = (value: string) => {
		const path = toPosix(value)
			.replace(/^.*\/node_modules\//, "npm/")
			.replace(/^.*\/src\//, "src/");
		return (path.startsWith(rootPrefix) ? path.slice(rootPrefix.length) : path)
			.replace(/-[a-f0-9]{8,}(?=\.js($|[/.]))/gi, "")
			.replace(/-[a-f0-9]{8,}(?=\/|$)/gi, "")
			.replace(/[^a-zA-Z0-9/_-]/g, "-")
			.replace(/\/+/g, "/")
			.replace(/^\/+/, "")
			.replace(/\/$/, "")
			.replace(/\//g, "__");
	};

	return (chunkInfo: ChunkInfo) => {
		const moduleSource =
			chunkInfo.facadeModuleId ??
			(Array.isArray(chunkInfo.moduleIds) ? chunkInfo.moduleIds[0] : undefined);
		const sourceKey = sanitizeChunkKey(
			moduleSource || chunkInfo.name || "chunk",
		);
		const chunkName = sanitizeChunkKey(chunkInfo.name || "chunk");
		const sourceHash = createHash("sha1")
			.update(sourceKey)
			.digest("hex")
			.slice(0, 8);
		return `chunks/${chunkName}-${sourceHash}.js`;
	};
};
