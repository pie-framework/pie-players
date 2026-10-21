import type { ItemPlayerLoadInputs } from "@pie-players/pie-item-player";
import type { ItemConfig } from "@pie-players/pie-players-shared/types";

/** The player inputs that decide which element code loads; rows sharing them share a load. */
export type PlayerLoadInputs = Pick<ItemPlayerLoadInputs, "strategy" | "loaderOptions" | "loaderConfig">;

export interface PlayerRequest {
	/** Observed for visibility; the player mounts only once it nears the viewport. */
	element: Element;
	config: ItemConfig;
	inputs: PlayerLoadInputs;
	/** The row may mount its player now. */
	grant(): void;
	/** The granted player did not load in time; its slot is already free. */
	timeout(): void;
}

/** A row's place in the schedule. */
export interface PlayerTicket {
	/** Frees the row's slot once its player has loaded or failed, or cancels a pending request. */
	release(): void;
}

export interface PlayerScheduler {
	request(request: PlayerRequest): PlayerTicket;
}

export interface PlayerSchedulerOptions {
	/** Players loading at once, page-wide. */
	maxConcurrent: number;
	/** How long a granted player has to load before its row gives up on it. */
	loadTimeoutMs: number;
	/** Distance from the viewport at which a row counts as visible. */
	rootMargin: string;
	/** Registers the elements of a batch of items in one load. */
	preload(configs: ItemConfig[], inputs: PlayerLoadInputs): Promise<void>;
	/** Default `IntersectionObserver`; without one, every row counts as visible. */
	createObserver?: (
		callback: IntersectionObserverCallback,
		options: IntersectionObserverInit,
	) => Pick<IntersectionObserver, "observe" | "unobserve">;
}

type State = "waiting" | "preloading" | "ready" | "granted" | "released";

interface Entry {
	request: PlayerRequest;
	state: State;
	visible: boolean;
	timer?: ReturnType<typeof setTimeout>;
}

/**
 * Mounts players as their rows near the viewport. Rows that become visible together register
 * their elements in one aggregated load per set of load inputs, and at most `maxConcurrent`
 * players load at once; the rest wait in the order they became visible.
 */
export function createPlayerScheduler(options: PlayerSchedulerOptions): PlayerScheduler {
	const entries = new Map<Element, Entry>();
	const ready: Entry[] = [];
	let batch: Entry[] = [];
	let active = 0;
	// Load inputs are grouped by identity: a list passes every row the same objects.
	const inputIds = new WeakMap<object, number>();
	let nextInputId = 0;

	const observerFactory =
		options.createObserver ??
		(typeof IntersectionObserver === "function"
			? (callback: IntersectionObserverCallback, init: IntersectionObserverInit) =>
					new IntersectionObserver(callback, init)
			: undefined);
	const observer = observerFactory?.(
		(observed) => {
			for (const { target, isIntersecting } of observed) {
				const entry = entries.get(target);
				if (entry) setVisible(entry, isIntersecting);
			}
		},
		{ rootMargin: options.rootMargin },
	);

	function setVisible(entry: Entry, visible: boolean): void {
		entry.visible = visible;
		if (!visible) return;
		if (entry.state === "waiting") {
			entry.state = "preloading";
			if (batch.length === 0) queueMicrotask(flush);
			batch.push(entry);
		} else if (entry.state === "ready") {
			pump();
		}
	}

	function inputId(value: object | undefined): string {
		if (!value) return "";
		let id = inputIds.get(value);
		if (id === undefined) {
			id = nextInputId++;
			inputIds.set(value, id);
		}
		return String(id);
	}

	function groupKey({ strategy, loaderOptions, loaderConfig }: PlayerLoadInputs): string {
		return `${strategy ?? ""}:${inputId(loaderOptions)}:${inputId(loaderConfig)}`;
	}

	function flush(): void {
		const groups = new Map<string, Entry[]>();
		for (const entry of batch) {
			if (entry.state !== "preloading") continue;
			const key = groupKey(entry.request.inputs);
			groups.set(key, [...(groups.get(key) ?? []), entry]);
		}
		batch = [];
		for (const group of groups.values()) {
			const { inputs } = group[0].request;
			void options
				.preload(
					group.map((entry) => entry.request.config),
					inputs,
				)
				// A failed load is the player's to report: it loads again and fails with detail.
				.catch(() => {})
				.then(() => {
					for (const entry of group) {
						if (entry.state !== "preloading") continue;
						entry.state = "ready";
						ready.push(entry);
					}
					pump();
				});
		}
	}

	function pump(): void {
		for (let index = 0; index < ready.length && active < options.maxConcurrent; ) {
			const entry = ready[index];
			if (!entry.visible) {
				index += 1;
				continue;
			}
			ready.splice(index, 1);
			entry.state = "granted";
			active += 1;
			observer?.unobserve(entry.request.element);
			entry.timer = setTimeout(() => {
				if (entry.state !== "granted") return;
				finish(entry);
				entry.request.timeout();
			}, options.loadTimeoutMs);
			entry.request.grant();
		}
	}

	function finish(entry: Entry): void {
		if (entry.state === "released") return;
		if (entry.state === "granted") {
			active -= 1;
			clearTimeout(entry.timer);
		} else {
			observer?.unobserve(entry.request.element);
			const queued = ready.indexOf(entry);
			if (queued >= 0) ready.splice(queued, 1);
		}
		entry.state = "released";
		if (entries.get(entry.request.element) === entry) entries.delete(entry.request.element);
		pump();
	}

	return {
		request(request) {
			const previous = entries.get(request.element);
			if (previous) finish(previous);
			const entry: Entry = { request, state: "waiting", visible: false };
			entries.set(request.element, entry);
			if (observer) observer.observe(request.element);
			else setVisible(entry, true);
			return { release: () => finish(entry) };
		},
	};
}

let pageScheduler: PlayerScheduler | undefined;

/** The page's one scheduler, so every row on the page shares the concurrency cap. */
export function playerScheduler(): PlayerScheduler {
	pageScheduler ??= createPlayerScheduler({
		maxConcurrent: 3,
		loadTimeoutMs: 30_000,
		rootMargin: "200px 0px",
		preload: async (configs, inputs) => {
			const { preloadItemElements } = await loadItemPlayer();
			await preloadItemElements(configs, inputs);
		},
	});
	return pageScheduler;
}

let itemPlayer: Promise<typeof import("@pie-players/pie-item-player")> | undefined;

/** Imports, and so registers, `<pie-item-player>` on the first expanded row. */
export function loadItemPlayer(): Promise<typeof import("@pie-players/pie-item-player")> {
	itemPlayer ??= import("@pie-players/pie-item-player").catch((error: unknown) => {
		itemPlayer = undefined;
		throw error;
	});
	return itemPlayer;
}
