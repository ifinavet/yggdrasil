declare global {
	interface ImportMeta {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
}

export const modules = import.meta.glob("./**/*.*s");
