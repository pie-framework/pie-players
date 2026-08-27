import type {
	Calculator,
	CalculatorProvider,
	CalculatorProviderCapabilities,
	CalculatorProviderConfig,
	CalculatorState,
	CalculatorType,
} from "@pie-players/pie-calculator";

const DEFAULT_SCRIPT_URL = "https://www.geogebra.org/apps/deployggb.js";
const DEFAULT_APPLET_TIMEOUT_MS = 20_000;
let nextAppletId = 0;

interface GeoGebraAppletApi {
	evalCommand?(expression: string): boolean;
	evalCommandCAS?(expression: string): string;
	evalCommandGetLabels?(expression: string): string;
	getBase64?(): string;
	setBase64?(value: string, callback?: () => void): void;
	getEditorState?(): unknown;
	setEditorState?(state: unknown): void;
	newConstruction?(): void;
	setSize?(width: number, height: number): void;
	recalculateEnvironments?(): void;
	remove?(): void;
}

interface GeoGebraAppletParameters extends Record<string, unknown> {
	appName: "graphing" | "scientific";
	width: number;
	height: number;
	id: string;
	appletOnLoad: (api: GeoGebraAppletApi) => void;
}

interface GeoGebraAppletEmbed {
	inject(target: string): void;
}

interface GeoGebraAppletConstructor {
	new (
		parameters: GeoGebraAppletParameters,
		useBrowserForJavaScript?: boolean,
	): GeoGebraAppletEmbed;
}

declare global {
	interface Window {
		GGBApplet?: GeoGebraAppletConstructor;
	}
}

export interface GeoGebraCalculatorProviderConfig {
	/** Override only when the deployment's GeoGebra license permits that source. */
	scriptUrl?: string;
	/** Maximum time to wait for `appletOnLoad` after injection. */
	appletTimeoutMs?: number;
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
}

/** GeoGebra app parameters accepted through `CalculatorProviderConfig.settings`. */
export interface GeoGebraCalculatorSettings extends Record<string, unknown> {
	width?: number;
	height?: number;
	borderColor?: string;
	borderRadius?: number;
	enableRightClick?: boolean;
	enableLabelDrags?: boolean;
	enableShiftDragZoom?: boolean;
	showZoomButtons?: boolean;
	errorDialogsActive?: boolean;
	showMenuBar?: boolean;
	showToolBar?: boolean;
	showToolBarHelp?: boolean;
	showAlgebraInput?: boolean;
	showResetIcon?: boolean;
	language?: string;
	country?: string;
	allowStyleBar?: boolean;
	enableFileFeatures?: boolean;
	enableUndoRedo?: boolean;
	enableCAS?: boolean;
	enable3d?: boolean;
	preventFocus?: boolean;
}

export class GeoGebraCalculatorProvider implements CalculatorProvider {
	readonly providerId = "geogebra";
	readonly providerName = "GeoGebra";
	readonly supportedTypes: CalculatorType[] = [
		"basic",
		"scientific",
		"graphing",
	];
	readonly version = "6";

	private initialized = false;
	private appletTimeoutMs = DEFAULT_APPLET_TIMEOUT_MS;
	private onTelemetry: GeoGebraCalculatorProviderConfig["onTelemetry"];

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.onTelemetry?.(eventName, payload);
		} catch (error) {
			console.warn("[GeoGebraProvider] telemetry callback failed:", error);
		}
	}

	private async loadGeoGebraScript(scriptUrl: string): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			const script = document.createElement("script");
			script.src = scriptUrl;
			script.async = true;
			script.dataset.pieCalculatorProvider = "geogebra";
			script.onload = () => {
				if (window.GGBApplet) resolve();
				else {
					reject(
						new Error(
							"GeoGebra deploy script loaded but window.GGBApplet is undefined",
						),
					);
				}
			};
			script.onerror = () => {
				reject(new Error(`Failed to load GeoGebra from ${scriptUrl}`));
			};
			document.head.appendChild(script);
		});
	}

	async initialize(
		config: GeoGebraCalculatorProviderConfig = {},
	): Promise<void> {
		if (this.initialized) return;
		if (typeof window === "undefined") {
			throw new Error(
				"GeoGebra calculators can only be initialized in the browser",
			);
		}

		this.onTelemetry = config.onTelemetry;
		this.appletTimeoutMs =
			typeof config.appletTimeoutMs === "number" && config.appletTimeoutMs > 0
				? config.appletTimeoutMs
				: DEFAULT_APPLET_TIMEOUT_MS;

		if (!window.GGBApplet) {
			const scriptUrl = config.scriptUrl?.trim() || DEFAULT_SCRIPT_URL;
			const startedAt = Date.now();
			await this.emitTelemetry("pie-tool-library-load-start", {
				toolId: "calculator",
				backend: "geogebra",
				operation: "geogebra-script-load",
			});
			try {
				await this.loadGeoGebraScript(scriptUrl);
				await this.emitTelemetry("pie-tool-library-load-success", {
					toolId: "calculator",
					backend: "geogebra",
					operation: "geogebra-script-load",
					duration: Date.now() - startedAt,
				});
			} catch (error) {
				await this.emitTelemetry("pie-tool-library-load-error", {
					toolId: "calculator",
					backend: "geogebra",
					operation: "geogebra-script-load",
					duration: Date.now() - startedAt,
					errorType: "ToolLibraryLoadError",
					message: error instanceof Error ? error.message : String(error),
				});
				throw error;
			}
		}

		this.initialized = true;
	}

	async createCalculator(
		type: CalculatorType,
		container: HTMLElement,
		config?: CalculatorProviderConfig,
	): Promise<Calculator> {
		if (!this.initialized) await this.initialize();
		if (!this.supportsType(type)) {
			throw new Error(`GeoGebra does not support calculator type: ${type}`);
		}
		return GeoGebraCalculator.create(
			this,
			type,
			container,
			config,
			this.appletTimeoutMs,
		);
	}

	supportsType(type: CalculatorType): boolean {
		return this.supportedTypes.includes(type);
	}

	destroy(): void {
		this.initialized = false;
		this.appletTimeoutMs = DEFAULT_APPLET_TIMEOUT_MS;
		this.onTelemetry = undefined;
	}

	getCapabilities(): CalculatorProviderCapabilities {
		return {
			supportsHistory: false,
			supportsGraphing: true,
			supportsExpressions: true,
			canExport: true,
			inputMethods: ["keyboard", "mouse", "touch"],
		};
	}
}

class GeoGebraCalculator implements Calculator {
	readonly provider: CalculatorProvider;
	readonly type: CalculatorType;

	private api: GeoGebraAppletApi | null = null;
	private applet: GeoGebraAppletEmbed | null = null;
	private generatedContainerId: string | null = null;

	private constructor(
		provider: CalculatorProvider,
		type: CalculatorType,
		private readonly container: HTMLElement,
	) {
		this.provider = provider;
		this.type = type;
	}

	static async create(
		provider: CalculatorProvider,
		type: CalculatorType,
		container: HTMLElement,
		config: CalculatorProviderConfig | undefined,
		timeoutMs: number,
	): Promise<GeoGebraCalculator> {
		const Constructor = window.GGBApplet;
		if (!Constructor) throw new Error("GeoGebra API not available");

		const calculator = new GeoGebraCalculator(provider, type, container);
		const settings = {
			...(config?.settings || {}),
		} as GeoGebraCalculatorSettings;
		delete settings.appName;
		delete settings.id;
		delete settings.appletOnLoad;

		const width =
			typeof settings.width === "number"
				? settings.width
				: Math.max(container.clientWidth || 0, 320);
		const height =
			typeof settings.height === "number"
				? settings.height
				: Math.max(container.clientHeight || 0, 320);
		delete settings.width;
		delete settings.height;

		const isRestricted = config?.restrictedMode === true;
		const appName = type === "graphing" ? "graphing" : "scientific";
		const appletId = `pie-geogebra-${Date.now()}-${++nextAppletId}`;
		if (!container.id) {
			calculator.generatedContainerId = `${appletId}-container`;
			container.id = calculator.generatedContainerId;
		}
		const clearGeneratedContainerId = () => {
			if (
				calculator.generatedContainerId &&
				container.id === calculator.generatedContainerId
			) {
				container.id = "";
			}
			calculator.generatedContainerId = null;
		};

		await new Promise<void>((resolve, reject) => {
			let settled = false;
			const timer = setTimeout(() => {
				settled = true;
				container.replaceChildren();
				clearGeneratedContainerId();
				reject(
					new Error(`GeoGebra applet did not initialize within ${timeoutMs}ms`),
				);
			}, timeoutMs);

			const parameters: GeoGebraAppletParameters = {
				showMenuBar: false,
				showToolBar: false,
				// GeoGebra's scientific embed otherwise renders an empty algebra view:
				// the input row is the calculator's primary interaction surface.
				showAlgebraInput: true,
				showZoomButtons: appName === "graphing",
				...settings,
				enable3d: false,
				preventFocus: true,
				...(isRestricted
					? {
							showMenuBar: false,
							showToolBar: false,
							enableFileFeatures: false,
							enableCAS: false,
							enableRightClick: false,
						}
					: {}),
				appName,
				width,
				height,
				id: appletId,
				appletOnLoad: (api) => {
					clearTimeout(timer);
					if (settled) {
						api.remove?.();
						return;
					}
					settled = true;
					calculator.api = api;
					resolve();
				},
			};

			try {
				container.replaceChildren();
				calculator.applet = new Constructor(parameters, true);
				calculator.applet.inject(container.id);
			} catch (error) {
				clearTimeout(timer);
				settled = true;
				container.replaceChildren();
				clearGeneratedContainerId();
				reject(error);
			}
		});

		return calculator;
	}

	getValue(): string {
		const editorState = this.api?.getEditorState?.();
		return editorState === undefined ? "" : JSON.stringify(editorState);
	}

	setValue(value: string): void {
		if (!value || !this.api?.setEditorState) return;
		try {
			this.api.setEditorState(JSON.parse(value));
		} catch (error) {
			console.warn(
				"[GeoGebraCalculator] Failed to restore editor state:",
				error,
			);
		}
	}

	clear(): void {
		this.api?.newConstruction?.();
	}

	async evaluate(expression: string): Promise<string> {
		const casResult = this.api?.evalCommandCAS?.(expression);
		if (typeof casResult === "string" && casResult.length > 0) return casResult;
		const labels = this.api?.evalCommandGetLabels?.(expression);
		if (typeof labels === "string" && labels.length > 0) return labels;
		return this.api?.evalCommand?.(expression) ? expression : "";
	}

	resize(): void {
		if (!this.api) return;
		const width = Math.max(this.container.clientWidth || 0, 1);
		const height = Math.max(this.container.clientHeight || 0, 1);
		this.api.setSize?.(width, height);
		this.api.recalculateEnvironments?.();
	}

	focus(): void {
		const target = this.container.querySelector<HTMLElement>(
			'input, textarea, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
		);
		target?.focus();
	}

	exportState(): CalculatorState {
		return {
			type: this.type,
			provider: "geogebra",
			value: this.getValue(),
			providerState: this.api?.getBase64?.() || "",
		};
	}

	importState(state: CalculatorState): void {
		if (state.provider !== "geogebra") {
			throw new Error(`Cannot import state from provider: ${state.provider}`);
		}
		if (typeof state.providerState === "string" && state.providerState) {
			this.api?.setBase64?.(state.providerState);
		} else if (state.value) {
			this.setValue(state.value);
		}
	}

	destroy(): void {
		this.api?.remove?.();
		this.api = null;
		this.applet = null;
		this.container.replaceChildren();
		if (
			this.generatedContainerId &&
			this.container.id === this.generatedContainerId
		) {
			this.container.id = "";
		}
		this.generatedContainerId = null;
	}
}
