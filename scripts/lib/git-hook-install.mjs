/**
 * Whether the `prepare` lifecycle script should install git hooks in this checkout.
 *
 * Only the main worktree may install. `lefthook install` writes to the shared
 * .git/hooks and bakes an absolute path to the node_modules it ran from into the
 * generated scripts, so installing from a linked worktree repoints every checkout
 * at a directory that is about to be deleted. .lefthookrc defuses that by resolving
 * LEFTHOOK_BIN from --git-common-dir first, but the defusing only survives while the
 * hooks carry the `rc: ./.lefthookrc` line: a worktree checked out to a branch older
 * than that line regenerates the hooks without it and strips the mitigation from
 * every checkout, main included. Skipping in worktrees removes the way in.
 *
 * Nothing is lost by skipping -- .git/hooks is shared, so the main checkout's install
 * already covers every worktree.
 */

import { isAbsolute, resolve } from "node:path";

/**
 * Whether this checkout owns .git/hooks.
 *
 * git reports --git-dir and --git-common-dir as the same path in the main worktree
 * (".git" relative to the root) and as different absolute paths in a linked one
 * (.git/worktrees/<name> versus .git). Both are resolved against `cwd` because git
 * only returns them absolute from a linked worktree.
 *
 * @param {{ gitDir: string | null | undefined, gitCommonDir: string | null | undefined, cwd?: string }} input
 * @returns {{ install: boolean, reason: string }}
 */
export function decideHookInstall({ gitDir, gitCommonDir, cwd = "." }) {
	if (!gitDir || !gitCommonDir) {
		return {
			install: false,
			reason: "this is not a git checkout, so there are no hooks to install",
		};
	}

	const against = (dir) => (isAbsolute(dir) ? dir : resolve(cwd, dir));

	if (against(gitDir) === against(gitCommonDir)) {
		return { install: true, reason: "this is the main worktree" };
	}

	return {
		install: false,
		reason:
			"this is a linked worktree and .git/hooks is shared -- the main checkout owns it",
	};
}
