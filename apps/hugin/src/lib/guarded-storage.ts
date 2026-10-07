export function readJson(storage: () => Storage, key: string): unknown {
	try {
		const raw = storage().getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

/** Whether the value was written. Full or blocked storage writes nothing. */
export function writeJson(storage: () => Storage, key: string, value: unknown): boolean {
	try {
		storage().setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

export function removeItem(storage: () => Storage, key: string): void {
	try {
		storage().removeItem(key);
	} catch {}
}
