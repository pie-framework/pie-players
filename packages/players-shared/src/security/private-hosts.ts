/**
 * Hostname classification for a URL a server fetches on someone else's behalf,
 * such as an SSML `<audio src>` a TTS provider will request or an asset URL an
 * upstream service returns. Every such check reads these two lists, so no two
 * copies of them can drift apart.
 *
 * Pass `URL.hostname`. The WHATWG URL parser has already rewritten numeric IPv4
 * (`2130706433`, `0x7f000001`) to dotted form and compressed IPv6; the
 * normalisation here keeps the answer right for a hostname that did not come
 * from it.
 *
 * @module
 */

/** Cloud instance-metadata endpoints. They hand out credentials. */
const CLOUD_METADATA_HOSTNAMES: readonly RegExp[] = [
	/^169\.254\.169\.254$/,
	/^fd00:ec2::254$/,
	/^metadata\.google\.internal$/,
	/^metadata\.azure\.internal$/,
	/^metadata\.packet\.net$/,
	/^metadata\.oci\.oraclecloud\.com$/,
];

/** Loopback, unspecified, private-network, link-local and unique-local hosts. */
const PRIVATE_HOSTNAMES: readonly RegExp[] = [
	/^localhost$/,
	/^127(?:\.\d{1,3}){3}$/,
	/^0(?:\.\d{1,3}){3}$/,
	/^10(?:\.\d{1,3}){3}$/,
	/^192\.168(?:\.\d{1,3}){2}$/,
	/^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/,
	/^169\.254(?:\.\d{1,3}){2}$/,
	// The unspecified address reaches the local host, as `0.0.0.0` does.
	/^::$/,
	/^0:0:0:0:0:0:0:0$/,
	/^::1$/,
	/^0:0:0:0:0:0:0:1$/,
	/^fe80:/,
	/^fc00:/,
	/^fd[0-9a-f]{2}:/,
];

/**
 * A host written as one bare decimal, hex or octal number (`2130706433`,
 * `0x7f000001`, `017700000001` for `127.0.0.1`) in dotted form, or `null`.
 * Numeric hosts are a classic way past a host list.
 */
function ipv4BareToDotted(hostname: string): string | null {
	let asInt: number;
	if (/^0x[0-9a-f]+$/.test(hostname)) {
		asInt = Number.parseInt(hostname.slice(2), 16);
	} else if (/^0[0-7]+$/.test(hostname)) {
		asInt = Number.parseInt(hostname, 8);
	} else if (/^\d+$/.test(hostname)) {
		asInt = Number.parseInt(hostname, 10);
	} else {
		return null;
	}
	if (!Number.isFinite(asInt) || asInt > 0xff_ff_ff_ff) return null;
	return [
		(asInt >>> 24) & 0xff,
		(asInt >>> 16) & 0xff,
		(asInt >>> 8) & 0xff,
		asInt & 0xff,
	].join(".");
}

/** Lower-cased, without brackets or a trailing dot, IPv4-mapped IPv6 unmapped. */
function normalizeHostname(hostname: string): string {
	const host = hostname
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "")
		.toLowerCase();
	// The URL parser serialises `::ffff:127.0.0.1` as `::ffff:7f00:1`, which no
	// IPv4 pattern would otherwise match.
	const mapped =
		/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(
			host,
		);
	if (!mapped) return host;
	const [, dotted, high, low] = mapped;
	if (dotted) return dotted;
	return [Number.parseInt(high, 16), Number.parseInt(low, 16)]
		.flatMap((word) => [(word >>> 8) & 0xff, word & 0xff])
		.join(".");
}

function matchesAny(hostname: string, patterns: readonly RegExp[]): boolean {
	const normalized = normalizeHostname(hostname);
	const dotted = ipv4BareToDotted(normalized);
	return patterns.some(
		(pattern) =>
			pattern.test(normalized) || (dotted !== null && pattern.test(dotted)),
	);
}

/** Whether `hostname` is a cloud instance-metadata endpoint. */
export function isCloudMetadataHostname(hostname: string): boolean {
	return matchesAny(hostname, CLOUD_METADATA_HOSTNAMES);
}

/**
 * Whether `hostname` is a loopback, unspecified, private-network, link-local or
 * unique-local host.
 */
export function isPrivateHostname(hostname: string): boolean {
	return matchesAny(hostname, PRIVATE_HOSTNAMES);
}
