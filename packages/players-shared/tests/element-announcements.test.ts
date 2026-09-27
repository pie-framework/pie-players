import { describe, expect, it } from "bun:test";
import {
	createElementAnnouncementFilter,
	holdsPlaceholderSession,
	sessionSignature,
} from "../src/pie/element-announcements.js";

describe("sessionSignature", () => {
	it("signs objects with the same content alike, whatever their key order", () => {
		expect(sessionSignature({ id: "a", value: ["x"], element: "mc" })).toBe(
			sessionSignature({ element: "mc", value: ["x"], id: "a" }),
		);
		expect(sessionSignature({ id: "a", value: ["x"] })).not.toBe(
			sessionSignature({ id: "a", value: ["y"] }),
		);
	});

	it("writes a cycle as a marker", () => {
		const record: Record<string, unknown> = { id: "a" };
		record.self = record;
		expect(sessionSignature(record)).toBe('{"id":"a","self":"[Circular]"}');
	});

	it("returns null for a value it cannot serialize", () => {
		expect(sessionSignature({ big: BigInt(1) })).toBeNull();
	});
});

describe("createElementAnnouncementFilter", () => {
	it("admits an element's first announcement and drops an unchanged repeat", () => {
		const admit = createElementAnnouncementFilter();
		const element = new EventTarget();
		const session = { id: "a", element: "mc" };
		const announcement = { element, complete: false, session, commit: false };

		expect(admit(announcement)).toBe(true);
		expect(admit({ ...announcement, session: { ...session } })).toBe(false);
	});

	it("admits a changed complete and a changed session", () => {
		const admit = createElementAnnouncementFilter();
		const element = new EventTarget();
		const session: Record<string, unknown> = { id: "a" };

		expect(admit({ element, complete: false, session, commit: false })).toBe(
			true,
		);
		session.value = ["x"];
		expect(admit({ element, complete: false, session, commit: false })).toBe(
			true,
		);
		expect(admit({ element, complete: true, session, commit: false })).toBe(
			true,
		);
		expect(admit({ element, complete: true, session, commit: false })).toBe(
			false,
		);
	});

	it("keys by element instance", () => {
		const admit = createElementAnnouncementFilter();
		const first = new EventTarget();
		const second = new EventTarget();
		const session = { id: "a" };

		expect(
			admit({ element: first, complete: false, session, commit: false }),
		).toBe(true);
		expect(
			admit({ element: second, complete: false, session, commit: false }),
		).toBe(true);
		expect(
			admit({ element: first, complete: false, session, commit: false }),
		).toBe(false);
	});

	it("always admits a commit", () => {
		const admit = createElementAnnouncementFilter();
		const element = new EventTarget();
		const session = { id: "a", value: ["x"] };

		expect(admit({ element, complete: true, session, commit: false })).toBe(
			true,
		);
		expect(admit({ element, complete: true, session, commit: true })).toBe(
			true,
		);
		expect(admit({ element, complete: true, session, commit: false })).toBe(
			false,
		);
	});

	it("admits what it cannot key or sign", () => {
		const admit = createElementAnnouncementFilter();
		const element = new EventTarget();
		const unsignable = { big: BigInt(1) };

		expect(
			admit({ element: null, complete: false, session: {}, commit: false }),
		).toBe(true);
		expect(
			admit({ element: null, complete: false, session: {}, commit: false }),
		).toBe(true);
		expect(
			admit({ element, complete: false, session: unsignable, commit: false }),
		).toBe(true);
		expect(
			admit({ element, complete: false, session: unsignable, commit: false }),
		).toBe(true);
	});
});

describe("holdsPlaceholderSession", () => {
	it("is false for the entry itself and for an equal copy of it", () => {
		const entry = { id: "a", value: ["x"] };
		expect(holdsPlaceholderSession(entry, entry)).toBe(false);
		expect(holdsPlaceholderSession({ value: ["x"], id: "a" }, entry)).toBe(
			false,
		);
	});

	it("is true for a session the entry does not match", () => {
		expect(holdsPlaceholderSession({ id: "a", element: "mc" }, undefined)).toBe(
			true,
		);
		expect(
			holdsPlaceholderSession(
				{ id: "a", element: "mc" },
				{ id: "a", element: "mc", value: ["x"] },
			),
		).toBe(true);
	});

	it("is false when the element holds no readable session", () => {
		expect(holdsPlaceholderSession(undefined, { id: "a" })).toBe(false);
	});
});
