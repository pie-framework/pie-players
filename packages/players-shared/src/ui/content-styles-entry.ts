// The `./ui/content-styles` entry: the module's exports less its test-only reset.
export {
	adoptContentStylesInto,
	auditContentStyles,
	type ContentStylesAdoption,
	type ContentStylesResult,
	contentStylesOptedOut,
	contentStylesPresent,
	installContentStyles,
} from "./content-styles.js";
