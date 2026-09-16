const local = process.env.NODE_ENV === "development" && process.env.APP_ENV === "local";
if (local) {
	process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:3210";
}

export function withDevelopment(config, withSentryConfig, sentryOptions) {
	const nextConfig = {
		...config,
		env: { ...config.env, NEXT_PUBLIC_LOCAL_DEV: String(local) },
		images: { ...config.images, dangerouslyAllowLocalIP: local },
	};
	return local ? nextConfig : withSentryConfig(nextConfig, sentryOptions);
}
