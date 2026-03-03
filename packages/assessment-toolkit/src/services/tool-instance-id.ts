export const DEFAULT_TOOL_SCOPE_LEVELS = [
	"assessment",
	"section",
	"item",
	"passage",
	"rubric",
] as const;

export type BuiltinToolScopeLevel = (typeof DEFAULT_TOOL_SCOPE_LEVELS)[number];
export type ToolScopeLevel = BuiltinToolScopeLevel | (string & {});

export interface ParsedToolInstanceId {
	baseToolId: string;
	scopeLevel: ToolScopeLevel;
	scopeId: string;
}

const registeredToolScopeLevels = new Set<string>(DEFAULT_TOOL_SCOPE_LEVELS);

export function getRegisteredToolScopeLevels(): string[] {
	return Array.from(registeredToolScopeLevels.values());
}

export function registerToolScopeLevel(scopeLevel: string): void {
	const normalized = scopeLevel.trim();
	if (!normalized) {
		throw new Error("Tool scope level must be a non-empty string");
	}
	registeredToolScopeLevels.add(normalized);
}

export function isRegisteredToolScopeLevel(
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
			`Unknown tool scope level '${scopeLevel}'. Register custom levels with registerToolScopeLevel().`,
		);
	}
	return `${normalizedBase}:${scopeLevel}:${normalizedScopeId}`;
}

export function parseScopedToolId(id: string): ParsedToolInstanceId | null {
	const parts = id.split(":");
	if (parts.length !== 3 && parts.length !== 4) return null;
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

export function toOverlayToolId(id: string): string {
	const parsed = parseScopedToolId(id);
	if (!parsed) return id;
	return createScopedToolId(parsed.baseToolId, parsed.scopeLevel, parsed.scopeId);
}
