/**
 * Hostname classification for a URL a server fetches on someone else's behalf,
 * such as an SSML `<audio src>` a TTS provider will request or an asset URL an
 * upstream service returns. Every such check reads this module, so no two
 * copies of it can drift apart.
 *
 * IP literals are classified by `ipaddr.js`, whose ranges follow the IANA IPv4
 * and IPv6 Special-Purpose Address Registries (RFC 6890). A host is private
 * unless it is a public unicast address or a name: loopback, private, link-local,
 * unique-local, carrier-grade NAT, multicast, broadcast, documentation and
 * reserved ranges, and the IPv6 forms that embed an IPv4 address (NAT64, 6to4,
 * Teredo), all count. `ipaddr.js` also reads the numeric IPv4 forms (`2130706433`,
 * `0x7f000001`, `0177.0.0.1`) and unmaps IPv4-mapped IPv6.
 *
 * Only the literal is checked. A public name that resolves to a private address
 * passes; guarding that takes a check of the resolved address at connect time.
 *
 * @module
 */

import ipaddr from "ipaddr.js";

/**
 * Cloud instance-metadata hostnames. They hand out credentials. No registry
 * lists them; each is the provider's documented name.
 */
const CLOUD_METADATA_HOSTNAMES: ReadonlySet<string> = new Set([
	"metadata.google.internal",
	"metadata.azure.internal",
	"metadata.packet.net",
	"metadata.oci.oraclecloud.com",
]);

/** Cloud instance-metadata addresses: the link-local one most clouds use, and AWS's IPv6 one. */
const CLOUD_METADATA_ADDRESSES = ["169.254.169.254", "fd00:ec2::254"].map(
	(address) => ipaddr.parse(address),
);

type IpAddress = ReturnType<typeof ipaddr.parse>;

/** Lower-cased, without brackets or a trailing dot. */
function normalizeHostname(hostname: string): string {
	return hostname
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "")
		.toLowerCase();
}

/**
 * The address `host` is a literal for, IPv4-mapped (`::ffff:a.b.c.d`) and
 * IPv4-compatible (`::a.b.c.d`) IPv6 reduced to IPv4, or `null` for a name.
 */
function parseAddress(host: string): IpAddress | null {
	if (!ipaddr.isValid(host)) return null;
	const address = ipaddr.process(host);
	if (address.kind() !== "ipv6") return address;
	// `ipaddr.js` classifies deprecated IPv4-compatible addresses as unicast;
	// read the IPv4 address in their low 32 bits instead.
	const { parts } = address as ipaddr.IPv6;
	const isIpv4Compatible =
		parts.slice(0, 6).every((part) => part === 0) &&
		(parts[6] !== 0 || parts[7] > 1);
	return isIpv4Compatible
		? new ipaddr.IPv4([
				parts[6] >> 8,
				parts[6] & 0xff,
				parts[7] >> 8,
				parts[7] & 0xff,
			])
		: address;
}

/** Whether `hostname` is a cloud instance-metadata endpoint. */
export function isCloudMetadataHostname(hostname: string): boolean {
	const host = normalizeHostname(hostname);
	if (CLOUD_METADATA_HOSTNAMES.has(host)) return true;
	const address = parseAddress(host);
	return (
		address !== null &&
		CLOUD_METADATA_ADDRESSES.some(
			(metadata) =>
				metadata.kind() === address.kind() &&
				metadata.toNormalizedString() === address.toNormalizedString(),
		)
	);
}

/**
 * Whether `hostname` is anything other than a public unicast address or a
 * public name: `localhost` and its subdomains (RFC 6761), or an IP literal in
 * any special-purpose range.
 */
export function isPrivateHostname(hostname: string): boolean {
	const host = normalizeHostname(hostname);
	if (host === "localhost" || host.endsWith(".localhost")) return true;
	const address = parseAddress(host);
	return address !== null && address.range() !== "unicast";
}
