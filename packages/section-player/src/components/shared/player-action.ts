export type PlayerElementParams = {
	config: Record<string, unknown>;
	env: Record<string, unknown>;
	session?: Record<string, unknown>;
	attributes?: Record<string, string>;
	props?: Record<string, unknown>;
	skipElementLoading?: boolean;
};

type AppliedPlayerParams = {
	config?: Record<string, unknown>;
	env?: Record<string, unknown>;
	session?: Record<string, unknown>;
	sessionSignature?: string;
	skipElementLoading?: boolean;
};

type PlayerActionOptions = {
	stateKey: string;
	setSkipElementLoadingOnce?: boolean;
	includeSessionRefInState?: boolean;
};

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

export function createPlayerAction(options: PlayerActionOptions) {
	return (node: HTMLElement, params: PlayerElementParams) => {
		applyPlayerParams(node, params, options);
		return {
			update(nextParams: PlayerElementParams) {
				applyPlayerParams(node, nextParams, options);
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
	const state = (nodeRecord[options.stateKey] || {}) as AppliedPlayerParams;
	if (state.config !== params.config) {
		nodeRecord.config = params.config;
	}
	if (state.env !== params.env) {
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
	if (params.skipElementLoading) {
		const shouldSetSkip =
			options.setSkipElementLoadingOnce !== true ||
			state.skipElementLoading !== true;
		if (shouldSetSkip) {
			node.setAttribute("skip-element-loading", "true");
			nodeRecord.skipElementLoading = true;
		}
	}
	nodeRecord[options.stateKey] = {
		config: params.config,
		env: params.env,
		session: options.includeSessionRefInState ? params.session : undefined,
		sessionSignature: nextSessionSignature,
		skipElementLoading: !!params.skipElementLoading,
	} as AppliedPlayerParams;
}
