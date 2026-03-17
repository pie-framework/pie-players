export type PlayerElementParams = {
	config: Record<string, unknown>;
	env: Record<string, unknown>;
	session?: Record<string, unknown>;
	attributes?: Record<string, string>;
	props?: Record<string, unknown>;
};

type AppliedPlayerParams = {
	config?: Record<string, unknown>;
	configSignature?: string;
	env?: Record<string, unknown>;
	envSignature?: string;
	session?: Record<string, unknown>;
	sessionSignature?: string;
	attributeKeys?: string[];
	propKeys?: string[];
};

type PlayerActionOptions = {
	stateKey: string;
	includeSessionRefInState?: boolean;
};

const playerActionStateCache = new WeakMap<
	HTMLElement,
	Map<string, AppliedPlayerParams>
>();

function getSessionSignature(
	session: Record<string, unknown> | undefined,
): string {
	if (!session) return "";
	try {
		return JSON.stringify(session);
	} catch {
		return String((session as { id?: unknown })?.id || "");
	}
}

function getObjectSignature(value: unknown): string {
	if (value === null || value === undefined) return "";
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

export function createPlayerAction(options: PlayerActionOptions) {
	return (node: HTMLElement, params: PlayerElementParams) => {
		applyPlayerParams(node, params, options);
		return {
			update(nextParams: PlayerElementParams) {
				applyPlayerParams(node, nextParams, options);
			},
			destroy() {
				clearNodeState(node, options.stateKey);
			},
		};
	};
}

function applyPlayerParams(
	node: HTMLElement,
	params: PlayerElementParams,
	options: PlayerActionOptions,
) {
	const nodeRecord = node as unknown as Record<string, unknown>;
	const state = getNodeState(node, options.stateKey);
	const nextAttributeKeys = Object.keys(params.attributes || {});
	const nextPropKeys = Object.keys(params.props || {});
	const previousAttributeKeys = state.attributeKeys || [];
	const previousPropKeys = state.propKeys || [];
	for (const name of previousAttributeKeys) {
		if (!nextAttributeKeys.includes(name)) {
			node.removeAttribute(name);
		}
	}
	for (const name of previousPropKeys) {
		if (!nextPropKeys.includes(name)) {
			delete nodeRecord[name];
		}
	}
	const nextConfigSignature = getObjectSignature(params.config);
	if (state.configSignature !== nextConfigSignature) {
		nodeRecord.config = params.config;
	}
	const nextEnvSignature = getObjectSignature(params.env);
	if (state.envSignature !== nextEnvSignature) {
		nodeRecord.env = params.env;
	}
	const nextSessionSignature = getSessionSignature(params.session);
	if (
		params.session !== undefined &&
		state.sessionSignature !== nextSessionSignature
	) {
		nodeRecord.session = params.session;
	}
	for (const [name, value] of Object.entries(params.attributes || {})) {
		node.setAttribute(name, String(value));
	}
	for (const [name, value] of Object.entries(params.props || {})) {
		nodeRecord[name] = value;
	}
	setNodeState(node, options.stateKey, {
		config: params.config,
		configSignature: nextConfigSignature,
		env: params.env,
		envSignature: nextEnvSignature,
		session: options.includeSessionRefInState ? params.session : undefined,
		sessionSignature: nextSessionSignature,
		attributeKeys: nextAttributeKeys,
		propKeys: nextPropKeys,
	} as AppliedPlayerParams);
}

function getNodeState(node: HTMLElement, stateKey: string): AppliedPlayerParams {
	return playerActionStateCache.get(node)?.get(stateKey) || {};
}

function setNodeState(
	node: HTMLElement,
	stateKey: string,
	state: AppliedPlayerParams,
): void {
	const byKey = playerActionStateCache.get(node) || new Map<string, AppliedPlayerParams>();
	byKey.set(stateKey, state);
	playerActionStateCache.set(node, byKey);
}

function clearNodeState(node: HTMLElement, stateKey: string): void {
	const byKey = playerActionStateCache.get(node);
	if (!byKey) return;
	byKey.delete(stateKey);
	if (byKey.size === 0) {
		playerActionStateCache.delete(node);
	}
}
