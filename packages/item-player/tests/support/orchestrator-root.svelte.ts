import {
	type BackendOrchestrator,
	type BackendOrchestratorDeps,
	createBackendOrchestrator,
} from "../../src/backend/orchestrator.svelte.js";

/** The orchestrator owns `$effect`s, so it needs a root outside a component. */
export function mountOrchestrator(deps: BackendOrchestratorDeps): {
	orchestrator: BackendOrchestrator;
	dispose: () => void;
} {
	let orchestrator: BackendOrchestrator | undefined;
	const dispose = $effect.root(() => {
		orchestrator = createBackendOrchestrator(deps);
	});
	return { orchestrator: orchestrator!, dispose };
}
