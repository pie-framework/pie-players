import type { ToolkitCoordinatorApi } from "@pie-players/pie-assessment-toolkit";
import { expect, test } from "bun:test";

import type { ToolkitCoordinatorLike } from "../element-props.js";

// Compile-time: the toolkit's coordinator satisfies the structural prop type,
// so a host passes its coordinator unchanged. `typecheck` fails if it drifts.
const accepts = (coordinator: ToolkitCoordinatorApi): ToolkitCoordinatorLike =>
	coordinator;

test("the toolkit coordinator satisfies the panel's coordinator prop", () => {
	expect(typeof accepts).toBe("function");
});
