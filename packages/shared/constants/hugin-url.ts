import { HUGIN_LOCAL_URL, HUGIN_URL } from "./urls";

// Its own module, since it reads process.env: packages without Node types, such as emails, import
// the other constants and must not type-check this.

/** Hugin's address, or the local Hugin while developing. */
export function huginUrl(): string {
	return process.env.NODE_ENV === "development" ? HUGIN_LOCAL_URL : HUGIN_URL;
}
