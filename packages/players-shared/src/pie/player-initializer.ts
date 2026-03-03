/**
 * Shared PIE player initialization logic
 * Used by preloaded static player runtimes
 */

export interface PiePlayerConfig {
	env: any;
	addCorrectResponse: boolean;
	session: any[];
	externalStyleUrls?: string;
	customClassName?: string;
	containerClass?: string;
	passageContainerClass?: string;
}

export interface ItemData {
	item: {
		config: any;
	};
	passage?: {
		config: {
			markup?: string;
		};
	};
}

export interface PiePlayerElements {
	playerEl: HTMLElement;
	passageMarkup: string | null;
}

/**
 * Initialize PIE player with item data
 * Shared initialization for preloaded/static player entrypoints.
 */
export async function initializePiePlayer(
	itemData: ItemData,
	config: PiePlayerConfig,
	elements: PiePlayerElements,
): Promise<void> {
	const { playerEl } = elements;

	if (!itemData.item?.config || !playerEl) {
		throw new Error("Missing item config or player element");
	}

	// Ensure pie-player is loaded
	await ensurePiePlayerLoaded();

	const defaultEnv = config.env || { mode: "evaluate", role: "instructor" };

	// Configure player element
	(playerEl as any).config = itemData.item.config;
	(playerEl as any).env = defaultEnv;

	const shouldShowCorrect = !!(
		config.addCorrectResponse ||
		(defaultEnv.mode === "evaluate" && defaultEnv.role === "instructor")
	);
	(playerEl as any).addCorrectResponse = shouldShowCorrect;

	// Forward additional properties
	(playerEl as any).session = {
		id: "",
		data: Array.isArray(config.session) ? config.session : [],
	};

	if (config.externalStyleUrls) {
		(playerEl as any).externalStyleUrls = config.externalStyleUrls;
	}
	if (config.customClassName) {
		(playerEl as any).customClassName = config.customClassName;
	}
	if (config.containerClass) {
		(playerEl as any).containerClass = config.containerClass;
	}
	if (config.passageContainerClass) {
		(playerEl as any).passageContainerClass = config.passageContainerClass;
	}
}

/**
 * Extract passage markup from item data
 */
export function extractPassageMarkup(itemData: ItemData): string | null {
	return itemData.passage?.config?.markup || null;
}

/**
 * Ensure pie-player web component is loaded
 */
export async function ensurePiePlayerLoaded(): Promise<void> {
	if (customElements.get("pie-player")) return;

	const url =
		"https://cdn.jsdelivr.net/npm/@pie-players/pie-player-components@latest/dist/pie-player-components/pie-player-components.esm.js";

	await new Promise<void>((resolve, reject) => {
		const existing = document.querySelector(
			"script[data-pie-player]",
		) as HTMLScriptElement | null;
		if (existing) {
			existing.addEventListener("load", () => resolve());
			existing.addEventListener("error", () =>
				reject(new Error("failed to load pie-player")),
			);
			return;
		}

		const s = document.createElement("script");
		s.type = "module";
		s.dataset.piePlayer = "true";
		s.src = url;
		s.addEventListener("load", () => resolve());
		s.addEventListener("error", () =>
			reject(new Error("failed to load pie-player")),
		);
		document.head.appendChild(s);
	});

	await customElements.whenDefined("pie-player");
}

/**
 * Build event listeners map for PIE elements
 */
export function buildEventListenersMap(
	config: any,
	onSessionChanged: (detail: any) => void,
): Record<string, Record<string, (e: CustomEvent) => void>> | undefined {
	if (!config?.elements) return undefined;

	const listeners: Record<
		string,
		Record<string, (e: CustomEvent) => void>
	> = {};
	Object.keys(config.elements).forEach((elName) => {
		listeners[elName] = {
			"session-changed": (e: CustomEvent) => onSessionChanged(e.detail),
		};
	});
	return listeners;
}

/**
 * Build URL parameters for API request
 * Shared by preloaded/static player entrypoints.
 */
export function buildApiParams(
	env: any,
	addCorrectResponse: boolean,
): URLSearchParams {
	const params = new URLSearchParams();
	if (env && typeof env === "object") {
		if (env.mode) params.set("mode", String(env.mode));
		if (env.role) params.set("role", String(env.role));
	}
	if (addCorrectResponse) params.set("addCorrectResponse", "true");
	return params;
}

/**
 * Fetch item data from API
 * Shared by preloaded/static player entrypoints.
 */
export async function fetchItemData(
	apiBaseUrl: string,
	itemId: string,
	token: string,
	endpoint: "packaged" | "data-only",
	env: any,
	addCorrectResponse: boolean,
	signal?: AbortSignal,
): Promise<any> {
	if (typeof window === "undefined" || typeof document === "undefined") {
		throw new Error("PIE initialization must run in browser");
	}

	const params = buildApiParams(env, addCorrectResponse);
	const apiUrl = `${apiBaseUrl}/api/item/${itemId}/${endpoint}${params.toString() ? `?${params.toString()}` : ""}`;

	const response = await fetch(apiUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/json",
		},
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch item data: ${response.statusText}`);
	}

	return await response.json();
}
