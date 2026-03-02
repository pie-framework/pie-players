import { createServer } from "node:net";

function reservePort(port, host = "127.0.0.1") {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.unref();
		server.once("error", reject);
		server.listen({ host, port }, () => {
			const address = server.address();
			const resolvedPort =
				typeof address === "object" && address?.port ? address.port : port;
			server.close((closeErr) => {
				if (closeErr) reject(closeErr);
				else resolve(resolvedPort);
			});
		});
	});
}

const preferredArg = process.argv[2];
const preferredPort =
	typeof preferredArg === "string" && preferredArg.trim().length > 0
		? Number(preferredArg)
		: 0;

if (!Number.isFinite(preferredPort) || preferredPort < 0 || preferredPort > 65535) {
	console.error("Invalid preferred port. Provide a number between 0 and 65535.");
	process.exit(1);
}

try {
	const port =
		preferredPort > 0
			? await reservePort(preferredPort).catch(() => reservePort(0))
			: await reservePort(0);
	process.stdout.write(String(port));
} catch (error) {
	console.error("Unable to resolve a free port.", error);
	process.exit(1);
}
