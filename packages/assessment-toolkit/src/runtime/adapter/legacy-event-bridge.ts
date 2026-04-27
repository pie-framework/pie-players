/**
 * Legacy DOM event bridge for the section runtime engine adapter (M7
 * — Variant C, layered).
 *
 * Translates the deprecated readiness output shapes (`readiness-change`,
 * `interaction-ready`, `ready`) into DOM `CustomEvent` dispatches on the
 * host element. Mirrors the kernel's existing
 * `dispatch("readiness-change", detail)` /
 * `dispatch("interaction-ready", detail)` /
 * `dispatch("ready", detail)` chain bit-for-bit.
 *
 * **Lifetime / removal posture.** Per `.cursor/rules/legacy-compatibility-boundaries.mdc`
 * and the M7 implementation plan ("rip-out posture"), this bridge keeps
 * the legacy events firing for one major across the migration window so
 * downstream consumers can migrate to `pie-stage-change`. The plan's
 * PR 4 pre-flight audit determines the rip-out window per-consumer; this
 * bridge stays additive until then.
 *
 * **Detail-shape contract.** The engine outputs already carry the
 * `EngineReadinessDetail` (a structural superset of the legacy
 * `SectionPlayerReadinessChangeDetail` from
 * `packages/section-player/src/contracts/public-events.ts`). The bridge
 * forwards the detail untouched so consumers see the same payload shape
 * the kernel emitted before M7.
 *
 * The bridge **must not** import `svelte` per the M7 layering
 * constraint.
 */

import type { EngineReadinessDetail } from "../core/engine-readiness.js";
import type { SectionEngineOutput } from "../core/engine-output.js";

export interface LegacyEventBridgeOptions {
	host: EventTarget;
}

export interface LegacyEventBridgeHandle {
	dispatch(output: SectionEngineOutput): void;
	setHost(host: EventTarget): void;
}

export function createLegacyEventBridge(
	options: LegacyEventBridgeOptions,
): LegacyEventBridgeHandle {
	let host: EventTarget = options.host;

	function dispatchDetail(name: string, detail: EngineReadinessDetail): void {
		host.dispatchEvent(
			new CustomEvent<EngineReadinessDetail>(name, { detail }),
		);
	}

	function dispatch(output: SectionEngineOutput): void {
		switch (output.kind) {
			case "readiness-change":
				dispatchDetail("readiness-change", output.detail);
				return;
			case "interaction-ready":
				dispatchDetail("interaction-ready", output.detail);
				return;
			case "ready":
				dispatchDetail("ready", output.detail);
				return;
			case "stage-change":
			case "loading-complete":
			case "framework-error":
				// Owned by the dom-event-bridge / framework-error-bridge.
				return;
			default: {
				const exhaustive: never = output;
				void exhaustive;
				return;
			}
		}
	}

	function setHost(next: EventTarget): void {
		host = next;
	}

	return { dispatch, setHost };
}
