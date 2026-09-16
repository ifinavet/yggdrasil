import { withSentryConfig } from "@sentry/nextjs";

const allowedAppEnvs = new Set(["local", "production"]);
if (process.env.APP_ENV && !allowedAppEnvs.has(process.env.APP_ENV)) {
	throw new Error(
		`APP_ENV must be "local" or "production" (or unset), got "${process.env.APP_ENV}".`,
	);
}

const isDev = process.env.NODE_ENV === "development";
const local =
	isDev &&
	(process.env.APP_ENV === "local" ||
		(!process.env.APP_ENV && !process.env.NEXT_PUBLIC_CONVEX_URL));

if (local && process.env.CONVEX_DEPLOYMENT) {
	throw new Error(
		`Local mode requires an isolated Convex backend, but CONVEX_DEPLOYMENT is set to "${process.env.CONVEX_DEPLOYMENT}". Leave CONVEX_DEPLOYMENT empty for isolated local development, or set APP_ENV=production to use the connected deployment.`,
	);
}

function applyLocalConvexUrl() {
	if (local) {
		process.env.NEXT_PUBLIC_CONVEX_URL = "http://127.0.0.1:3210";
	}
}

function getConvexSite() {
	applyLocalConvexUrl();
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set.");
	}
	return process.env.NEXT_PUBLIC_CONVEX_URL.replace(/^https?:\/\//, "");
}

function withDevelopment(config, sentryOptions) {
	applyLocalConvexUrl();
	const nextConfig = {
		...config,
		env: { ...config.env, NEXT_PUBLIC_LOCAL_DEV: String(local) },
		images: {
			...config.images,
			dangerouslyAllowLocalIP: local,
			remotePatterns: [
				...(config.images?.remotePatterns ?? []),
				{ protocol: "https", hostname: getConvexSite(), port: "", pathname: "**" },
			],
		},
	};
	return local ? nextConfig : withSentryConfig(nextConfig, sentryOptions);
}

export function createNextConfig({ project, widenClientFileUpload, devIndicators = undefined }) {
	const nextConfig = {
		transpilePackages: ["@workspace/ui"],
		cacheComponents: true,
		images: {
			remotePatterns: [
				{
					protocol: "http",
					hostname: "127.0.0.1",
					port: "3210",
					pathname: "**",
				},
				{
					protocol: "https",
					hostname: "img.clerk.com",
					port: "",
					pathname: "**",
				},
			],
			dangerouslyAllowSVG: true,
		},
		...(devIndicators === undefined ? {} : { devIndicators }),
		async rewrites() {
			return [
				{
					source: "/relay-aXgZ/static/:path*",
					destination: "https://eu-assets.i.posthog.com/static/:path*",
				},
				{
					source: "/relay-aXgZ/:path*",
					destination: "https://eu.i.posthog.com/:path*",
				},
				{
					source: "/relay-aXgZ/flags",
					destination: "https://eu.i.posthog.com/flags",
				},
			];
		},
		skipTrailingSlashRedirect: true,
	};

	return withDevelopment(nextConfig, {
		org: "ifi-navet",
		project,
		silent: !process.env.CI,
		widenClientFileUpload,
		disableLogger: true,
		automaticVercelMonitors: true,
	});
}
