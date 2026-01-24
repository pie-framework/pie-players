#!/usr/bin/env node
/**
 * Setup Build Infrastructure for All PIE Tool Packages
 *
 * This script:
 * 1. Finds all pie-tool-* packages
 * 2. Adds Vite build configuration to each
 * 3. Updates package.json with build scripts and dual exports
 * 4. Adds necessary devDependencies
 *
 * Usage: node scripts/setup-tool-builds.mjs
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const packagesDir = join(repoRoot, "packages");

// Find all tool packages (excluding calculator which is already done)
const toolPackages = readdirSync(packagesDir)
	.filter((name) => name.startsWith("tool-") && name !== "tool-calculator")
	.map((name) => ({
		name,
		dir: join(packagesDir, name),
		svelteName: `${name}.svelte`,
		className: name
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(""),
	}));

console.log(`Found ${toolPackages.length} tool packages to configure:\n`);
toolPackages.forEach((pkg) => console.log(`  - ${pkg.name}`));
console.log("");

// Vite config template
const viteConfigTemplate = (
	svelteName,
	className,
) => `import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				customElement: true
			},
			emitCss: false
		}),
		dts({
			tsconfigPath: resolve(__dirname, 'tsconfig.json'),
			outDir: 'dist',
			insertTypesEntry: true,
			include: ['index.ts']
		})
	],
	build: {
		lib: {
			entry: resolve(__dirname, '${svelteName}'),
			name: '${className}',
			fileName: () => '${svelteName.replace(".svelte", ".js")}',
			formats: ['es']
		},
		outDir: 'dist',
		emptyOutDir: true,
		target: 'es2020',
		minify: 'esbuild',
		sourcemap: true,
		rollupOptions: {
			output: {
				format: 'es',
				inlineDynamicImports: true
			}
		}
	}
});
`;

// tsconfig.json template
const tsconfigTemplate = (svelteName) => `{
	"extends": "../../tsconfig.json",
	"compilerOptions": {
		"outDir": "./dist",
		"rootDir": ".",
		"declaration": true,
		"declarationMap": true,
		"composite": true
	},
	"include": ["index.ts", "${svelteName}"],
	"exclude": ["node_modules", "dist"]
}
`;

// index.ts template
const indexTemplate = (packageName) => `/**
 * ${packageName} - PIE Assessment Tool
 *
 * Usage:
 *   // Web component (from built dist)
 *   import '${packageName}';
 *   // <${packageName} visible="true" tool-id="..."></${packageName}>
 *
 *   // Svelte component (from source) - check package exports
 */

// Export TypeScript types if any are defined in the Svelte component
`;

// devDependencies to add
const devDeps = {
	"@biomejs/biome": "^2.3.10",
	"@sveltejs/vite-plugin-svelte": "^5.0.4",
	svelte: "^5.16.1",
	typescript: "^5.7.0",
	vite: "^6.0.11",
	"vite-plugin-dts": "^4.5.3",
};

// Process each tool package
let successCount = 0;
let errorCount = 0;

for (const pkg of toolPackages) {
	try {
		console.log(`\nProcessing ${pkg.name}...`);

		// 1. Create vite.config.ts
		const viteConfigPath = join(pkg.dir, "vite.config.ts");
		if (!existsSync(viteConfigPath)) {
			writeFileSync(
				viteConfigPath,
				viteConfigTemplate(pkg.svelteName, pkg.className),
			);
			console.log(`  ✓ Created vite.config.ts`);
		} else {
			console.log(`  ⊘ vite.config.ts already exists`);
		}

		// 2. Create tsconfig.json
		const tsconfigPath = join(pkg.dir, "tsconfig.json");
		if (!existsSync(tsconfigPath)) {
			writeFileSync(tsconfigPath, tsconfigTemplate(pkg.svelteName));
			console.log(`  ✓ Created tsconfig.json`);
		} else {
			console.log(`  ⊘ tsconfig.json already exists`);
		}

		// 3. Update package.json
		const pkgJsonPath = join(pkg.dir, "package.json");
		const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

		// Check if Svelte file exists
		const sveltePath = join(pkg.dir, pkg.svelteName);
		if (!existsSync(sveltePath)) {
			console.log(`  ⚠ Warning: ${pkg.svelteName} not found, skipping`);
			errorCount++;
			continue;
		}

		// Update package.json
		const distFile = pkg.svelteName.replace(".svelte", ".js");
		pkgJson.main = `./dist/${distFile}`;
		pkgJson.types = "./dist/index.d.ts";
		pkgJson.svelte = `./${pkg.svelteName}`; // Keep source for Svelte consumers

		// Update exports to support both built and source
		pkgJson.exports = {
			".": {
				types: "./dist/index.d.ts",
				import: `./dist/${distFile}`,
				svelte: `./${pkg.svelteName}`,
			},
		};

		// Update files array
		pkgJson.files = [
			"dist",
			pkg.svelteName,
			"index.ts",
			...(pkgJson.files || []).filter(
				(f) => !["dist", pkg.svelteName, "index.ts"].includes(f),
			),
		];

		// Add/update scripts
		pkgJson.scripts = {
			...(pkgJson.scripts || {}),
			build: "vite build",
			dev: "vite build --watch",
			typecheck: "tsc --noEmit",
			lint: pkgJson.scripts?.lint || "biome check .",
		};

		// Add devDependencies
		pkgJson.devDependencies = {
			...(pkgJson.devDependencies || {}),
			...devDeps,
		};

		writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n");
		console.log(`  ✓ Updated package.json`);

		// 4. Update/create index.ts if needed
		const indexPath = join(pkg.dir, "index.ts");
		if (!existsSync(indexPath)) {
			writeFileSync(indexPath, indexTemplate(pkg.name));
			console.log(`  ✓ Created index.ts`);
		} else {
			// Check if index.ts exports the Svelte component
			const indexContent = readFileSync(indexPath, "utf-8");
			if (indexContent.includes(`from './${pkg.svelteName}'`)) {
				// Update to remove Svelte export (it's in the built bundle now)
				const newContent = `/**
 * ${pkg.name} - PIE Assessment Tool
 *
 * This package exports a web component built from Svelte.
 * Import the built version for CDN usage, or the .svelte source for Svelte projects.
 */

// Re-export any TypeScript types defined in the package
`;
				writeFileSync(indexPath, newContent);
				console.log(`  ✓ Updated index.ts (removed Svelte export)`);
			} else {
				console.log(`  ⊘ index.ts already configured`);
			}
		}

		successCount++;
	} catch (err) {
		console.error(`  ✗ Error processing ${pkg.name}:`, err.message);
		errorCount++;
	}
}

console.log(`\n${"=".repeat(60)}`);
console.log(`Summary:`);
console.log(`  ✓ Successfully configured: ${successCount} packages`);
console.log(`  ✗ Errors: ${errorCount} packages`);
console.log(`\nNext steps:`);
console.log(`  1. Run: bun install`);
console.log(`  2. Run: bun run build`);
console.log(`  3. Test: bun --filter=pie-tool-calculator run build`);
console.log(`  4. Verify dist/ directories are created`);
