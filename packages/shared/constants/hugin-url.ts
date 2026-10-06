import { HUGIN_LOCAL_URL, HUGIN_URL, MIDGARD_URL } from "./urls";

export function huginUrl(): string {
	return (
		process.env.NEXT_PUBLIC_HUGIN_URL ??
		(process.env.NODE_ENV === "development" ? HUGIN_LOCAL_URL : HUGIN_URL)
	);
}

export function midgardUrl(): string {
	return process.env.NEXT_PUBLIC_MIDGARD_URL ?? MIDGARD_URL;
}
