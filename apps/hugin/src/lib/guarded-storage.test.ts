import { describe, expect, it } from "vitest";
import { readJson, removeItem, writeJson } from "./guarded-storage";

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

const blocked = (): Storage => {
	throw new Error("blocked");
};

describe("guarded storage", () => {
	it("round-trips JSON and removes it again", () => {
		const storage = memoryStorage();
		writeJson(() => storage, "key", { note: "Hei" });
		expect(readJson(() => storage, "key")).toEqual({ note: "Hei" });
		removeItem(() => storage, "key");
		expect(readJson(() => storage, "key")).toBeNull();
	});

	it("reads malformed JSON as nothing", () => {
		const storage = memoryStorage();
		storage.setItem("key", "{not json");
		expect(readJson(() => storage, "key")).toBeNull();
	});

	it("swallows blocked storage", () => {
		expect(readJson(blocked, "key")).toBeNull();
		expect(() => writeJson(blocked, "key", 1)).not.toThrow();
		expect(() => removeItem(blocked, "key")).not.toThrow();
	});
});
