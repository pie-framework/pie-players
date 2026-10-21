// The loader helpers `pinnedSummaries` uses, as one module it imports lazily, so its chunk holds
// these and their dependencies rather than the whole loaders entry.
export {
	assertElementPackagesAllowed,
	isScopedPackageSpec,
	resolveEsmPackageFileUrl,
} from "@pie-players/pie-players-shared/loaders";
