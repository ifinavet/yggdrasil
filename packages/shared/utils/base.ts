export function toBase64(text: string): string {
	return btoa(encodeURIComponent(text));
}

export function fromBase64(text: string): string {
	return decodeURIComponent(atob(text));
}
