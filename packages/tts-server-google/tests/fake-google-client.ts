import type { v1beta1 } from "@google-cloud/text-to-speech";

import { GoogleCloudTTSProvider } from "../src/GoogleCloudTTSProvider.js";

/** A provider whose requests go to `client`, so none leaves the test. */
export const googleWithClient = (client: unknown): GoogleCloudTTSProvider =>
	new (class extends GoogleCloudTTSProvider {
		protected override createClient(): v1beta1.TextToSpeechClient {
			return client as v1beta1.TextToSpeechClient;
		}
	})();
