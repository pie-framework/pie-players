export const DEFAULT_TOOL_SCOPE_LEVELS = [
	"assessment",
	"section",
	"item",
	"passage",
	"rubric",
] as const;

export type BuiltinToolScopeLevel = (typeof DEFAULT_TOOL_SCOPE_LEVELS)[number];
export type ToolScopeLevel = BuiltinToolScopeLevel | (string & {});
export type ToolInstanceRole = "overlay" | "inline";

export interface ParsedToolInstanceId {
	baseToolId: string;
	scopeLevel: ToolScopeLevel;
	scopeId: string;
	role: ToolInstanceRole;
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
	role: ToolInstanceRole = "overlay",
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
	return role === "inline"
		? `${normalizedBase}:${scopeLevel}:${normalizedScopeId}:inline`
		: `${normalizedBase}:${scopeLevel}:${normalizedScopeId}`;
}

export function parseScopedToolId(id: string): ParsedToolInstanceId | null {
	const parts = id.split(":");
	if (parts.length !== 3 && parts.length !== 4) return null;
	const [baseToolId, scopeLevelRaw, scopeId, roleRaw] = parts;
	if (!baseToolId || !scopeId) return null;
	if (!isRegisteredToolScopeLevel(scopeLevelRaw)) {
		return null;
	}
	const role: ToolInstanceRole = roleRaw === "inline" ? "inline" : "overlay";
	if (parts.length === 4 && roleRaw !== "inline") return null;
	return {
		baseToolId,
		scopeLevel: scopeLevelRaw,
		scopeId,
		role,
	};
}

export function toOverlayToolId(id: string): string {
	const parsed = parseScopedToolId(id);
	if (!parsed) return id;
	return createScopedToolId(
		parsed.baseToolId,
		parsed.scopeLevel,
		parsed.scopeId,
		"overlay",
	);
}
