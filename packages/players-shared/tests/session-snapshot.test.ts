import { describe, expect, it } from "bun:test";
import {
	createSessionSnapshot,
	isSessionSnapshotEnabled,
	sessionSnapshotKey,
	type SessionSnapshotStore,
} from "../src/pie/session-snapshot.js";

function memoryStore(): SessionSnapshotStore & {
	entries: Map<string, string>;
} {
	const entries = new Map<string, string>();
	return {
		entries,
		read: (key) => entries.get(key) ?? null,
		write: (key, value) => {
			entries.set(key, value);
		},
		clear: (key) => {
			entries.delete(key);
		},
	};
}

function throwingStore(): SessionSnapshotStore {
	return {
		read() {
			throw new Error("blocked site data");
		},
		write() {
			throw new Error("blocked site data");
		},
		clear() {
			throw new Error("blocked site data");
		},
	};
}

describe("isSessionSnapshotEnabled", () => {
	it("is off unless the host opts in", () => {
		expect(isSessionSnapshotEnabled(undefined)).toBe(false);
		expect(isSessionSnapshotEnabled(null)).toBe(false);
		expect(isSessionSnapshotEnabled(false)).toBe(false);
		expect(isSessionSnapshotEnabled({ enabled: false })).toBe(false);
	});

	it("is on for `true` and for an object without an explicit disable", () => {
		expect(isSessionSnapshotEnabled(true)).toBe(true);
		expect(isSessionSnapshotEnabled({})).toBe(true);
		expect(isSessionSnapshotEnabled({ enabled: true })).toBe(true);
	});
});

describe("sessionSnapshotKey", () => {
	it("separates two sittings on the same item", () => {
		const first = sessionSnapshotKey({ itemId: "i1", sessionId: "s1" });
		const second = sessionSnapshotKey({ itemId: "i1", sessionId: "s2" });
		expect(first).not.toBe(second);
	});
});

describe("createSessionSnapshot", () => {
	it("returns null when the host has not opted in", () => {
		expect(
			createSessionSnapshot({ config: undefined, identity: { itemId: "i1" } }),
		).toBeNull();
	});

	it("writes and reads back a committed session with a timestamp", () => {
		const store = memoryStore();
		const snapshot = createSessionSnapshot({
			config: { store },
			identity: { itemId: "i1", sessionId: "s1" },
		});

		snapshot?.write({ id: "s1", data: [{ id: "el-1", value: "answer" }] });
		const record = snapshot?.read();

		expect(record?.session).toEqual({
			id: "s1",
			data: [{ id: "el-1", value: "answer" }],
		});
		expect(record?.timestamp).toBeGreaterThan(0);
		expect(record?.key).toBe(snapshot?.key);
	});

	it("clears the snapshot", () => {
		const store = memoryStore();
		const snapshot = createSessionSnapshot({
			config: { store },
			identity: { itemId: "i1", sessionId: "s1" },
		});
		expect(snapshot).not.toBeNull();

		snapshot?.write({ id: "s1", data: [{ id: "el-1", value: "a" }] });
		expect(store.entries.size).toBe(1);
		snapshot?.clear();

		expect(snapshot?.read()).toBeNull();
		expect(store.entries.size).toBe(0);
	});

	it("returns null when the identity does not name one sitting", () => {
		// The item id alone is the same for every learner, so a shared device
		// would offer one student's draft to the next. The offer is the
		// disclosure, whether or not the host applies it.
		const store = memoryStore();

		expect(
			createSessionSnapshot({ config: { store }, identity: { itemId: "i1" } }),
		).toBeNull();
		expect(createSessionSnapshot({ config: { store }, identity: {} })).toBeNull();
		expect(
			createSessionSnapshot({
				config: { store },
				identity: { itemId: "i1", assignmentId: "a1" },
			}),
		).toBeNull();
		expect(store.entries.size).toBe(0);
	});

	it("lets a host without a delivery identity opt in with an explicit key", () => {
		const store = memoryStore();
		const snapshot = createSessionSnapshot({
			config: { store, key: "host-owned-key" },
			identity: { itemId: "i1" },
		});

		expect(snapshot).not.toBeNull();
		snapshot?.write({ id: "", data: [] });
		expect(store.entries.has("host-owned-key")).toBe(true);
	});

	it("ignores a snapshot written under another key", () => {
		const store = memoryStore();
		const written = createSessionSnapshot({
			config: { store },
			identity: { itemId: "i1", sessionId: "s1" },
		});
		written?.write({ id: "s1", data: [{ id: "el-1", value: "answer" }] });

		const other = createSessionSnapshot({
			config: { store },
			identity: { itemId: "i1", sessionId: "s2" },
		});

		expect(other?.read()).toBeNull();
	});

	it("degrades to no snapshot when the store throws", () => {
		const snapshot = createSessionSnapshot({
			config: { store: throwingStore() },
			identity: { itemId: "i1", sessionId: "s1" },
		});
		expect(snapshot).not.toBeNull();

		expect(() => snapshot?.write({ id: "", data: [] })).not.toThrow();
		expect(() => snapshot?.clear()).not.toThrow();
		expect(snapshot?.read()).toBeNull();
	});

	it("ignores a stored value that is not a snapshot record", () => {
		const store = memoryStore();
		const snapshot = createSessionSnapshot({
			config: { store },
			identity: { itemId: "i1", sessionId: "s1" },
		});
		expect(snapshot).not.toBeNull();
		store.write(snapshot?.key ?? "", "not json");

		expect(snapshot?.read()).toBeNull();
	});
});
