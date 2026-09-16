const localConvex = /^http:\/\/(127\.0\.0\.1|localhost):3210$/.test(
	process.env.CONVEX_CLOUD_URL ?? "",
);

let domain;
try {
	domain = process.env.CLERK_FRONTEND_API_URL;
} catch (error) {
	// Convex throws for missing auth-config variables, even when checked for undefined.
	if (!localConvex) throw error;
}

export default {
	providers: domain ? [{ domain, applicationID: "convex" }] : [],
};