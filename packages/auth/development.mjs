export function configureLocalDevelopment() {
	const local = process.env.NODE_ENV === "development" && process.env.APP_ENV === "local";
	if (local) {
		process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:3210";
		process.env.NEXT_PUBLIC_LOCAL_DEV = "true";
	}
	return local;
}
