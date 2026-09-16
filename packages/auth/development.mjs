const isDev = process.env.NODE_ENV === "development";
const local =
	isDev &&
	(process.env.APP_ENV === "local" ||
		(!process.env.APP_ENV && !process.env.NEXT_PUBLIC_CONVEX_URL));

export function applyLocalConvexUrl() {
	if (local) {
		process.env.NEXT_PUBLIC_CONVEX_URL ??= "http://127.0.0.1:3210";
	}
}

export function withDevelopment(config, withSentryConfig, sentryOptions) {
	applyLocalConvexUrl();
	const nextConfig = {
		...config,
		env: { ...config.env, NEXT_PUBLIC_LOCAL_DEV: String(local) },
		images: { ...config.images, dangerouslyAllowLocalIP: local },
	};
	return local ? nextConfig : withSentryConfig(nextConfig, sentryOptions);
}
