import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const PACKAGE_DIR = path.resolve(import.meta.dir, "..");
const VENDOR_DIR = path.join(PACKAGE_DIR, "src/components/vendor");

const manifest = JSON.parse(
	readFileSync(path.join(PACKAGE_DIR, "package.json"), "utf8"),
) as { sideEffects: unknown };

/** The modules the build ships: what tsc compiles, plus the vendored components it copies. */
const shippedModules = (): string[] => {
	const { config } = ts.readConfigFile(
		path.join(PACKAGE_DIR, "tsconfig.json"),
		ts.sys.readFile,
	);
	const compiled = ts
		.parseJsonConfigFileContent(config, ts.sys, PACKAGE_DIR)
		.fileNames.filter(
			(file) => file.endsWith(".ts") && !file.endsWith(".d.ts"),
		);
	return [...compiled, ...ts.sys.readDirectory(VENDOR_DIR, [".js"])];
};

const toDistPath = (file: string) =>
	`./${path
		.relative(PACKAGE_DIR, file)
		.replace(/^src\//, "dist/")
		.replace(/\.ts$/, ".js")}`;

const EVALUATED_STATEMENTS = new Set([
	ts.SyntaxKind.ExpressionStatement,
	ts.SyntaxKind.IfStatement,
	ts.SyntaxKind.ForStatement,
	ts.SyntaxKind.ForInStatement,
	ts.SyntaxKind.ForOfStatement,
	ts.SyntaxKind.WhileStatement,
	ts.SyntaxKind.DoStatement,
	ts.SyntaxKind.TryStatement,
	ts.SyntaxKind.SwitchStatement,
	ts.SyntaxKind.Block,
	ts.SyntaxKind.LabeledStatement,
]);

/** Top-level statements that act at import: calls, assignments, bare imports, static blocks. */
const runsAtImport = (statement: ts.Statement) =>
	EVALUATED_STATEMENTS.has(statement.kind) ||
	(ts.isImportDeclaration(statement) && !statement.importClause) ||
	(ts.isClassDeclaration(statement) &&
		statement.members.some(ts.isClassStaticBlockDeclaration));

const modulesWithImportEffects = () =>
	shippedModules()
		.filter((file) =>
			ts
				.createSourceFile(
					file,
					readFileSync(file, "utf8"),
					ts.ScriptTarget.Latest,
					true,
				)
				.statements.some(runsAtImport),
		)
		.map(toDistPath)
		.sort();

describe("players-shared sideEffects", () => {
	test("finds the vendored icon button, which defines its element at import", () => {
		expect(modulesWithImportEffects()).toContain(
			"./dist/components/vendor/nds/nds-icon-button.js",
		);
	});

	test("lists every module that acts at import, so a bundler keeps it", () => {
		expect(Array.isArray(manifest.sideEffects)).toBe(true);
		const globs = (manifest.sideEffects as string[]).map(
			(pattern) => new Bun.Glob(pattern),
		);
		const unlisted = modulesWithImportEffects().filter(
			(file) => !globs.some((glob) => glob.match(file)),
		);
		expect(unlisted).toEqual([]);
	});
});
