import { describe, expect, test } from "bun:test";

import { classifyPush, ZERO_SHA } from "../lib/push-scope.mjs";

const LOCAL = "a5b6846b65be6ccc6cb95bd8f9776a350522ab01";
const REMOTE = "3ac26b3400000000000000000000000000000000";

/** A pre-push stdin line: `<local ref> <local sha> <remote ref> <remote sha>`. */
const line = ({ ref = "refs/heads/topic", localSha = LOCAL, remoteSha }) =>
	`${ref} ${localSha} ${ref} ${remoteSha}\n`;

/** Counts commits without consulting git. */
const counting = (count) => () => count;

describe("classifyPush", () => {
	test("skips a new branch pointing at history the remote already has", () => {
		const result = classifyPush({
			stdin: line({
				ref: "refs/heads/release/recover-0.3.61",
				remoteSha: ZERO_SHA,
			}),
			countNewCommits: counting(0),
		});

		expect(result.verdict).toBe("skip");
		expect(result.reason).toContain("already on a remote");
	});

	test("runs when a new branch carries commits of its own", () => {
		const result = classifyPush({
			stdin: line({ remoteSha: ZERO_SHA }),
			countNewCommits: counting(3),
		});

		expect(result.verdict).toBe("run");
		expect(result.reason).toContain("3 commit(s)");
	});

	test("runs for an ordinary update that adds commits", () => {
		const result = classifyPush({
			stdin: line({ remoteSha: REMOTE }),
			countNewCommits: counting(1),
		});

		expect(result.verdict).toBe("run");
	});

	test("skips an update that adds nothing, e.g. a rewind", () => {
		const result = classifyPush({
			stdin: line({ remoteSha: REMOTE }),
			countNewCommits: counting(0),
		});

		expect(result.verdict).toBe("skip");
	});

	test("skips a pure deletion without consulting git", () => {
		let consulted = false;
		const result = classifyPush({
			stdin: `(delete) ${ZERO_SHA} refs/heads/topic ${REMOTE}\n`,
			countNewCommits: () => {
				consulted = true;
				return 0;
			},
		});

		expect(result.verdict).toBe("skip");
		expect(result.reason).toContain("only deletes refs");
		expect(consulted).toBe(false);
	});

	test("still runs when a deletion is pushed alongside new commits", () => {
		const result = classifyPush({
			stdin:
				`(delete) ${ZERO_SHA} refs/heads/gone ${REMOTE}\n` +
				line({ remoteSha: REMOTE }),
			countNewCommits: counting(2),
		});

		expect(result.verdict).toBe("run");
	});

	test("sums commits across several refs", () => {
		const counts = [0, 0, 1];
		const result = classifyPush({
			stdin:
				line({ ref: "refs/heads/a", remoteSha: REMOTE }) +
				line({ ref: "refs/heads/b", remoteSha: REMOTE }) +
				line({ ref: "refs/heads/c", remoteSha: REMOTE }),
			countNewCommits: () => counts.shift(),
		});

		expect(result.verdict).toBe("run");
		expect(result.reason).toContain("1 commit(s)");
	});

	test("skips only when every ref in the push is empty-handed", () => {
		const result = classifyPush({
			stdin:
				line({ ref: "refs/heads/a", remoteSha: REMOTE }) +
				line({ ref: "refs/heads/b", remoteSha: ZERO_SHA }),
			countNewCommits: counting(0),
		});

		expect(result.verdict).toBe("skip");
	});

	test("tolerates blank lines and trailing whitespace", () => {
		const result = classifyPush({
			stdin: `\n  ${line({ remoteSha: ZERO_SHA }).trim()}  \n\n`,
			countNewCommits: counting(0),
		});

		expect(result.verdict).toBe("skip");
	});
});

describe("classifyPush fails safe", () => {
	test("runs when stdin is empty, e.g. invoked by hand", () => {
		const result = classifyPush({ stdin: "", countNewCommits: counting(0) });

		expect(result.verdict).toBe("run");
		expect(result.reason).toContain("no ref information");
	});

	test("runs when stdin could not be read at all", () => {
		const result = classifyPush({ stdin: null, countNewCommits: counting(0) });

		expect(result.verdict).toBe("run");
	});

	test("runs when a line does not have the four fields git documents", () => {
		const result = classifyPush({
			stdin: `refs/heads/topic ${LOCAL}\n`,
			countNewCommits: counting(0),
		});

		expect(result.verdict).toBe("run");
		expect(result.reason).toContain("could not parse");
	});

	test("runs when git could not count a ref", () => {
		const result = classifyPush({
			stdin: line({ remoteSha: REMOTE }),
			countNewCommits: () => null,
		});

		expect(result.verdict).toBe("run");
		expect(result.reason).toContain("could not count");
	});

	test("runs when a count comes back nonsensical", () => {
		for (const bogus of [Number.NaN, -1, "0", undefined]) {
			const result = classifyPush({
				stdin: line({ remoteSha: REMOTE }),
				countNewCommits: () => bogus,
			});

			expect(result.verdict).toBe("run");
		}
	});
});
