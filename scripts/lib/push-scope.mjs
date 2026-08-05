/**
 * Decides whether a `git push` is introducing anything the pre-push gate could validate.
 *
 * The gate is deliberately expensive: it runs the full local PR gate plus the critical
 * Playwright suites. That cost is worth paying for code that is about to reach a shared
 * branch, and it is pure waste for a push that carries no new commits at all. The case
 * that motivated this: creating a branch at a commit that is already on the remote, e.g.
 *
 *   git push origin <sha-already-on-origin>:refs/heads/release/recover-0.3.61
 *
 * That push transfers zero objects — it only makes a new ref point at history the remote
 * already has and already gated — yet the hook still ran the whole suite.
 *
 * The classification is deliberately conservative: every uncertain case resolves to "run".
 * A gate that runs when it did not need to costs minutes; a gate that skips when it was
 * needed lets unvalidated code onto a shared branch, so the two errors are not symmetric.
 * Uncertainty includes an unreadable stdin, a line git could not count, and a malformed
 * line — none of them are treated as "nothing to do".
 *
 * Extracted from the hook entry point so the sequencing rules are testable without a
 * remote, a push, or a multi-minute gate run.
 */

/** git's sentinel for "this ref does not exist", used for branch creation and deletion. */
export const ZERO_SHA = "0".repeat(40);

const isZeroSha = (sha) => /^0+$/.test(sha);

/**
 * Classify the refs a pre-push hook was handed.
 *
 * @param {object} args
 * @param {string} args.stdin
 *   Raw pre-push stdin. git writes one `<local ref> <local sha> <remote ref> <remote sha>`
 *   line per ref being pushed.
 * @param {(refUpdate: {localSha: string, remoteSha: string}) => number | null}
 *   args.countNewCommits
 *   Returns how many commits this ref update would add to the remote, or null when that
 *   could not be determined. Injected so the decision stays free of git.
 * @returns {{verdict: "run" | "skip", reason: string}}
 */
export function classifyPush({ stdin, countNewCommits }) {
	if (typeof stdin !== "string") {
		return {
			verdict: "run",
			reason: "no ref information was available on stdin",
		};
	}

	const lines = stdin
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) {
		// Either git passed nothing (a push with no matching refs) or the hook was invoked
		// by hand. Both are unknowns, and unknowns run the gate.
		return {
			verdict: "run",
			reason: "no ref information was available on stdin",
		};
	}

	let newCommits = 0;
	let deletions = 0;

	for (const line of lines) {
		const fields = line.split(/\s+/);
		if (fields.length !== 4) {
			return {
				verdict: "run",
				reason: `could not parse the pushed refs from stdin: "${line}"`,
			};
		}

		const [, localSha, , remoteSha] = fields;

		if (isZeroSha(localSha)) {
			// Deleting a remote ref. There is no content to validate, and a delete must not
			// by itself force a full gate run.
			deletions += 1;
			continue;
		}

		const count = countNewCommits({ localSha, remoteSha });
		if (typeof count !== "number" || Number.isNaN(count) || count < 0) {
			return {
				verdict: "run",
				reason: `could not count the commits ${localSha.slice(0, 9)} would add`,
			};
		}

		newCommits += count;
	}

	if (newCommits > 0) {
		return {
			verdict: "run",
			reason: `${newCommits} commit(s) are being pushed`,
		};
	}

	if (deletions === lines.length) {
		return {
			verdict: "skip",
			reason: "this push only deletes refs, so there is nothing to validate",
		};
	}

	return {
		verdict: "skip",
		reason:
			"every commit in this push is already on a remote, so there is nothing new to validate",
	};
}
