import { HUGIN_LOCAL_URL, HUGIN_URL, MIDGARD_LOCAL_URL, MIDGARD_URL } from "./urls";

// This module reads process.env, so packages without Node types must not import it.
export function huginUrl(): string {
	return (
		process.env.NEXT_PUBLIC_HUGIN_URL ??
		(process.env.NODE_ENV === "development" ? HUGIN_LOCAL_URL : HUGIN_URL)
	);
}

export function midgardUrl(): string {
	return (
		process.env.NEXT_PUBLIC_MIDGARD_URL ??
		(process.env.NODE_ENV === "development" ? MIDGARD_LOCAL_URL : MIDGARD_URL)
	);
}
