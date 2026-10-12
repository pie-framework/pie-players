const TOOL_SCOPE_LEVELS = [
	"assessment",
	"section",
	"item",
	"passage",
	"rubric",
] as const;

export type ToolScopeLevel = (typeof TOOL_SCOPE_LEVELS)[number];

export interface ParsedToolInstanceId {
	baseToolId: string;
	scopeLevel: ToolScopeLevel;
	scopeId: string;
}

const toolScopeLevels: ReadonlySet<string> = new Set(TOOL_SCOPE_LEVELS);

function isToolScopeLevel(scopeLevel: string): scopeLevel is ToolScopeLevel {
	return toolScopeLevels.has(scopeLevel);
}

/**
 * A tool instance id, `<baseToolId>:<scopeLevel>:<scopeId>`, from trimmed parts.
 * Throws on an empty part or an unknown scope level.
 */
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
	if (!isToolScopeLevel(scopeLevel)) {
		throw new Error(
			`Unknown tool scope level '${scopeLevel}'.`,
		);
	}
	return `${normalizedBase}:${scopeLevel}:${normalizedScopeId}`;
}

/** The parts of a tool instance id, or `null` when `id` is not one. */
export function parseScopedToolId(id: string): ParsedToolInstanceId | null {
	const parts = id.split(":");
	if (parts.length !== 3) return null;
	const [baseToolId, scopeLevelRaw, scopeId] = parts;
	if (!baseToolId || !scopeId) return null;
	if (!isToolScopeLevel(scopeLevelRaw)) return null;
	return {
		baseToolId,
		scopeLevel: scopeLevelRaw,
		scopeId,
	};
}
