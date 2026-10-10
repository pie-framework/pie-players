const DEFAULT_TOOL_SCOPE_LEVELS = [
	"assessment",
	"section",
	"item",
	"passage",
	"rubric",
] as const;

export type ToolScopeLevel = (typeof DEFAULT_TOOL_SCOPE_LEVELS)[number];

export interface ParsedToolInstanceId {
	baseToolId: string;
	scopeLevel: ToolScopeLevel;
	scopeId: string;
}

const registeredToolScopeLevels: ReadonlySet<string> = new Set(
	DEFAULT_TOOL_SCOPE_LEVELS,
);

function isRegisteredToolScopeLevel(
	scopeLevel: string,
): scopeLevel is ToolScopeLevel {
	return registeredToolScopeLevels.has(scopeLevel);
}

export function createScopedToolId(
	baseToolId: string,
	scopeLevel: ToolScopeLevel,
	scopeId: string,
): string {
	const normalizedBase = baseToolId.trim();
	const normalizedScopeId = scopeId.trim();
	if (!normalizedBase || !normalizedScopeId) {
		throw new Error("Tool instance ids require non-empty tool and scope ids");
	}
	if (!isRegisteredToolScopeLevel(scopeLevel)) {
		throw new Error(
			`Unknown tool scope level '${scopeLevel}'.`,
		);
	}
	return `${normalizedBase}:${scopeLevel}:${normalizedScopeId}`;
}

export function parseScopedToolId(id: string): ParsedToolInstanceId | null {
	const parts = id.split(":");
	if (parts.length !== 3) return null;
	const [baseToolId, scopeLevelRaw, scopeId] = parts;
	if (!baseToolId || !scopeId) return null;
	if (!isRegisteredToolScopeLevel(scopeLevelRaw)) {
		return null;
	}
	return {
		baseToolId,
		scopeLevel: scopeLevelRaw,
		scopeId,
	};
}
