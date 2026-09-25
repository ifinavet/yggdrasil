export const MIDGARD_URL = "https://ifinavet.no";
export const BIFROST_URL = "https://bifrost.ifinavet.no";
/** Hugin, the site companies use to apply for and answer semester planning offers. */
export const HUGIN_URL = "https://hugin.ifinavet.no";

export const MIDGARD_LOCAL_URL = "http://localhost:3000";
export const BIFROST_LOCAL_URL = "http://localhost:3001";
export const HUGIN_LOCAL_URL = "http://localhost:3003";

/** Hugin's address, or the local Hugin while developing. */
export function huginUrl(): string {
	return process.env.NODE_ENV === "development" ? HUGIN_LOCAL_URL : HUGIN_URL;
}
