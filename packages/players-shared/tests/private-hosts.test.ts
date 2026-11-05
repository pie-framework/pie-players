import { describe, expect, test } from "bun:test";

import {
	isCloudMetadataHostname,
	isPrivateHostname,
} from "../src/security/private-hosts.js";

describe("isCloudMetadataHostname", () => {
	test.each([
		"169.254.169.254",
		"[fd00:ec2::254]",
		"metadata.google.internal",
		"metadata.azure.internal",
		"metadata.packet.net",
		"METADATA.OCI.ORACLECLOUD.COM.",
		"[::ffff:a9fe:a9fe]",
		"2852039166",
		"0xa9fea9fe",
		"025177524776",
	])("recognises %s", (hostname) => {
		expect(isCloudMetadataHostname(hostname)).toBe(true);
	});

	test.each(["169.254.10.10", "metadata.example.com", "8.8.8.8"])(
		"does not flag %s",
		(hostname) => {
			expect(isCloudMetadataHostname(hostname)).toBe(false);
		},
	);
});

describe("isPrivateHostname", () => {
	test.each([
		"localhost",
		"LOCALHOST.",
		"127.0.0.1",
		"0.0.0.0",
		"10.1.2.3",
		"172.16.0.1",
		"192.168.1.1",
		"169.254.10.10",
		"[::]",
		"0:0:0:0:0:0:0:0",
		"[::1]",
		"0:0:0:0:0:0:0:1",
		"[fe80::1]",
		"[fd12:3456::1]",
		"[::ffff:127.0.0.1]",
		"[::ffff:7f00:1]",
		"[::ffff:a01:203]",
		"2130706433",
		"0x7f000001",
		"017700000001",
	])("recognises %s", (hostname) => {
		expect(isPrivateHostname(hostname)).toBe(true);
	});

	test.each([
		"8.8.8.8",
		"172.32.0.1",
		"cdn.example.com",
		"[::ffff:808:808]",
		"[2001:4860:4860::8888]",
		"134744072",
	])("does not flag %s", (hostname) => {
		expect(isPrivateHostname(hostname)).toBe(false);
	});

	test("classifies what the URL parser hands over", () => {
		expect(isPrivateHostname(new URL("http://[0:0:0:0:0:0:0:0]/").hostname)).toBe(
			true,
		);
		expect(isPrivateHostname(new URL("http://0177.0.0.1/").hostname)).toBe(true);
		expect(
			isCloudMetadataHostname(
				new URL("http://[0:0:0:0:0:ffff:a9fe:a9fe]/").hostname,
			),
		).toBe(true);
	});
});
