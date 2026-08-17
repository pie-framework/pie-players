import { describe, expect, it } from "bun:test";
import {
	DEFAULT_TOOL_REQUEST_LEVEL,
	ToolRequestRegistry,
	type ToolRequestTarget,
} from "../src/services/tool-request.js";

type Opened = { toolId: string; params?: Record<string, unknown> };

function target(
	level: ToolRequestTarget["level"],
	hosted: string[],
	opened: Opened[] = [],
): ToolRequestTarget & { opened: Opened[] } {
	return {
		level,
		hostsTool: (toolId) => hosted.includes(toolId),
		open: (toolId, params) => {
			opened.push({ toolId, params });
		},
		opened,
	};
}

describe("ToolRequestRegistry", () => {
	it("defaults to section level, which is the one a section-scoped surface can address", () => {
		expect(DEFAULT_TOOL_REQUEST_LEVEL).toBe("section");
		const registry = new ToolRequestRegistry();
		const section = target("section", ["dictionary"]);
		registry.registerTarget(section);

		expect(registry.canRequest("dictionary")).toBe(true);
		expect(registry.request({ toolId: "dictionary" })).toBe(true);
		expect(section.opened).toEqual([{ toolId: "dictionary", params: undefined }]);
	});

	it("passes params through to the target", () => {
		const registry = new ToolRequestRegistry();
		const section = target("section", ["dictionary"]);
		registry.registerTarget(section);

		registry.request({ toolId: "dictionary", params: { term: "chloroplast" } });

		expect(section.opened[0].params).toEqual({ term: "chloroplast" });
	});

	it("reports no target for a tool no toolbar hosts", () => {
		const registry = new ToolRequestRegistry();
		registry.registerTarget(target("section", ["calculator"]));

		expect(registry.canRequest("dictionary")).toBe(false);
		expect(registry.request({ toolId: "dictionary" })).toBe(false);
	});

	it("reports no target when nothing has registered", () => {
		const registry = new ToolRequestRegistry();
		expect(registry.canRequest("dictionary")).toBe(false);
		expect(registry.request({ toolId: "dictionary" })).toBe(false);
	});

	// The defect a broadcast would have: in a section player the item card's toolbar
	// and the section's both sit over the selection, so a request that reached every
	// toolbar hosting the tool would open a panel in each.
	it("reaches exactly one target, not every toolbar hosting the tool", () => {
		const registry = new ToolRequestRegistry();
		const section = target("section", ["dictionary"]);
		const item = target("item", ["dictionary"]);
		registry.registerTarget(section);
		registry.registerTarget(item);

		registry.request({ toolId: "dictionary" });

		expect(section.opened).toHaveLength(1);
		expect(item.opened).toHaveLength(0);
	});

	it("resolves against the level the requester names", () => {
		const registry = new ToolRequestRegistry();
		const section = target("section", ["dictionary"]);
		const item = target("item", ["dictionary"]);
		registry.registerTarget(section);
		registry.registerTarget(item);

		registry.request({ toolId: "dictionary", level: "item" });

		expect(item.opened).toHaveLength(1);
		expect(section.opened).toHaveLength(0);
	});

	// The defect this prevents: a host that places a tool at item scope only had the
	// selection action silently disappear, because the tool was granted, hosted and
	// visible while the request defaulted to a section level nothing had registered.
	it("falls back off the default level when no section toolbar hosts the tool", () => {
		const registry = new ToolRequestRegistry();
		const item = target("item", ["dictionary"]);
		registry.registerTarget(target("section", ["calculator"]));
		registry.registerTarget(item);

		expect(registry.canRequest("dictionary")).toBe(true);
		expect(registry.request({ toolId: "dictionary" })).toBe(true);
		expect(item.opened).toHaveLength(1);
	});

	it("still prefers section scope when both host the tool", () => {
		const registry = new ToolRequestRegistry();
		const item = target("item", ["dictionary"]);
		const section = target("section", ["dictionary"]);
		// Registered item-first, so the preference is the level and not the order.
		registry.registerTarget(item);
		registry.registerTarget(section);

		registry.request({ toolId: "dictionary" });

		expect(section.opened).toHaveLength(1);
		expect(item.opened).toHaveLength(0);
	});

	it("does not fall back when the requester named a level, because it meant it", () => {
		const registry = new ToolRequestRegistry();
		const section = target("section", ["dictionary"]);
		registry.registerTarget(section);

		expect(registry.canRequest("dictionary", "item")).toBe(false);
		expect(registry.request({ toolId: "dictionary", level: "item" })).toBe(false);
		expect(section.opened).toHaveLength(0);
	});

	it("skips a target at the right level that does not host the tool", () => {
		const registry = new ToolRequestRegistry();
		const without = target("section", []);
		const with_ = target("section", ["dictionary"]);
		registry.registerTarget(without);
		registry.registerTarget(with_);

		expect(registry.request({ toolId: "dictionary" })).toBe(true);
		expect(without.opened).toHaveLength(0);
		expect(with_.opened).toHaveLength(1);
	});

	it("stops answering once a target unregisters", () => {
		const registry = new ToolRequestRegistry();
		const dispose = registry.registerTarget(target("section", ["dictionary"]));

		expect(registry.canRequest("dictionary")).toBe(true);
		dispose();
		expect(registry.canRequest("dictionary")).toBe(false);
	});

	it("notifies on registration and unregistration so a surface can re-offer", () => {
		const registry = new ToolRequestRegistry();
		let changes = 0;
		const unsubscribe = registry.onTargetsChange(() => {
			changes += 1;
		});

		const dispose = registry.registerTarget(target("section", ["dictionary"]));
		expect(changes).toBe(1);
		dispose();
		expect(changes).toBe(2);
		// A second disposal is not a change: the target is already gone.
		dispose();
		expect(changes).toBe(2);

		unsubscribe();
		registry.registerTarget(target("section", ["calculator"]));
		expect(changes).toBe(2);
	});

	it("treats a target whose host check throws as not hosting the tool", () => {
		const registry = new ToolRequestRegistry();
		const healthy = target("section", ["dictionary"]);
		registry.registerTarget({
			level: "section",
			hostsTool: () => {
				throw new Error("policy read failed");
			},
			open: () => {
				throw new Error("must not be reached");
			},
		});
		registry.registerTarget(healthy);

		expect(registry.request({ toolId: "dictionary" })).toBe(true);
		expect(healthy.opened).toHaveLength(1);
	});

	// The requester uses the return value to decide nothing — it gated on
	// `canRequest` — but a false here is what stops it reporting success it cannot
	// vouch for.
	it("reports failure when the claiming target throws", () => {
		const registry = new ToolRequestRegistry();
		registry.registerTarget({
			level: "section",
			hostsTool: () => true,
			open: () => {
				throw new Error("mount failed");
			},
		});

		expect(registry.request({ toolId: "dictionary" })).toBe(false);
	});

	it("survives a change listener that throws", () => {
		const registry = new ToolRequestRegistry();
		let reached = false;
		registry.onTargetsChange(() => {
			throw new Error("listener failed");
		});
		registry.onTargetsChange(() => {
			reached = true;
		});

		registry.registerTarget(target("section", ["dictionary"]));

		expect(reached).toBe(true);
	});
});
