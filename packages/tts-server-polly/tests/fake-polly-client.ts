import type { PollyClient } from "@aws-sdk/client-polly";

import { PollyServerProvider } from "../src/PollyServerProvider.js";

/** A provider whose requests go to `client`, so none leaves the test. */
export const pollyWithClient = (client: unknown): PollyServerProvider =>
	new (class extends PollyServerProvider {
		protected override createClient(): PollyClient {
			return client as PollyClient;
		}
	})();
