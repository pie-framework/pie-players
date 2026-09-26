import { expect, test } from "bun:test";
import packageJson from "../../../package.json";
import {
	MC_POPULATED_BLANK_PACKAGE,
	MC_POPULATED_BLANK_VERSION,
} from "./demo-preloaded-bundled-elements";

test("the bundled demo registers the version section-demos installs", () => {
	expect(packageJson.dependencies[MC_POPULATED_BLANK_PACKAGE]).toBe(
		MC_POPULATED_BLANK_VERSION,
	);
});
