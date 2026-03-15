import { expect, test } from "@playwright/test";

const DEMO_PATH =
	"/session-hydrate-db?mode=candidate&layout=splitpane&page=session-page-one";
const ASSESSMENT_ID = "section-demos-assessment";
const SECTION_PAGE_ONE = "session-persistence-page-one";
const SECTION_PAGE_TWO = "session-persistence-page-two";

type ItemSessionValue = {
	session?: {
		data?: Array<{ value?: string }>;
	};
};

type SectionSnapshot = {
	itemSessions?: Record<string, ItemSessionValue>;
};

type SessionDemoState = {
	reconstructedSnapshots?: Record<string, SectionSnapshot>;
};

async function resolveAttemptId(page: import("@playwright/test").Page): Promise<string> {
	for (let index = 0; index < 25; index += 1) {
		const urlAttemptId = new URL(page.url()).searchParams.get("attempt") || "";
		if (urlAttemptId) return urlAttemptId;
		const storedAttemptId = await page.evaluate(() => {
			return window.localStorage.getItem("pie:section-demos:attempt-id") || "";
		});
		if (storedAttemptId) return storedAttemptId;
		await page.waitForTimeout(100);
	}
	throw new Error("Attempt id was not resolved from URL or localStorage");
}

function getChoiceValue(snapshot: SectionSnapshot | null, itemId: string): string {
	const entry = snapshot?.itemSessions?.[itemId];
	const values = Array.isArray(entry?.session?.data) ? entry.session.data : [];
	const first = values[0];
	return typeof first?.value === "string" ? first.value : "";
}

function getSnapshotFingerprint(snapshot: SectionSnapshot | null): string {
	try {
		return JSON.stringify(snapshot?.itemSessions || {});
	} catch {
		return "";
	}
}

async function readSectionSnapshot(args: {
	page: import("@playwright/test").Page;
	origin: string;
	attemptId: string;
	sectionId: string;
}): Promise<SectionSnapshot | null> {
	const query = new URLSearchParams({
		assessmentId: ASSESSMENT_ID,
		attemptId: args.attemptId,
		sectionId: args.sectionId,
	});
	const response = await args.page.request.get(
		`${args.origin}/api/session-demo/snapshot?${query.toString()}`,
	);
	expect(response.ok()).toBe(true);
	const payload = (await response.json()) as {
		ok?: boolean;
		snapshot?: SectionSnapshot | null;
	};
	expect(payload.ok).toBe(true);
	return payload.snapshot || null;
}

async function readSessionDemoState(
	args: { page: import("@playwright/test").Page; origin: string },
): Promise<SessionDemoState> {
	const response = await args.page.request.get(`${args.origin}/api/session-demo/state`);
	expect(response.ok()).toBe(true);
	const payload = (await response.json()) as {
		ok?: boolean;
		state?: SessionDemoState;
	};
	expect(payload.ok).toBe(true);
	return payload.state || {};
}

async function openSessionDbPanel(page: import("@playwright/test").Page): Promise<void> {
	const toggleButton = page.getByRole("button", {
		name: "Toggle database state panel",
	});
	await expect(toggleButton).toBeVisible();
	const pressed = (await toggleButton.getAttribute("aria-pressed")) === "true";
	if (!pressed) {
		await toggleButton.click();
	}
}

async function clickResetDbButton(page: import("@playwright/test").Page): Promise<void> {
	const clicked = await page.evaluate(() => {
		const scan = (root: Document | ShadowRoot): HTMLButtonElement | null => {
			const buttons = Array.from(root.querySelectorAll("button"));
			for (const button of buttons) {
				const label = (button.textContent || "").trim();
				if (
					label.includes("Reset DB to baseline") ||
					label.includes("Resetting to baseline")
				) {
					return button;
				}
			}
			const elements = Array.from(root.querySelectorAll("*"));
			for (const element of elements) {
				const shadowRoot = (element as HTMLElement).shadowRoot;
				if (!shadowRoot) continue;
				const found = scan(shadowRoot);
				if (found) return found;
			}
			return null;
		};
		const target = scan(document);
		if (!target) return false;
		target.click();
		return true;
	});
	expect(clicked).toBe(true);
}

async function chooseVisibleUncheckedAnswer(
	page: import("@playwright/test").Page,
): Promise<void> {
	const choiceLabel = page.getByText("It could appoint the Holy Roman Emperor", { exact: true });
	await expect(choiceLabel).toBeVisible({ timeout: 30000 });
	await choiceLabel.click();
}

test.describe("session hydrate db flow", () => {
	test("hydrates baseline, persists user updates, and resets in one click", async ({
		page,
	}) => {
		const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5301";
		await page.goto(new URL(DEMO_PATH, baseUrl).toString(), { waitUntil: "domcontentloaded" });
		const origin = new URL(page.url()).origin;
		const attemptId = await resolveAttemptId(page);
		const baselineSnapshot = await readSectionSnapshot({
			page,
			origin,
			attemptId,
			sectionId: SECTION_PAGE_ONE,
		});
		const baselineFingerprint = getSnapshotFingerprint(baselineSnapshot);

		await expect
			.poll(async () => {
				const snapshot = await readSectionSnapshot({
					page,
					origin,
					attemptId,
					sectionId: SECTION_PAGE_ONE,
				});
				return getChoiceValue(snapshot, "sp1-q2");
			})
			.toBe("");

		await expect
			.poll(async () => {
				const snapshot = await readSectionSnapshot({
					page,
					origin,
					attemptId,
					sectionId: SECTION_PAGE_TWO,
				});
				const values = snapshot?.itemSessions?.["sp2-q2"]?.session?.data;
				return Array.isArray(values) ? values.length : 0;
			})
			.toBe(0);

		await chooseVisibleUncheckedAnswer(page);

		await expect
			.poll(async () => {
				const snapshot = await readSectionSnapshot({
					page,
					origin,
					attemptId,
					sectionId: SECTION_PAGE_ONE,
				});
				return getSnapshotFingerprint(snapshot);
			}, { timeout: 10000 })
			.not.toBe(baselineFingerprint);

		const updatedSnapshot = await readSectionSnapshot({
			page,
			origin,
			attemptId,
			sectionId: SECTION_PAGE_ONE,
		});
		const updatedFingerprint = getSnapshotFingerprint(updatedSnapshot);

		await expect
			.poll(async () => {
				const state = await readSessionDemoState({ page, origin });
				const key = `${ASSESSMENT_ID}:${SECTION_PAGE_ONE}:${attemptId}`;
				return getSnapshotFingerprint(state.reconstructedSnapshots?.[key] || null);
			}, { timeout: 10000 })
			.toBe(updatedFingerprint);

		await page.reload({ waitUntil: "domcontentloaded" });

		await expect
			.poll(async () => {
				const snapshot = await readSectionSnapshot({
					page,
					origin,
					attemptId,
					sectionId: SECTION_PAGE_ONE,
				});
				return getSnapshotFingerprint(snapshot);
			})
			.toBe(updatedFingerprint);

		await openSessionDbPanel(page);
		await clickResetDbButton(page);

		await expect
			.poll(async () => {
				const snapshot = await readSectionSnapshot({
					page,
					origin,
					attemptId,
					sectionId: SECTION_PAGE_ONE,
				});
				return getSnapshotFingerprint(snapshot);
			})
			.toBe(baselineFingerprint);

		await expect
			.poll(async () => {
				const state = await readSessionDemoState({ page, origin });
				const key = `${ASSESSMENT_ID}:${SECTION_PAGE_ONE}:${attemptId}`;
				return getSnapshotFingerprint(state.reconstructedSnapshots?.[key] || null);
			})
			.toBe(baselineFingerprint);

		await page.waitForTimeout(1500);
		const stableSnapshot = await readSectionSnapshot({
			page,
			origin,
			attemptId,
			sectionId: SECTION_PAGE_ONE,
		});
		expect(getSnapshotFingerprint(stableSnapshot)).toBe(baselineFingerprint);
	});
});
