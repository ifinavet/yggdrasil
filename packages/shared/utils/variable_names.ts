export function toVariableName(name: string): string {
	return name.replaceAll(/[^a-zA-ZæøåÆØÅ0-9]/g, "_");
}
