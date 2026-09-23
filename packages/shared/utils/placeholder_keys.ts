export function placeholderKeys(prefix: string, count: number): readonly string[] {
	return Array.from({ length: count }, (_, position) => `${prefix}-${position}`);
}
