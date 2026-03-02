import { describe, expect, test } from "bun:test";

import PreloadedPlayerBuildAndTestPackage from "./preloaded-player-build-and-test-package.js";

class TestCommand extends PreloadedPlayerBuildAndTestPackage {
	public flags: any = {};
	public parseElementsCalls = 0;
	public buildCalls = 0;
	public generateCalls = 0;
	public publishCalls = 0;

	protected override async parse(): Promise<any> {
		return { flags: this.flags };
	}

	public override error(input: string | Error): never {
		throw new Error(String(input));
	}

	protected override async parseElements(): Promise<any> {
		this.parseElementsCalls += 1;
		return [{ package: "@pie-element/multiple-choice", version: "1.0.0" }];
	}

	protected override async buildPackage(): Promise<any> {
		this.buildCalls += 1;
		return { outputDir: "/tmp/out", version: "1.0.0-abc1234.1" };
	}

	protected override async generateTestProject(options: any): Promise<string> {
		this.generateCalls += 1;
		expect(options.packagePath).toBe("/tmp/out");
		return "/tmp/project";
	}

	protected override publish(): string {
		this.publishCalls += 1;
		return "npm publish";
	}
}

describe("preloaded-player-build-and-test-package command", () => {
	test("fails when dryRun is used without publish", async () => {
		const command = new TestCommand([], {} as any);
		command.flags = {
			elements: "@pie-element/multiple-choice@1.0.0",
			dryRun: true,
			publish: false,
		};
		await expect(command.run()).rejects.toThrow(
			"--dryRun can only be used with --publish",
		);
	});

	test("runs build and generate test-project orchestration", async () => {
		const command = new TestCommand([], {} as any);
		command.flags = {
			elements: "@pie-element/multiple-choice@1.0.0",
			publish: false,
			dryRun: false,
			generateTestProject: true,
			outputDir: "/tmp/projects",
			name: "preloaded-test",
			start: false,
			port: 4173,
		};
		await command.run();
		expect(command.parseElementsCalls).toBe(1);
		expect(command.buildCalls).toBe(1);
		expect(command.generateCalls).toBe(1);
		expect(command.publishCalls).toBe(0);
	});
});
