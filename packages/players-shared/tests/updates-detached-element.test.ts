import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";

import { updatePieElement } from "../src/pie/updates.js";
import { BundleType, Status } from "../src/pie/types.js";
import type { ConfigEntity } from "../src/types/index.js";

const TAG = "pie-multiple-choice--version-13-3-1";

const config: ConfigEntity = {
	markup: `<${TAG} id="q1"></${TAG}>`,
	elements: { [TAG]: "@pie-element/multiple-choice@13.3.1" },
	models: [{ id: "q1", element: TAG }],
};

const env = { mode: "gather", role: "student" } as const;

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

beforeEach(() => {
	document.body.innerHTML = "";
	(window as unknown as { PIE_REGISTRY?: unknown }).PIE_REGISTRY = {};
});

function registerController(model: () => Promise<unknown>) {
	(window as any).PIE_REGISTRY[TAG] = {
		package: config.elements[TAG],
		status: Status.loaded,
		tagName: TAG,
		controller: { model },
		bundleType: BundleType.clientPlayer,
	};
}

/** Build the element and record each property the update writes to it. */
function recordingElement({ inserted }: { inserted: boolean }) {
	const container = document.createElement("section");
	container.innerHTML = config.markup;
	if (inserted) document.body.append(container);
	const element = container.querySelector(TAG) as HTMLElement;
	const writes: string[] = [];
	for (const prop of ["model", "session"]) {
		Object.defineProperty(element, prop, {
			configurable: true,
			set: () => writes.push(prop),
		});
	}
	return { container, writes };
}

describe("updatePieElement and the element's place in the document", () => {
	test("a connected element takes the model and session", async () => {
		registerController(async () => ({ mode: "gather" }));
		const { container, writes } = recordingElement({ inserted: true });

		await updatePieElement(TAG, { config, session: [], env, container });

		expect(writes).toEqual(["model", "session"]);
	});

	test("an element set up before it is inserted takes the model and session", async () => {
		registerController(async () => ({ mode: "gather" }));
		const { container, writes } = recordingElement({ inserted: false });

		await updatePieElement(TAG, { config, session: [], env, container });

		expect(writes).toEqual(["model", "session"]);
	});

	test("an element removed while its controller runs takes nothing", async () => {
		let resolveModel: (value: unknown) => void = () => {};
		registerController(
			() => new Promise((resolve) => (resolveModel = resolve)),
		);
		const { container, writes } = recordingElement({ inserted: true });

		const update = updatePieElement(TAG, {
			config,
			session: [],
			env,
			container,
		});
		container.remove();
		resolveModel({ mode: "gather" });
		await update;

		expect(writes).toEqual([]);
	});

	test("an element removed while its controller fails takes no fallback", async () => {
		let rejectModel: (reason: unknown) => void = () => {};
		registerController(
			() => new Promise((_resolve, reject) => (rejectModel = reject)),
		);
		const { container, writes } = recordingElement({ inserted: true });

		const update = updatePieElement(TAG, {
			config,
			session: [],
			env,
			container,
		});
		container.remove();
		rejectModel(new Error("controller failed"));
		await update;

		expect(writes).toEqual([]);
	});
});
