import { describe, expect, test } from "bun:test";
import { resolveSessionChangedForwarding } from "../src/session-forwarding";

const responsefulSession = {
	id: "metadata-session-item",
	data: [
		{
			id: "metadata-choice",
			element: "metadata-session-fixture--version-1-0-0",
			value: ["A"],
		},
	],
};

describe("resolveSessionChangedForwarding", () => {
	test("ignores unchanged non-metadata session details", () => {
		const result = resolveSessionChangedForwarding({
			currentSession: responsefulSession,
			currentSignature: JSON.stringify(responsefulSession),
			detail: {
				session: responsefulSession,
			},
			itemId: "metadata-session-item",
		});

		expect(result).toEqual({ action: "ignore" });
	});

	test("forwards post-renderer metadata snapshots as metadata-only details", () => {
		const detail = {
			session: {
				id: "",
				data: responsefulSession.data,
			},
			complete: true,
			component: "metadata-session-fixture--version-1-0-0",
		};
		const result = resolveSessionChangedForwarding({
			currentSession: responsefulSession,
			currentSignature: JSON.stringify(responsefulSession),
			detail,
			itemId: "metadata-session-item",
		});

		expect(result).toMatchObject({
			action: "forward",
			changed: false,
			metadataOnly: true,
			session: responsefulSession,
			signature: JSON.stringify(responsefulSession),
		});
		expect(result.action === "forward" ? result.detail : null).toEqual({
			...detail,
			intent: "metadata-only",
			session: null,
		});
	});

	test("keeps explicit empty-array clears as data changes", () => {
		const result = resolveSessionChangedForwarding({
			currentSession: responsefulSession,
			currentSignature: JSON.stringify(responsefulSession),
			detail: {
				session: {
					id: "metadata-choice",
					element: "metadata-session-fixture--version-1-0-0",
					value: [],
				},
			},
			itemId: "metadata-session-item",
		});

		expect(result).toMatchObject({
			action: "forward",
			changed: true,
			metadataOnly: false,
			session: {
				id: "metadata-session-item",
				data: [
					{
						id: "metadata-choice",
						element: "metadata-session-fixture--version-1-0-0",
						value: [],
					},
				],
			},
		});
	});

	test("keeps explicit empty-string clears as data changes", () => {
		const currentSession = {
			id: "metadata-session-item",
			data: [
				{
					id: "metadata-text",
					element: "text-entry--version-1-0-0",
					value: "typed answer",
				},
			],
		};
		const result = resolveSessionChangedForwarding({
			currentSession,
			currentSignature: JSON.stringify(currentSession),
			detail: {
				session: {
					id: "metadata-text",
					element: "text-entry--version-1-0-0",
					value: "",
				},
			},
			itemId: "metadata-session-item",
		});

		expect(result).toMatchObject({
			action: "forward",
			changed: true,
			metadataOnly: false,
			session: {
				id: "metadata-session-item",
				data: [
					{
						id: "metadata-text",
						element: "text-entry--version-1-0-0",
						value: "",
					},
				],
			},
		});
	});
});
