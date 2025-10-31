export function toVariableName(name: string): string {
	return name.replace(/[^a-zA-ZæøåÆØÅ0-9]/g, "_");
}
