import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const {
	SESSION_COMMIT_METHOD,
	bindPageLifecycleCommit,
	commitPendingSessions,
	noteSessionBaseline,
	noteSessionObserved,
} = await import("../src/pie/session-commit.js");

let tagSeed = 0;

/**
 * An element that owns its deferred notification: it installs the commit hook
 * and dispatches its own event, which is what an adopted element does.
 */
function defineCommittingElement(options: { throwOnCommit?: boolean } = {}): string {
	const tag = `pie-committing-${(tagSeed += 1)}`;
	customElements.define(
		tag,
		class extends HTMLElement {
			_session: Record<string, unknown> = {};
			_pending = false;
			set model(_m: unknown) {}
			get session() {
				return this._session;
			}
			set session(s: Record<string, unknown>) {
				this._session = s;
			}
			change(value: unknown) {
				this._session.value = value;
				this._pending = true;
			}
			[SESSION_COMMIT_METHOD]() {
				if (options.throwOnCommit) throw new Error("commit exploded");
				if (!this._pending) return;
				this._pending = false;
				this.dispatchEvent(
					new CustomEvent("session-changed", {
						bubbles: true,
						composed: true,
						detail: { complete: true, component: this.tagName.toLowerCase() },
					}),
				);
			}
		},
	);
	return tag;
}

/** An element on an older version: synchronous session, no commit hook. */
function defineLegacyElement(
	options: { throwOnRead?: boolean; noSession?: boolean } = {},
): string {
	const tag = `pie-legacy-${(tagSeed += 1)}`;
	customElements.define(
		tag,
		class extends HTMLElement {
			_session: Record<string, unknown> = {};
			set model(_m: unknown) {}
			get session() {
				if (options.throwOnRead) throw new Error("session getter exploded");
				if (options.noSession) return undefined;
				return this._session;
			}
			set session(s: Record<string, unknown>) {
				this._session = s;
			}
		},
	);
	return tag;
}

function mount(tag: string): HTMLElement {
	const element = document.createElement(tag);
	document.body.appendChild(element);
	return element;
}

/** Collects `session-changed` at `document`, and unbinds itself. */
function observeDocument(): { events: CustomEvent[]; stop(): void } {
	const events: CustomEvent[] = [];
	const listener = (event: Event) => events.push(event as CustomEvent);
	document.addEventListener("session-changed", listener);
	return {
		events,
		stop() {
			document.removeEventListener("session-changed", listener);
		},
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("commitPendingSessions", () => {
	it("asks an adopted element to commit its own pending notification", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();

		element.change("answer");
		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.committed).toBe(1);
		expect(observed.events).toHaveLength(1);
		expect(observed.events[0]?.detail.complete).toBe(true);
	});

	it("reaches a document-level listener because the element is still attached", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();

		element.change("answer");
		commitPendingSessions(document.body);
		observed.stop();

		expect(observed.events).toHaveLength(1);
		expect(element.isConnected).toBe(true);
	});

	it("marks an element-owned commit with the reason, so a player's guards let it through", () => {
		// The element dispatches its own event and knows nothing about the sweep.
		// Every guard in a `session-changed`'s way keys on this field to let a
		// commit past - the Stencil player's model-set blocker, the renderer
		// dedupe, the section shells' dedupe, `<pie-api-player>`'s save-now
		// decision. Unmarked, the commit is the event they all drop.
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();

		element.change("answer");
		commitPendingSessions(document.body, { reason: "navigate" });
		observed.stop();

		expect(observed.events[0]?.detail.sessionCommitReason).toBe("navigate");
		expect(observed.events[0]?.detail.complete).toBe(true);
	});

	it("leaves a synthesized event's own reason alone", () => {
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		element.session = { id: "el-1", value: "answer" };
		const observed = observeDocument();

		commitPendingSessions(document.body, { reason: "page-hidden" });
		observed.stop();

		expect(observed.events[0]?.detail.sessionCommitReason).toBe("page-hidden");
	});

	it("stops marking once the sweep returns", () => {
		// A later `session-changed` the learner caused is not a commit, and a
		// host that saves immediately on one would save on every keystroke.
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		element.change("answer");
		commitPendingSessions(document.body);

		const observed = observeDocument();
		element.change("a longer answer");
		element[SESSION_COMMIT_METHOD as unknown as keyof typeof element]();
		observed.stop();

		expect(observed.events).toHaveLength(1);
		expect(observed.events[0]?.detail.sessionCommitReason).toBeUndefined();
	});

	it("announces a session an element's own commit left undispatched", () => {
		// `commitPendingSession()` is a no-op when nothing is pending, and an
		// element's session can still hold something the host never heard: a
		// controller writing into it, or an element path that stores a value
		// without notifying. Counting the call as the announcement recorded that
		// response as delivered and every later seam then skipped it.
		const element = mount(defineCommittingElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		element.session = { id: "el-1" };
		noteSessionObserved(element);
		element.session = { id: "el-1", value: "written elsewhere" };
		const observed = observeDocument();

		const result = commitPendingSessions(document.body, { reason: "teardown" });
		observed.stop();

		expect(result.synthesized).toBe(1);
		expect(result.committed).toBe(0);
		expect(observed.events).toHaveLength(1);
		expect(observed.events[0]?.detail.session).toEqual({
			id: "el-1",
			value: "written elsewhere",
		});
	});

	it("does not double-announce an element that dispatched its own commit", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();

		element.change("answer");
		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.committed).toBe(1);
		expect(result.synthesized).toBe(0);
		expect(observed.events).toHaveLength(1);
	});

	it("synthesizes an event for an element with no commit hook", () => {
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		const observed = observeDocument();

		element.session = { id: "el-1", value: "answer" };
		const result = commitPendingSessions(document.body, { reason: "navigate" });
		observed.stop();

		expect(result.synthesized).toBe(1);
		expect(observed.events).toHaveLength(1);
		expect(observed.events[0]?.detail.session).toEqual({
			id: "el-1",
			value: "answer",
		});
		expect(observed.events[0]?.detail.sessionCommitReason).toBe("navigate");
	});

	it("does not announce a session the host already has", () => {
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		element.session = { id: "el-1", value: "answer" };

		expect(commitPendingSessions(document.body).synthesized).toBe(1);
		expect(commitPendingSessions(document.body).synthesized).toBe(0);

		element.session.value = "a longer answer";
		expect(commitPendingSessions(document.body).synthesized).toBe(1);
	});

	it("announces a response the learner returns to after changing it", () => {
		// A signature the sweep emitted once before is not a signature the host
		// still holds. Answer A, hide, answer B, answer A again, navigate inside
		// the debounce: a sweep that remembered only its own emissions would skip,
		// leaving the host on B.
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		element.session = { id: "el-1", value: ["A"] };
		expect(commitPendingSessions(document.body).synthesized).toBe(1);

		element.session.value = ["B"];
		noteSessionObserved(element);

		element.session.value = ["A"];
		const observed = observeDocument();
		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.synthesized).toBe(1);
		expect(observed.events[0]?.detail.session).toEqual({
			id: "el-1",
			value: ["A"],
		});
	});

	it("announces a response the learner cleared", () => {
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		element.session = { id: "el-1", value: "an answer" };
		noteSessionBaseline(document.body);

		element.session.value = "";
		const observed = observeDocument();
		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.synthesized).toBe(1);
		expect(observed.events[0]?.detail.session).toEqual({
			id: "el-1",
			value: "",
		});
	});

	it("does not announce an element the learner never answered", () => {
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		const observed = observeDocument();

		// What a mounted, untouched element holds: identity, no response. Emitting
		// it announces a change that did not happen, and a host that re-renders on
		// `session-changed` can cancel work it is in the middle of.
		element.session = { id: "el-1", element: "multiple-choice" };
		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.synthesized).toBe(0);
		expect(result.skipped).toBe(1);
		expect(observed.events).toHaveLength(0);
	});

	it("does not announce an untouched element whose session carries part structure", () => {
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		const observed = observeDocument();

		// `ebsr` and `explicit-constructed-response` key their parts inside
		// `value`, so an unanswered session is not identity-only and still holds
		// no response.
		element.session = {
			id: "el-1",
			element: "ebsr",
			shuffledValues: { partA: ["1", "2"] },
			value: { partA: { id: "partA" }, partB: { id: "partB" } },
		};
		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.synthesized).toBe(0);
		expect(observed.events).toHaveLength(0);
	});

	it("does not announce a restored response the learner has not touched", () => {
		const element = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		element.session = { id: "el-1", value: ["A"] };
		noteSessionBaseline(document.body);
		const observed = observeDocument();

		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.synthesized).toBe(0);
		expect(result.skipped).toBe(1);
		expect(observed.events).toHaveLength(0);
	});

	it("does not ask an adopted element to commit a session the host already has", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		element.change("answer");
		noteSessionObserved(element);
		const observed = observeDocument();

		const result = commitPendingSessions(document.body);
		observed.stop();

		expect(result.committed).toBe(0);
		expect(result.skipped).toBe(1);
		expect(observed.events).toHaveLength(0);
	});

	it("skips an element whose session getter throws", () => {
		mount(defineLegacyElement({ throwOnRead: true }));

		const result = commitPendingSessions(document.body);

		expect(result.synthesized).toBe(0);
		expect(result.skipped).toBe(1);
	});

	it("skips an element with no session to expose", () => {
		mount(defineLegacyElement({ noSession: true }));

		expect(commitPendingSessions(document.body).skipped).toBe(1);
	});

	it("keeps committing the rest when one element throws on commit", () => {
		const thrower = mount(
			defineCommittingElement({ throwOnCommit: true }),
		) as HTMLElement & { change(v: unknown): void };
		const legacy = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		thrower.change("answer");
		legacy.session = { id: "el-2", value: "other" };

		const result = commitPendingSessions(document.body);

		expect(result.skipped).toBe(1);
		expect(result.synthesized).toBe(1);
	});

	it("ignores elements that are not PIE delivery elements", () => {
		document.body.appendChild(document.createElement("div"));
		document.body.appendChild(document.createElement("pie-some-toolbar"));

		const result = commitPendingSessions(document.body);

		expect(result).toEqual({ committed: 0, synthesized: 0, skipped: 0 });
	});

	it("commits an item that mixes an adopted and an un-adopted element", () => {
		const adopted = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const legacy = mount(defineLegacyElement()) as HTMLElement & {
			session: Record<string, unknown>;
		};
		adopted.change("answer");
		legacy.session = { id: "el-2", value: "other" };

		const result = commitPendingSessions(document.body);

		expect(result.committed).toBe(1);
		expect(result.synthesized).toBe(1);
	});

	it("reaches an element inside an open shadow root", () => {
		const tag = defineCommittingElement();
		const shellTag = `pie-shell-${(tagSeed += 1)}`;
		customElements.define(
			shellTag,
			class extends HTMLElement {
				constructor() {
					super();
					this.attachShadow({ mode: "open" });
				}
			},
		);
		const shell = document.createElement(shellTag);
		document.body.appendChild(shell);
		const inner = document.createElement(tag) as HTMLElement & {
			change(v: unknown): void;
		};
		shell.shadowRoot?.appendChild(inner);
		inner.change("answer");

		expect(commitPendingSessions(shell).committed).toBe(1);
	});

	it("reaches an element assigned to a slot", () => {
		// The section player projects its item pane through a slot on the
		// assessment toolkit, so a `children` walk that stops at `<slot>` finds
		// no delivery element in a whole section.
		const tag = defineCommittingElement();
		const wrapperTag = `pie-slotting-${(tagSeed += 1)}`;
		customElements.define(
			wrapperTag,
			class extends HTMLElement {
				constructor() {
					super();
					this.attachShadow({ mode: "open" });
					const slot = document.createElement("slot");
					this.shadowRoot?.appendChild(slot);
				}
			},
		);
		const wrapper = document.createElement(wrapperTag);
		document.body.appendChild(wrapper);
		const inner = document.createElement(tag) as HTMLElement & {
			change(v: unknown): void;
		};
		wrapper.appendChild(inner);
		inner.change("answer");

		expect(commitPendingSessions(wrapper.shadowRoot).committed).toBe(1);
	});

	it("commits the root element itself when it is a delivery element", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		element.change("answer");

		expect(commitPendingSessions(element).committed).toBe(1);
	});

	it("returns an empty result for a missing root", () => {
		expect(commitPendingSessions(null)).toEqual({
			committed: 0,
			synthesized: 0,
			skipped: 0,
		});
	});
});

describe("bindPageLifecycleCommit", () => {
	function hide() {
		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
	}

	function show() {
		Object.defineProperty(document, "visibilityState", {
			value: "visible",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
	}

	it("commits on a hidden transition and runs onHidden", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();
		const reasons: string[] = [];
		const unbind = bindPageLifecycleCommit({
			root: () => document.body,
			onHidden: (reason) => reasons.push(reason),
		});

		element.change("answer");
		hide();

		expect(observed.events).toHaveLength(1);
		expect(reasons).toEqual(["page-hidden"]);

		unbind();
		observed.stop();
		show();
	});

	it("commits on pagehide with no preceding visibilitychange", () => {
		// iOS Safari can freeze a page on `pagehide` alone.
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();
		const unbind = bindPageLifecycleCommit({ root: () => document.body });

		element.change("answer");
		window.dispatchEvent(new Event("pagehide"));

		expect(observed.events).toHaveLength(1);

		unbind();
		observed.stop();
	});

	it("announces once when pagehide follows visibilitychange", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();
		const unbind = bindPageLifecycleCommit({ root: () => document.body });

		element.change("answer");
		hide();
		window.dispatchEvent(new Event("pagehide"));

		expect(observed.events).toHaveLength(1);

		unbind();
		observed.stop();
		show();
	});

	it("commits input that arrives between visibilitychange and pagehide", () => {
		// A "once per hidden transition" guard drops this: the document already
		// reports hidden when the response lands, and the unload is the last
		// chance to announce it.
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();
		const unbind = bindPageLifecycleCommit({ root: () => document.body });

		element.change("answer");
		hide();
		element.change("a longer answer");
		window.dispatchEvent(new Event("pagehide"));

		expect(observed.events).toHaveLength(2);

		unbind();
		observed.stop();
		show();
	});

	it("commits again after the page comes back and the learner answers", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();
		const unbind = bindPageLifecycleCommit({ root: () => document.body });

		element.change("answer");
		hide();
		show();
		element.change("a longer answer");
		hide();

		expect(observed.events).toHaveLength(2);

		unbind();
		observed.stop();
		show();
	});

	it("stops committing after unbind", () => {
		const element = mount(defineCommittingElement()) as HTMLElement & {
			change(v: unknown): void;
		};
		const observed = observeDocument();
		const unbind = bindPageLifecycleCommit({ root: () => document.body });
		unbind();

		element.change("answer");
		hide();
		window.dispatchEvent(new Event("pagehide"));

		expect(observed.events).toHaveLength(0);
		observed.stop();
		show();
	});

	it("re-evaluates the root on every transition", () => {
		const tag = defineCommittingElement();
		let root: ParentNode | null = null;
		const unbind = bindPageLifecycleCommit({ root: () => root });
		const observed = observeDocument();

		hide();
		expect(observed.events).toHaveLength(0);

		show();
		const element = mount(tag) as HTMLElement & { change(v: unknown): void };
		element.change("answer");
		root = document.body;
		hide();

		expect(observed.events).toHaveLength(1);

		unbind();
		observed.stop();
		show();
	});
});
