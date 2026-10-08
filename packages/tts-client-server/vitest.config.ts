import { defineConfig } from "vitest/config";
import { workspaceSourcesVitePlugin } from "../../test-support/workspace-sources.js";

// Workspace siblings resolve to source in unit tests; rationale in
// test-support/workspace-sources.ts.
export default defineConfig({
	plugins: [workspaceSourcesVitePlugin()],
});
