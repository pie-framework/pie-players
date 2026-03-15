import type { RequestHandler } from "./$types";
import { getSessionDemoState, subscribeSessionDemoState } from "../../db";

const encoder = new TextEncoder();
const HEARTBEAT_INTERVAL_MS = 15000;

function toSseMessage(eventName: string, payload: unknown): string {
	return `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const GET: RequestHandler = ({ request }) => {
	let closeStream: (() => void) | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let closed = false;
			let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
			let unsubscribe: (() => void) | null = null;

			const safeEnqueue = (chunk: Uint8Array): boolean => {
				if (closed) return false;
				try {
					controller.enqueue(chunk);
					return true;
				} catch {
					close();
					return false;
				}
			};

			const close = () => {
				if (closed) return;
				closed = true;
				if (heartbeatTimer) clearInterval(heartbeatTimer);
				if (unsubscribe) unsubscribe();
				try {
					controller.close();
				} catch {
					// Ignore close errors during disconnect races.
				}
			};
			closeStream = close;

			const sendStateEvent = () => {
				if (closed) return;
				const payload = { ok: true, state: getSessionDemoState() };
				safeEnqueue(encoder.encode(toSseMessage("state", payload)));
			};

			sendStateEvent();
			unsubscribe = subscribeSessionDemoState(() => {
				try {
					sendStateEvent();
				} catch {
					close();
				}
			});
			heartbeatTimer = setInterval(() => {
				if (closed) return;
				safeEnqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
			}, HEARTBEAT_INTERVAL_MS);

			request.signal.addEventListener("abort", close, { once: true });
		},
		cancel() {
			closeStream?.();
		},
	});

	return new Response(stream, {
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
		},
	});
};
