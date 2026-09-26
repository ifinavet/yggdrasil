export function readJson(storage: () => Storage, key: string): unknown {
	try {
		const raw = storage().getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

export function writeJson(storage: () => Storage, key: string, value: unknown): void {
	try {
		storage().setItem(key, JSON.stringify(value));
	} catch {}
}

export function removeItem(storage: () => Storage, key: string): void {
	try {
		storage().removeItem(key);
	} catch {}
}
