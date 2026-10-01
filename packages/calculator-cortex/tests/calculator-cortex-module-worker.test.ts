import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { startModuleWorker } from "../src/module-worker.js";

interface Listener {
	listener: () => void;
	once: boolean;
}

class RecordingWorker {
	static readonly created: RecordingWorker[] = [];
	readonly listeners = new Map<string, Listener[]>();

	constructor(
		readonly url: string | URL,
		readonly options: WorkerOptions | undefined,
	) {
		RecordingWorker.created.push(this);
	}

	addEventListener(
		type: string,
		listener: () => void,
		options?: AddEventListenerOptions,
	): void {
		this.listeners.set(type, [
			...(this.listeners.get(type) ?? []),
			{ listener, once: options?.once === true },
		]);
	}

	emit(type: string): void {
		const registered = this.listeners.get(type) ?? [];
		this.listeners.set(
			type,
			registered.filter((entry) => !entry.once),
		);
		for (const { listener } of registered) listener();
	}
}

const globals = globalThis as Record<string, unknown>;
const originals = {
	Worker: globals.Worker,
	location: globals.location,
	createObjectURL: URL.createObjectURL,
	revokeObjectURL: URL.revokeObjectURL,
};

let blobs: Blob[];
let revoked: string[];

function setPageOrigin(origin: string | undefined): void {
	if (origin === undefined) {
		delete globals.location;
		return;
	}
	globals.location = { origin };
}

const start = (url: string) =>
	startModuleWorker(
		(Worker) =>
			new Worker(new URL(url), { type: "module", name: "pie-calculator-cortex" }),
	) as unknown as RecordingWorker;

beforeEach(() => {
	RecordingWorker.created.length = 0;
	blobs = [];
	revoked = [];
	globals.Worker = RecordingWorker;
	URL.createObjectURL = (blob: Blob | MediaSource) => {
		blobs.push(blob as Blob);
		return `blob:https://page.example/${blobs.length}`;
	};
	URL.revokeObjectURL = (url: string) => {
		revoked.push(url);
	};
});

afterEach(() => {
	globals.Worker = originals.Worker;
	if (originals.location === undefined) delete globals.location;
	else globals.location = originals.location;
	URL.createObjectURL = originals.createObjectURL;
	URL.revokeObjectURL = originals.revokeObjectURL;
});

describe("startModuleWorker", () => {
	test("starts a same-origin script directly", () => {
		setPageOrigin("https://page.example");
		const worker = start("https://page.example/assets/evaluation-worker.js");

		expect(String(worker.url)).toBe(
			"https://page.example/assets/evaluation-worker.js",
		);
		expect(worker.options).toEqual({
			type: "module",
			name: "pie-calculator-cortex",
		});
		expect(blobs).toEqual([]);
	});

	test("starts a cross-origin script from a blob module that imports it", async () => {
		setPageOrigin("https://page.example");
		const worker = start("https://cdn.example/pkg/assets/evaluation-worker.js");

		expect(worker.url).toBe("blob:https://page.example/1");
		expect(worker.options).toEqual({
			type: "module",
			name: "pie-calculator-cortex",
		});
		expect(blobs).toHaveLength(1);
		expect(blobs[0].type).toStartWith("text/javascript");
		expect(await blobs[0].text()).toBe(
			'import "https://cdn.example/pkg/assets/evaluation-worker.js";',
		);
	});

	test("keeps the blob URL until the worker first answers", () => {
		setPageOrigin("https://page.example");
		const worker = start("https://cdn.example/evaluation-worker.js");
		expect(revoked).toEqual([]);

		worker.emit("message");
		worker.emit("message");
		expect(revoked).toEqual(["blob:https://page.example/1"]);
	});

	test("revokes the blob URL when the worker fails to start", () => {
		setPageOrigin("https://page.example");
		const worker = start("https://cdn.example/evaluation-worker.js");

		worker.emit("error");
		expect(revoked).toEqual(["blob:https://page.example/1"]);
	});

	test("never wraps a non-http script", () => {
		setPageOrigin("https://page.example");
		const worker = start("file:///work/dist/assets/evaluation-worker.js");

		expect(String(worker.url)).toBe("file:///work/dist/assets/evaluation-worker.js");
		expect(blobs).toEqual([]);
	});

	test("never wraps when the page has no origin", () => {
		setPageOrigin(undefined);
		const worker = start("https://cdn.example/evaluation-worker.js");

		expect(String(worker.url)).toBe("https://cdn.example/evaluation-worker.js");
		expect(blobs).toEqual([]);
	});
});
