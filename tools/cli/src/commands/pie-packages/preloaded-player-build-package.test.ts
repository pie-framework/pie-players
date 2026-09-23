import { describe, expect, test } from "bun:test";

import PreloadedPlayerBuildPackage from "./preloaded-player-build-package.js";

class TestCommand extends PreloadedPlayerBuildPackage {
	public flags: any = {};
	public parseCalls = 0;
	public parseElementsCalls = 0;
	public buildCalls = 0;
	public publishCalls = 0;
	public logs: string[] = [];

	protected override async parse(): Promise<any> {
		this.parseCalls += 1;
		return { flags: this.flags };
	}

	public override error(input: string | Error): never {
		throw new Error(String(input));
	}

	public override log(message = ""): void {
		this.logs.push(message);
	}

	protected override async parseElements(): Promise<any> {
		this.parseElementsCalls += 1;
		return [{ package: "@pie-element/multiple-choice", version: "1.0.0" }];
	}

	protected override async resolveElementSet(): Promise<any> {
		return { name: "star-0326", distTag: "latest" };
	}

	protected override async buildPackage(): Promise<any> {
		this.buildCalls += 1;
		return { outputDir: "/tmp/out", version: "1.0.0-abc1234.1" };
	}

	protected override publish(): string {
		this.publishCalls += 1;
		return "npm publish";
	}
}

describe("preloaded-player-build-package command", () => {
	test("fails when elements input is missing", async () => {
		const command = new TestCommand([], {} as any);
		command.flags = {};
		await expect(command.run()).rejects.toThrow(
			"Either -f/--elementsFile or -e/--elements must be specified",
		);
		expect(command.buildCalls).toBe(0);
	});

	test("runs build flow and dry-run publish under the set's dist-tag", async () => {
		const command = new TestCommand([], {} as any);
		command.flags = {
			elementsFile: "configs/preloaded-player/star-0326.json",
			publish: true,
			dryRun: true,
		};
		await command.run();
		expect(command.parseElementsCalls).toBe(1);
		expect(command.buildCalls).toBe(1);
		expect(command.publishCalls).toBe(0);
		expect(command.logs.some((line) => line.endsWith("--tag latest"))).toBe(true);
	});

	test("refuses to publish a build that has no config file to name it", async () => {
		const command = new TestCommand([], {} as any);
		command.flags = {
			elements: "@pie-element/multiple-choice@1.0.0",
			publish: true,
			dryRun: true,
		};
		await expect(command.run()).rejects.toThrow("--publish needs -f/--elementsFile");
		expect(command.buildCalls).toBe(0);
	});
});
