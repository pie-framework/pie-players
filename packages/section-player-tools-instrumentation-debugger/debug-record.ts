/**
 * The record the panel lists, as `@pie-players/pie-players-shared` defines
 * `InstrumentationDebugRecord`.
 *
 * Restated here because the panel's published declarations name it, and a
 * declaration that imported players-shared would make hosts install it for one
 * type. The built panel bundles players-shared and reads records off the
 * `pie-instrumentation-debug-record` window event, so only the shape crosses the
 * boundary. `tests/debug-record-contract.test.ts` fails the typecheck when the
 * two stop accepting each other.
 */
export type InstrumentationDebugRecord = {
	id: number;
	kind: "event" | "error" | "metric" | "user-context" | "global-attributes";
	providerId: string;
	providerName: string;
	timestamp: string;
	name: string;
	attributes?: Record<string, unknown>;
	errorMessage?: string;
	errorStack?: string;
	value?: number;
};
