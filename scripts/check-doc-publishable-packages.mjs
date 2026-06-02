#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CHANGESET_CONFIG_PATH = path.join(ROOT, ".changeset", "config.json");
const INVENTORY_PATH = path.join(
	ROOT,
	"docs",
	"setup",
	"publishable_packages.md",
);

const changesetConfig = JSON.parse(readFileSync(CHANGESET_CONFIG_PATH, "utf8"));
const fixedPackages = changesetConfig.fixed?.[0] ?? [];
const inventoryText = readFileSync(INVENTORY_PATH, "utf8");
const inventoryPackages = [
	...inventoryText.matchAll(/^- `(@pie-players\/[^`]+)`$/gm),
].map((match) => match[1]);

const missing = fixedPackages.filter((pkg) => !inventoryPackages.includes(pkg));
const extra = inventoryPackages.filter((pkg) => !fixedPackages.includes(pkg));
const orderMismatch =
	missing.length === 0 &&
	extra.length === 0 &&
	fixedPackages.some((pkg, index) => inventoryPackages[index] !== pkg);

if (missing.length > 0 || extra.length > 0 || orderMismatch) {
	console.error(
		"Publishable packages inventory is out of sync with .changeset/config.json.",
	);
	if (missing.length > 0) {
		console.error(
			`Missing from docs/setup/publishable_packages.md: ${missing.join(", ")}`,
		);
	}
	if (extra.length > 0) {
		console.error(
			`Extra in docs/setup/publishable_packages.md: ${extra.join(", ")}`,
		);
	}
	if (orderMismatch) {
		console.error("Package order differs from the Changesets fixed block.");
	}
	process.exit(1);
}

console.log("Publishable packages inventory check passed.");
