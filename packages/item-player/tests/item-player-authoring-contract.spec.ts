import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_ID = "authoring-contract-fixture";
const AUTHORING_CONTRACT_PATH = `/demo/${DEMO_ID}/author?mode=gather&role=student`;
const PACKAGE_SPEC = "@pie-element/authoring-fixture@1.0.0";
const RUNTIME_TAG = "pie-authoring-fixture--version-1-0-0";
const MODEL_ID = "authoring-fixture-model";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson<T>(locator: Locator): Promise<T> {
	await expect(locator).toBeVisible();
	for (let attempt = 0; attempt < 30; attempt += 1) {
		const text = (await locator.textContent()) || "";
		try {
			return JSON.parse(text) as T;
		} catch {
			await sleep(100);
		}
	}
	throw new Error("JSON fixture output did not become parseable in time");
}

async function gotoAuthoringContract(page: Page, query = "") {
	await page.goto(`${AUTHORING_CONTRACT_PATH}${query}`, {
		waitUntil: "networkidle",
	});
	await expect(
		page.getByRole("heading", { name: "Authoring Contract Fixture" }),
	).toBeVisible();
	await expect(page.getByTestId("authoring-contract-harness")).toBeVisible();
}

async function readConfigureConfiguration(
	page: Page,
): Promise<Record<string, unknown> | null> {
	return await page.evaluate(() => {
		const configureElement = Array.from(
			document.querySelectorAll("pie-item-player *"),
		).find((element) => element.localName.endsWith("-config")) as any;
		return configureElement?.configuration ?? null;
	});
}

async function dispatchFromAuthoringRoot(
	page: Page,
	type: string,
	detail: Record<string, unknown>,
) {
	await page.evaluate(
		({ eventType, eventDetail }) => {
			const target =
				Array.from(document.querySelectorAll("pie-item-player *")).find(
					(element) => element.localName.endsWith("-config"),
				) ?? document.querySelector("pie-item-player");
			const detail =
				eventType === "insert.image"
					? {
							isPasted: false,
							cancel: () => {},
							fileChosen: () => {},
							progress: () => {},
							done: () => {},
						}
					: eventType === "insert.sound"
						? {
								cancel: () => {},
								fileChosen: () => {},
								progress: () => {},
								done: () => {},
							}
						: eventType === "delete.image" || eventType === "delete.sound"
							? {
									...eventDetail,
									done: () => {},
								}
							: eventDetail;
			target?.dispatchEvent(
				new CustomEvent(eventType, {
					bubbles: true,
					detail,
				}),
			);
		},
		{ eventType: type, eventDetail: detail },
	);
}

test.describe("item-player authoring contract", () => {
	test("loads versioned IIFE authoring config tags exactly once", async ({
		page,
	}) => {
		await page.goto(
			"/demo/fraction-model-simple-bar-halves/author?player=iife&pie-overrides%5Bpie-element%2Ffraction-model%5D=6.0.1",
			{ waitUntil: "networkidle" },
		);

		await expect(
			page.getByRole("heading", { name: "Simple Bar Model - Halves" }),
		).toBeVisible();
		await expect(page.getByText("Configuration Error")).not.toBeVisible();
		await expect(page.getByText("missing tags")).not.toBeVisible();
		await expect
			.poll(async () =>
				page.evaluate(() => ({
					configTagDefined: !!customElements.get(
						"fraction-model--version-6-0-1-config",
					),
					doubleConfigTagDefined: !!customElements.get(
						"fraction-model--version-6-0-1-config-config",
					),
				})),
			)
			.toEqual({
				configTagDefined: true,
				doubleConfigTagDefined: false,
			});
	});

	test("supports namespaced authoring config, lifecycle, validation, and media callbacks", async ({
		page,
	}) => {
		await gotoAuthoringContract(page);

		await expect
			.poll(async () => {
				const config = await readConfigureConfiguration(page);
				return config?.authoringOnly;
			})
			.toBe("versioned-tag-authoring-value");
		const elementConfig = await readConfigureConfiguration(page);
		expect(elementConfig).toMatchObject({
			deliveryShared: "delivery-value",
			authoringOnly: "versioned-tag-authoring-value",
			requirePrompt: true,
		});

		await page.evaluate(
			({ packageSpec, runtimeTag }) => {
				const player = document.querySelector("pie-item-player") as any;
				player.configuration = {
					[packageSpec]: {
						deliveryShared: "delivery-value",
					},
					authoring: {
						[runtimeTag]: {
							authoringOnly: "updated-authoring-value",
							requirePrompt: true,
						},
					},
				};
			},
			{ packageSpec: PACKAGE_SPEC, runtimeTag: RUNTIME_TAG },
		);
		await expect
			.poll(async () => {
				const config = await readConfigureConfiguration(page);
				return config?.authoringOnly;
			})
			.toBe("updated-authoring-value");

		await expect
			.poll(async () => {
				const eventLog = await readJson<Array<{ type: string; detail: any }>>(
					page.getByTestId("event-log"),
				);
				return eventLog.find((entry) => entry.type === "model-loaded")?.detail
					?.models?.[0]?.id;
			})
			.toBe(MODEL_ID);

		await page.getByTestId("run-validation").click();
		const validationResult = await readJson<{
			hasErrors: boolean;
			validatedModels: Array<{
				id: string;
				validation?: { authoringOnly?: string };
			}>;
		}>(page.getByTestId("validation-result"));
		expect(validationResult.hasErrors).toBe(false);
		expect(validationResult.validatedModels[0]).toMatchObject({
			id: MODEL_ID,
			validation: {
				authoringOnly: "updated-authoring-value",
			},
		});

		await dispatchFromAuthoringRoot(page, "model.updated", {
			update: {
				id: MODEL_ID,
				element: RUNTIME_TAG,
				prompt: "Updated by authoring contract e2e",
			},
			reset: false,
		});
		await expect
			.poll(async () => {
				const eventLog = await readJson<Array<{ type: string; detail: any }>>(
					page.getByTestId("event-log"),
				);
				return eventLog.find((entry) => entry.type === "model-updated")?.detail
					?.update?.prompt;
			})
			.toBe("Updated by authoring contract e2e");

		await dispatchFromAuthoringRoot(page, "insert.image", {});
		await dispatchFromAuthoringRoot(page, "delete.image", {
			src: "/fixture/image.png",
		});
		await dispatchFromAuthoringRoot(page, "insert.sound", {});
		await dispatchFromAuthoringRoot(page, "delete.sound", {
			src: "/fixture/sound.wav",
		});
		await expect
			.poll(async () => {
				const mediaCalls = await readJson<
					Array<{ type: string; src?: string }>
				>(page.getByTestId("media-call-log"));
				return mediaCalls.map((call) => call.type);
			})
			.toEqual([
				"insert-image",
				"delete-image",
				"insert-sound",
				"delete-sound",
			]);
	});

	test("required authoring backend blocks authoring UI when callbacks are missing", async ({
		page,
	}) => {
		await gotoAuthoringContract(page, "&missingBackend=1");

		await expect(
			page.getByText("Authoring Backend Configuration Error"),
		).toBeVisible();
		await expect(page.getByTestId("authoring-fixture")).toHaveCount(0);
		await expect
			.poll(async () => {
				const eventLog = await readJson<Array<{ type: string; detail: any }>>(
					page.getByTestId("event-log"),
				);
				return eventLog.find((entry) => entry.type === "player-error")?.detail
					?.code;
			})
			.toBe("AUTHORING_BACKEND_CONFIG_ERROR");
	});
});
