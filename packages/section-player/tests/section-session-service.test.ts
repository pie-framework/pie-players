import { describe, expect, test } from "bun:test";
import { SectionSessionService } from "../src/controllers/SectionSessionService";

describe("SectionSessionService.applyItemSessionChanged", () => {
	test("preserves merge intent metadata and canonical session shape", () => {
		const service = new SectionSessionService();
		const { testAttemptSession, itemSessions } = service.resolve({
			assessmentId: "a-1",
			sectionId: "s-1",
			view: "candidate",
			section: null,
			adapterItemRefs: [{ identifier: "item-1", item: { id: "item-1" } }],
		});

		const result = service.applyItemSessionChanged({
			itemId: "item-1",
			sessionDetail: {
				session: { id: "input-1", value: "A" },
				component: "input-1",
				complete: true,
			},
			testAttemptSession,
			itemSessions,
		});

		expect(result.eventDetail.itemId).toBe("item-1");
		expect(result.eventDetail.intent).toBe("merge-element-session");
		expect(result.eventDetail.complete).toBe(true);
		expect("sessionState" in (result.eventDetail as Record<string, unknown>)).toBe(false);
		expect("itemSessions" in (result.eventDetail as Record<string, unknown>)).toBe(false);
		expect((result.eventDetail.session as any).data).toEqual([
			{ id: "input-1", value: "A" },
		]);
	});

	test("metadata-only emits null session payload", () => {
		const service = new SectionSessionService();
		const { testAttemptSession, itemSessions } = service.resolve({
			assessmentId: "a-1",
			sectionId: "s-1",
			view: "candidate",
			section: null,
			adapterItemRefs: [{ identifier: "item-1", item: { id: "item-1" } }],
		});
		const seeded = service.applyItemSessionChanged({
			itemId: "item-1",
			sessionDetail: {
				session: { id: "choice", value: "A" },
				component: "choice",
				complete: false,
			},
			testAttemptSession,
			itemSessions,
		});
		const result = service.applyItemSessionChanged({
			itemId: "item-1",
			sessionDetail: {
				complete: false,
				component: "choice",
			},
			testAttemptSession: seeded.testAttemptSession,
			itemSessions: seeded.itemSessions,
		});
		expect(result.eventDetail.intent).toBe("metadata-only");
		expect(result.eventDetail.session).toBeNull();
	});
});
