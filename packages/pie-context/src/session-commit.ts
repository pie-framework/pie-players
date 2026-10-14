import { createContext } from "./types.js";

/**
 * How a player wants elements to commit a learner's response into the session.
 *
 * A host sets this once on its player, which answers for every element inside
 * it. An element requests it with `subscribe: true`; an unanswered request, or
 * an absent field, means the element's own default.
 *
 * Fields are added, never removed or redefined, because pinned element
 * versions keep reading the shape they shipped with.
 */
export interface SessionCommitContextValue {
	/**
	 * How long, in milliseconds, the learner has to stop typing before a
	 * response editor commits without losing focus. `0` commits on blur only.
	 */
	idleSaveDelayMs?: number;
}

/**
 * `Symbol.for`, so every element's bundled copy of this package requests the
 * same key the player provides.
 */
export const sessionCommitContext = createContext<SessionCommitContextValue>(
	Symbol.for("pie.sessionCommit"),
);
