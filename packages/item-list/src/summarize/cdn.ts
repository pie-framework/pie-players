// The loader helpers `pinnedSummaries` uses, as one module it imports lazily, so its chunk holds
// these and their dependencies rather than the whole loaders entry.
export {
	assertElementPackagesAllowed,
	DEFAULT_ESM_ELEMENT_PACKAGE_POLICY,
	isScopedPackageSpec,
	resolveEsmPackageFileUrl,
} from "@pie-players/pie-players-shared/loaders";
