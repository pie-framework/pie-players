import type { MessageCatalog as SharedMessageCatalog } from "@pie-players/pie-players-shared/i18n/types";
import { expect, test } from "bun:test";

import type { MessageCatalog } from "../src/message-catalog.js";

// Compile-time: each catalog type is assignable to the other, so a loader typed
// with one satisfies the provider's `loadCatalog`, which is typed with the
// other. `typecheck` fails if either drifts.
const loadsForTheProvider = (
	loader: (locale: string) => Promise<MessageCatalog>,
): ((locale: string) => Promise<SharedMessageCatalog>) => loader;
const readsWhatTheProviderLoads = (catalog: SharedMessageCatalog): MessageCatalog =>
	catalog;

test("the generated catalog shape and players-shared's accept each other", () => {
	expect(typeof loadsForTheProvider).toBe("function");
	expect(typeof readsWhatTheProviderLoads).toBe("function");
});
