import { describe, expect, test } from "bun:test";
import { cloneDeep, mergeObjectsIgnoringNullUndefined } from "../src/object";

describe("mergeObjectsIgnoringNullUndefined", () => {
	test("merges objects, but does not overwrite with null/undefined", () => {
		const base = { a: 1, b: 2 };
		const overrideNull = { b: null as unknown as number, c: 3 };
		const overrideUndefined = { b: undefined as unknown as number, d: 4 };
		const overrideDefined = { b: 9 };

		const merged = mergeObjectsIgnoringNullUndefined(
			base,
			overrideNull,
			overrideUndefined,
			overrideDefined,
		);

		expect(merged as Record<string, unknown>).toEqual({ a: 1, b: 9, c: 3, d: 4 });
	});
});

describe("cloneDeep", () => {
	test("deep clones nested objects/arrays", () => {
		const input = {
			a: 1,
			b: { c: 2, d: [1, 2, { e: 3 }] },
		};

		const cloned = cloneDeep(input);

		expect(cloned).toEqual(input);
		expect(cloned).not.toBe(input);
		expect(cloned.b).not.toBe(input.b);
		expect(cloned.b.d).not.toBe(input.b.d);
		expect(cloned.b.d[2]).not.toBe(input.b.d[2]);

		(cloned.b.d[2] as any).e = 999;
		expect((input.b.d[2] as any).e).toBe(3);
	});

	test("carries class instances over by reference", () => {
		class ObjectIdLike {
			constructor(readonly bytes: Uint8Array) {}
			toHexString() {
				return Buffer.from(this.bytes).toString("hex");
			}
		}
		const id = new ObjectIdLike(new Uint8Array([0x69, 0xc7]));
		const createdAt = new Date("2026-10-20T00:00:00Z");
		const input = { _id: id, nested: { createdAt }, list: [id] };

		const cloned = cloneDeep(input);

		expect(cloned).not.toBe(input);
		expect(cloned.nested).not.toBe(input.nested);
		expect(cloned._id).toBe(id);
		expect(cloned._id.toHexString()).toBe("69c7");
		expect(cloned.nested.createdAt).toBe(createdAt);
		expect(cloned.list[0]).toBe(id);
	});

	test("deep clones objects with a null prototype", () => {
		const input = Object.assign(Object.create(null), { a: { b: 1 } });

		const cloned = cloneDeep(input);

		expect(cloned).toEqual({ a: { b: 1 } });
		expect(cloned.a).not.toBe(input.a);
	});
});
